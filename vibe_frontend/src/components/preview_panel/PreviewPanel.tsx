"use client";
import { useAtom, useAtomValue } from "jotai";
import {
  appOutputAtom,
  previewModeAtom,
  previewPanelKeyAtom,
  selectedAppIdAtom,
} from "../../atoms/appAtoms";
// import { isPreviewOpenAtom } from "../../atoms/viewAtoms";

import { CodeView } from "./CodeView";
import { PreviewIframe } from "./PreviewIframe";
import { Problems } from "./Problems";
import { ConfigurePanel } from "./ConfigurePanel";
import { ChevronDown, ChevronUp, Logs } from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { Console } from "./Console";
import { useRunApp } from "@/hooks/useRunApp";
import { useContainerLogStream } from "@/hooks/useContainerLogStream";
import { PublishPanel } from "./PublishPanel";
import { SecurityPanel } from "./SecurityPanel";

interface ConsoleHeaderProps {
  isOpen: boolean;
  onToggle: () => void;
}

// Console header component - reads appOutputAtom directly to avoid re-rendering parent
const ConsoleHeader = ({ isOpen, onToggle }: ConsoleHeaderProps) => {
  const appOutput = useAtomValue(appOutputAtom);
  const messageCount = appOutput.length;
  const latestMessage =
    messageCount > 0 ? appOutput[messageCount - 1]?.message : undefined;

  return (
    <div
      onClick={onToggle}
      className="flex items-start gap-2 px-4 py-1.5 border-t border-border cursor-pointer hover:bg-[var(--background-darkest)] transition-colors"
    >
      <Logs size={16} className="mt-0.5" />
      <div className="flex flex-col">
        <span className="text-sm font-medium">System Messages</span>
        {!isOpen && latestMessage && (
          <span className="text-xs text-gray-500 truncate max-w-[200px] md:max-w-[400px]">
            {latestMessage}
          </span>
        )}
      </div>
      <div className="flex-1" />
      {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
    </div>
  );
};

// Main PreviewPanel component
export function PreviewPanel() {
  const pathname = usePathname();

  // Only render PreviewPanel on chat routes - prevent unnecessary API calls on other routes
  const isOnChatRoute = useMemo(() => pathname.includes("/chat"), [pathname]);

  // Read atoms before early return to avoid hook order issues
  const [previewMode] = useAtom(previewModeAtom);
  const selectedAppId = useAtomValue(selectedAppIdAtom);
  const key = useAtomValue(previewPanelKeyAtom);
  // const isPreviewOpen = useAtomValue(isPreviewOpenAtom);

  // ALL HOOKS MUST BE BEFORE EARLY RETURN (Rules of Hooks)
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const { runApp, stopApp, loading, app } = useRunApp();
  const runningAppIdRef = useRef<number | null>(null);

  // Stream container logs - only starts when isPreviewOpen is true
  useContainerLogStream();

  if (!isOnChatRoute) {
    return null;
  }

  useEffect(() => {
    const previousAppId = runningAppIdRef.current;

    // Check if the selected app ID has changed
    if (selectedAppId !== previousAppId) {
      // Stop the previously running app, if any
      if (previousAppId !== null) {
        console.debug("Stopping previous app", previousAppId);
        stopApp(previousAppId);
        // We don't necessarily nullify the ref here immediately,
        // let the start of the next app update it or unmount handle it.
      }

      // Start the new app if an ID is selected
      if (selectedAppId !== null) {
        console.debug("Starting new app", selectedAppId);
        // runApp(selectedAppId); // Consider adding error handling for the promise if needed
        runningAppIdRef.current = selectedAppId; // Update ref to the new running app ID
      } else {
        // If selectedAppId is null, ensure no app is marked as running
        runningAppIdRef.current = null;
      }
    }

    // Cleanup function: This runs when the component unmounts OR before the effect runs again.
    // We only want to stop the app on actual unmount. The logic above handles stopping
    // when the appId changes. So, we capture the running appId at the time the effect renders.
    const appToStopOnUnmount = runningAppIdRef.current;
    return () => {
      if (appToStopOnUnmount !== null) {
        const currentRunningApp = runningAppIdRef.current;
        if (currentRunningApp !== null) {
          console.debug(
            "Component unmounting or selectedAppId changing, stopping app",
            currentRunningApp,
          );
          // stopApp(currentRunningApp);
          runningAppIdRef.current = null; // Clear ref on stop
        }
      }
    };
    // Dependencies: run effect when selectedAppId changes.
    // runApp/stopApp are stable due to useCallback.
  }, [selectedAppId, runApp, stopApp]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="vertical">
          <Panel id="content" minSize={30}>
            <div className="h-full overflow-y-auto">
              {previewMode === "preview" ? (
                <PreviewIframe key={key} loading={loading} />
              ) : previewMode === "code" ? (
                <CodeView loading={loading} app={app} />
              ) : previewMode === "configure" ? (
                <ConfigurePanel />
              ) : previewMode === "publish" ? (
                <PublishPanel />
              ) : previewMode === "security" ? (
                <SecurityPanel />
              ) : (
                <Problems />
              )}
            </div>
          </Panel>
          {isConsoleOpen && (
            <>
              <PanelResizeHandle className="h-1 bg-border hover:bg-gray-400 transition-colors cursor-row-resize" />
              <Panel id="console" minSize={10} defaultSize={30}>
                <div className="flex flex-col h-full">
                  <ConsoleHeader
                    isOpen={true}
                    onToggle={() => setIsConsoleOpen(false)}
                  />
                  <Console />
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
      {!isConsoleOpen && (
        <ConsoleHeader isOpen={false} onToggle={() => setIsConsoleOpen(true)} />
      )}
    </div>
  );
}
