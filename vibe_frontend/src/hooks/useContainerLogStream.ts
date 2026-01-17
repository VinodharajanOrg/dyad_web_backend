import { useEffect, useRef, useCallback } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { appOutputAtom, selectedAppIdAtom } from "@/atoms/appAtoms";
import { isPreviewOpenAtom } from "@/atoms/viewAtoms";
import { containerLogsApi } from "@/api/endpoints/container-logs";
import { AppOutput } from "@/types/ipc_types";
import { usePathname } from "next/navigation";

/**
 * Hook to stream container logs via HTTP streaming and populate appOutput atom
 * - Only starts streaming when preview panel is visible
 * - Streams logs for the currently selected app
 * - Automatically stops when preview is closed
 * - Handles connection lifecycle (open, message, error, close)
 * - Converts SSE events to AppOutput format
 * - Auto-reconnects on error (only while preview is open)
 */
export function useContainerLogStream() {
  const setAppOutput = useSetAtom(appOutputAtom);
  const appOutput = useAtomValue(appOutputAtom);
  const appId = useAtomValue(selectedAppIdAtom);
  const isPreviewOpen = useAtomValue(isPreviewOpenAtom);
  const pathname = usePathname();

  // Only keep essential refs for cleanup and state tracking
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isStreamingRef = useRef(false);
  const currentStreamKeyRef = useRef<string | null>(null);

  // Non-memoized close function to avoid dependency issues
  const closeStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      isStreamingRef.current = false;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  // Create a ref to store the current appId to avoid recreating handleStreamEvent
  const appIdRef = useRef(appId);

  useEffect(() => {
    appIdRef.current = appId;
  }, [appId]);

  const handleStreamEvent = useCallback(
    (eventData: any, eventType: string) => {
      const timestamp = Date.now();
      let logMessage: AppOutput | null = null;
      const currentAppId = appIdRef.current;

      switch (eventType) {
        case "status":
          if (
            eventData.message &&
            !eventData.message.includes("Connected to log stream")
          ) {
            logMessage = {
              message: `[Status] ${eventData.message}`,
              type: "stdout",
              appId: currentAppId || 0,
              timestamp,
            };
          }
          break;

        case "event":
          logMessage = {
            message: eventData.message || `[Event] ${eventData.type}`,
            type: eventData.level === "error" ? "stderr" : "stdout",
            appId: currentAppId || 0,
            timestamp,
          };
          break;

        case "log":
          logMessage = {
            message: eventData.message || eventData.raw,
            type:
              eventData.level === "error" || eventData.level === "warn"
                ? "stderr"
                : "stdout",
            appId: currentAppId || 0,
            timestamp,
          };
          break;

        case "error":
          logMessage = {
            message: `[Error] ${eventData.error || eventData.message}`,
            type: "stderr",
            appId: currentAppId || 0,
            timestamp,
          };
          break;

        case "complete":
          logMessage = {
            message: `[Stream] ${eventData.message || "Log stream ended"}`,
            type: "stdout",
            appId: currentAppId || 0,
            timestamp,
          };
          break;

        default:
          logMessage = {
            message: `[${eventType}] ${JSON.stringify(eventData)}`,
            type: "stdout",
            appId: currentAppId || 0,
            timestamp,
          };
      }

      if (logMessage) {
        // Use functional update to avoid race conditions when multiple logs arrive rapidly
        setAppOutput((prevLogs) => [...prevLogs, logMessage]);
      }
    },
    [setAppOutput],
  );

  useEffect(() => {
    // Create a unique key for this stream session
    const streamKey = `${appId}-${isPreviewOpen}`;

    // Immediately close stream if not on chat route, preview is not open, or no appId
    // Also check that pathname matches appId to prevent streaming during navigation
    const isOnMatchingChatRoute =
      pathname.includes("/chat") && pathname.includes(`/${appId}/`);
    if (!isOnMatchingChatRoute || !isPreviewOpen || !appId) {
      closeStream();
      currentStreamKeyRef.current = null;
      return;
    }

    // If the stream key hasn't changed and we're already streaming, skip
    if (streamKey === currentStreamKeyRef.current && isStreamingRef.current) {
      return;
    }

    const startStream = async () => {
      if (!appId || !isPreviewOpen) {
        return;
      }

      // If already streaming for this exact combination, don't start again
      if (currentStreamKeyRef.current === streamKey && isStreamingRef.current) {
        return;
      }

      try {
        isStreamingRef.current = true;
        currentStreamKeyRef.current = streamKey;

        // Add connecting message only if there are no logs yet for this app
        const existingLogsForApp = appOutput.filter(
          (log) => log.appId === appId,
        );
        if (existingLogsForApp.length === 0) {
          setAppOutput((prevLogs) => [
            ...prevLogs,
            {
              message: "Connecting to container logs...",
              type: "stdout" as const,
              appId,
              timestamp: Date.now(),
            },
          ]);
        }

        abortControllerRef.current = new AbortController();

        await containerLogsApi.streamLogs(
          appId,
          {
            onStatus: (data) => handleStreamEvent(data, "status"),
            onLog: (data) => handleStreamEvent(data, "log"),
            onEvent: (data) => handleStreamEvent(data, "event"),
            onError: (data) => {
              handleStreamEvent(data, "error");
              closeStream();
              currentStreamKeyRef.current = null;
              // Only reconnect if preview is still open
              if (isPreviewOpen) {
                reconnectTimeoutRef.current = setTimeout(() => {
                  console.debug(
                    "Attempting to reconnect container log stream",
                    appId,
                  );
                  startStream();
                }, 5000);
              }
            },
            onComplete: (data) => {
              handleStreamEvent(data, "complete");
              closeStream();
              currentStreamKeyRef.current = null;
            },
          },
          { follow: true, tail: 100 },
        );
      } catch (error) {
        console.error(
          "Failed to start container log stream for app",
          appId,
          error,
        );
        isStreamingRef.current = false;
        currentStreamKeyRef.current = null;
        closeStream();

        // Only reconnect if preview is still open
        if (isPreviewOpen) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.debug(
              "[useContainerLogStream] Reconnecting after exception for app",
              appId,
            );
            startStream();
          }, 5000);
        }
      }
    };

    // Only start stream if preview is open and app ID exists
    if (isPreviewOpen && appId) {
      startStream();
    }

    // Close stream when preview closes or app changes
    if (!isPreviewOpen || !appId) {
      currentStreamKeyRef.current = null;
      closeStream();
    }

    return () => {
      currentStreamKeyRef.current = null;
      closeStream();
    };
  }, [appId, isPreviewOpen, pathname, handleStreamEvent]);
}
