"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import { ChatPanel } from "../components/ChatPanel";
import { PreviewPanel } from "../components/preview_panel/PreviewPanel";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { isPreviewOpenAtom } from "@/atoms/viewAtoms";
import { useChats } from "@/hooks/useChats";
import { selectedAppIdAtom } from "@/atoms/appAtoms";
import { useRunApp } from "@/hooks/useRunApp";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS (Rules of Hooks)
  const isOnChatRoute = useMemo(() => pathname.includes("/chat"), [pathname]);

  const chatId = useMemo(() => {
    const id = searchParams.get("id");
    return id ? Number(id) : undefined;
  }, [searchParams]);

  const [isPreviewOpen, setIsPreviewOpen] = useAtom(isPreviewOpenAtom);
  const [isResizing, setIsResizing] = useState(false);
  const selectedAppId = useAtomValue(selectedAppIdAtom);
  const setSelectedAppId = useSetAtom(selectedAppIdAtom);
  const [isMounted, setIsMounted] = useState(false);
  const { runApp } = useRunApp();
  const ref = useRef<ImperativePanelHandle>(null);

  // Only load chats when we have a valid selectedAppId and are on a chat route
  const { data: chats = [], isLoading: loading } = useChats(
    isOnChatRoute && selectedAppId ? selectedAppId : undefined,
  );

  // NOTE: Fix hydration mismatch - only render after client-side mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Set preview panel to open when on chat page, close when leaving
  useEffect(() => {
    setIsPreviewOpen(isOnChatRoute);
    return () => {
      setIsPreviewOpen(false);
    };
  }, [isOnChatRoute]); // Removed setIsPreviewOpen from deps - Jotai setters are NOT stable!

  // Start Docker container when selectedAppId changes and preview is open
  // Must check pathname matches selectedAppId to avoid running during navigation
  useEffect(() => {
    // Guard: Check pathname directly to avoid race conditions
    if (!pathname.includes("/chat")) {
      return;
    }
    // Guard: Only run if pathname matches the selectedAppId (prevents running during navigation)
    if (selectedAppId && !pathname.includes(`/${selectedAppId}/`)) {
      return;
    }
    if (selectedAppId && isPreviewOpen) {
      runApp(selectedAppId);
    }
  }, [selectedAppId, isPreviewOpen, pathname, runApp]);

  // Redirect to first chat if no chatId provided
  useEffect(() => {
    if (!chatId && chats.length && !loading) {
      setSelectedAppId(chats[0].appId);
      router.replace(`/${selectedAppId}/chat?id=${chats[0].id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, chats, loading, router]); // ✅ Removed setSelectedAppId

  // Expand/collapse preview panel
  useEffect(() => {
    if (isPreviewOpen) {
      ref.current?.expand();
    } else {
      ref.current?.collapse();
    }
  }, [isPreviewOpen]);

  // EARLY RETURNS AFTER ALL HOOKS (Rules of Hooks)
  if (!isOnChatRoute) {
    return null;
  }

  if (!isMounted) {
    return null;
  }

  return (
    <PanelGroup autoSaveId="persistence" direction="horizontal">
      <Panel id="chat-panel" minSize={30}>
        <div className="h-full w-full">
          <ChatPanel
            chatId={chatId}
            isPreviewOpen={isPreviewOpen}
            onTogglePreview={() => {
              setIsPreviewOpen(!isPreviewOpen);
              if (isPreviewOpen) {
                ref.current?.collapse();
              } else {
                ref.current?.expand();
              }
            }}
          />
        </div>
      </Panel>

      <>
        <PanelResizeHandle
          onDragging={(e) => setIsResizing(e)}
          className="w-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors cursor-col-resize"
        />
        <Panel
          collapsible
          ref={ref}
          id="preview-panel"
          minSize={20}
          className={cn(
            !isResizing && "transition-all duration-100 ease-in-out",
          )}
        >
          <PreviewPanel />
        </Panel>
      </>
    </PanelGroup>
  );
}
