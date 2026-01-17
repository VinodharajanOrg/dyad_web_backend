import { useRef, useCallback, useEffect } from "react";
import { dockerApi } from "@/api/endpoints/docker";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  appUrlAtom,
  selectedAppIdAtom,
  lastDockerAppIdAtom,
  appOutputAtom,
} from "@/atoms/appAtoms";
import { useDockerStatus } from "./useDockerStatus";
import { setupDockerUrlFromStatus, extractValidPort } from "@/lib/docker-utils";

/**
 * Hook that returns an async function to run/start Docker container
 * - Returns a memoized promise-based function that can be awaited
 * - Checks if container is already running
 * - Sets the app URL when ready
 * - Handles app output logging
 * - Uses centralized useDockerStatus hook for polling (no duplicate calls)
 * - Optimized: memoized with useCallback to prevent re-renders
 */
export function useRunDockerApp() {
  const setAppUrlObj = useSetAtom(appUrlAtom);
  const [_lastAppId, setLastAppId] = useAtom(lastDockerAppIdAtom);
  const setAppOutput = useSetAtom(appOutputAtom);
  // Fetch status fresh inside the callback instead

  // Memoize the returned function to keep it stable
  // Only depend on setters to keep the function stable
  return useCallback(
    async (appId: number | null | undefined) => {
      if (!appId) return;

      try {
        // Fetch fresh status each time to avoid stale data
        const status = await dockerApi.getDockerStatus(appId);
        const port = extractValidPort(status.port);

        if (status.isRunning && status.isReady && port > 0) {
          // Already running and ready
          setupDockerUrlFromStatus(port, appId, status, setAppUrlObj);
          setLastAppId(appId);

          // Append to app output
          setAppOutput((prev) => [
            ...prev,
            {
              message: "🔗 Connecting to container logs...",
              type: "stdout",
              appId,
              timestamp: Date.now(),
            },
          ]);
          return;
        } else {
          // Container not ready or not running, start it
          const response = await dockerApi.runInDocker(appId);
          if (response && response.port) {
            // const port = extractValidPort(response.port);
            // The centralized useDockerStatus hook will handle polling for readiness
            // We just set the URL once status is ready via the hook's polling
            setLastAppId(appId);

            // Append to app output
            setAppOutput((prev) => [
              ...prev,
              {
                message: "🐳 Docker container started, streaming logs...",
                type: "stdout",
                appId,
                timestamp: Date.now(),
              },
            ]);
          }
        }
      } catch {
        // Silently fail - Docker operations are logged via streaming
      }
    },
    [setAppUrlObj, setLastAppId, setAppOutput],
  );
}

/**
 * Hook to sync files to Docker container after chat completion
 * - Call this after streaming completes
 * - Prevents multiple sync calls with ref tracking
 */
export function useDockerSync() {
  const selectedAppId = useAtomValue(selectedAppIdAtom);
  const lastSyncTimeRef = useRef<number>(0);
  const SYNC_DEBOUNCE_MS = 2000; // Prevent multiple syncs within 2 seconds

  const syncToDocker = async () => {
    if (!selectedAppId) return;

    const now = Date.now();
    if (now - lastSyncTimeRef.current < SYNC_DEBOUNCE_MS) {
      // ...existing code...
      return;
    }

    lastSyncTimeRef.current = now;

    try {
      //const response = await dockerApi.syncToDocker(selectedAppId);
      // ...existing code...
    } catch (err) {
      console.error(`[Docker] Failed to sync app ${selectedAppId}:`, err);
    }
  };

  return { syncToDocker };
}

/**
 * Restart Docker container for a given appId using dedicated restart API
 * - Uses /api/apps/:appId/restart endpoint
 * - Automatically stops and restarts with quick startup (skips dependency installation)
 * - Polls status every 5 seconds until container is ready
 * - Sets app URL when isReady and isRunning are true
 */
export function useRestartDockerApp() {
  const setAppUrlObj = useSetAtom(appUrlAtom);
  const [_lastAppId, setLastAppId] = useAtom(lastDockerAppIdAtom);
  const selectedAppId = useAtomValue(selectedAppIdAtom);
  const setAppOutput = useSetAtom(appOutputAtom);

  // Use centralized hook for Docker status polling
  const { dockerStatus } = useDockerStatus(selectedAppId);

  // Watch for when container becomes ready after restart
  // This effect will trigger when useDockerStatus polling detects the container is ready
  useEffect(() => {
    if (
      dockerStatus &&
      selectedAppId &&
      dockerStatus.isRunning &&
      dockerStatus.isReady
    ) {
      const port = extractValidPort(dockerStatus.port);
      if (port > 0) {
        // Set up app URL when ready (triggered by useDockerStatus polling)
        setupDockerUrlFromStatus(
          port,
          selectedAppId,
          dockerStatus,
          setAppUrlObj,
        );
      }
    }
  }, [dockerStatus, selectedAppId, setAppUrlObj]);

  return useCallback(
    async (appId: number | null | undefined) => {
      if (!appId) return;

      try {
        // Call restart API
        const response = await dockerApi.restartDocker(appId);

        if (response && response.data && response.data.port) {
          setLastAppId(appId);

          // Append to app output
          setAppOutput((prev) => [
            ...prev,
            {
              message: "Restarting Docker container...",
              type: "stdout",
              appId,
              timestamp: Date.now(),
            },
          ]);

          // useDockerStatus hook will automatically poll status every 5 seconds
          // and the useEffect above will set up the URL when container is ready
        }
      } catch (error) {
        console.error("[Docker] Failed to restart app", appId, error);

        // Append error message to app output
        setAppOutput((prev) => [
          ...prev,
          {
            message: `Failed to restart container: ${error instanceof Error ? error.message : "Unknown error"}`,
            type: "stderr",
            appId,
            timestamp: Date.now(),
          },
        ]);
      }
    },
    [setLastAppId, setAppOutput],
  );
}
