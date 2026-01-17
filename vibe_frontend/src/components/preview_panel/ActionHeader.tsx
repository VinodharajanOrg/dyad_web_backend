"use client";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  previewModeAtom,
  selectedAppIdAtom,
  appUrlAtom,
} from "../../atoms/appAtoms";
import { IpcClient } from "@/api/ipc_client";
import { setupDockerUrlFromStatus, extractValidPort } from "@/lib/docker-utils";

import {
  Eye,
  Code,
  MoreVertical,
  Cog,
  Trash2,
  AlertTriangle,
  Wrench,
  Globe,
  Shield,
} from "lucide-react";
import { ChatActivityButton } from "@/components/chat/ChatActivity";
import { motion } from "framer-motion";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { SHORT_ANIMATION_DELAY } from "@/lib/constants";

import { useRunApp } from "@/hooks/useRunApp";
import { useDockerStatus } from "@/hooks/useDockerStatus";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { showError, showSuccess } from "@/lib/toast";
import { useMutation } from "@tanstack/react-query";
import { useCheckProblems } from "@/hooks/useCheckProblems";
import { isPreviewOpenAtom } from "@/atoms/viewAtoms";

export type PreviewMode =
  | "preview"
  | "code"
  | "problems"
  | "configure"
  | "publish"
  | "security";

// Preview Header component with preview mode toggle
export const ActionHeader = () => {
  const pathname = usePathname();

  // Call all hooks unconditionally (React Rules of Hooks)
  const [previewMode, setPreviewMode] = useAtom(previewModeAtom);
  const [isPreviewOpen, setIsPreviewOpen] = useAtom(isPreviewOpenAtom);
  const selectedAppId = useAtomValue(selectedAppIdAtom);
  const setAppUrlObj = useSetAtom(appUrlAtom);
  const previewRef = useRef<HTMLButtonElement>(null);
  const codeRef = useRef<HTMLButtonElement>(null);
  const problemsRef = useRef<HTMLButtonElement>(null);
  const configureRef = useRef<HTMLButtonElement>(null);
  const publishRef = useRef<HTMLButtonElement>(null);
  const securityRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024,
  );
  const { problemReport } = useCheckProblems(selectedAppId);
  const { restartApp, refreshAppIframe } = useRunApp();
  const { dockerStatus, isPublishEnabled } = useDockerStatus(selectedAppId);

  // Only render ActionHeader on chat routes - prevent API calls on other routes
  const isOnChatRoute = useMemo(() => {
    return pathname.includes("/chat");
  }, [pathname]);

  if (!isOnChatRoute) {
    return null;
  }

  const isCompact = windowWidth < 888;
  // Set app URL when Docker status polling detects container is ready
  // This ensures preview iframe gets the URL even if initial setup missed it
  useEffect(() => {
    if (dockerStatus && selectedAppId) {
      const port = extractValidPort(dockerStatus.port);
      if (port > 0) {
        setupDockerUrlFromStatus(
          port,
          selectedAppId,
          dockerStatus,
          setAppUrlObj,
        );
      }
    }
  }, [dockerStatus, selectedAppId, setAppUrlObj]);

  // NOTE: Use dynamic url for publish based on environment
  const handlePublishClick = () => {
    if (isPublishEnabled && dockerStatus?.port) {
      const port = Number(String(dockerStatus.port).replace(/[^0-9]/g, ""));
      const url = `http://localhost:${port}`;
      window.open(url, "_blank");
    }
  };

  // Track window width
  useEffect(() => {
    // Set initial width on client
    setWindowWidth(window.innerWidth);

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const selectPanel = (panel: PreviewMode) => {
    if (previewMode === panel) {
      setIsPreviewOpen(!isPreviewOpen);
    } else {
      setPreviewMode(panel);
      setIsPreviewOpen(true);
    }
  };

  const onCleanRestart = useCallback(() => {
    restartApp({ removeNodeModules: true });
  }, [restartApp]);

  const useClearSessionData = () => {
    return useMutation({
      mutationFn: () => {
        const ipcClient = IpcClient.getInstance();
        return (ipcClient as any).clearSessionData();
      },
      onSuccess: async () => {
        await refreshAppIframe();
        showSuccess("Preview data cleared");
      },
      onError: (error) => {
        showError(`Error clearing preview data: ${error}`);
      },
    });
  };

  const { mutate: clearSessionData } = useClearSessionData();

  const onClearSessionData = useCallback(() => {
    clearSessionData();
  }, [clearSessionData]);

  // Get the problem count for the selected app
  const problemCount = problemReport ? problemReport.problems.length : 0;

  // Format the problem count for display
  const formatProblemCount = (count: number): string => {
    if (count === 0) return "";
    if (count > 100) return "100+";
    return count.toString();
  };

  const displayCount = formatProblemCount(problemCount);

  // Update indicator position when mode changes
  useEffect(() => {
    const updateIndicator = () => {
      let targetRef: React.RefObject<HTMLButtonElement | null>;

      switch (previewMode) {
        case "preview":
          targetRef = previewRef;
          break;
        case "code":
          targetRef = codeRef;
          break;
        case "problems":
          targetRef = problemsRef;
          break;
        case "configure":
          targetRef = configureRef;
          break;
        case "publish":
          targetRef = publishRef;
          break;
        case "security":
          targetRef = securityRef;
          break;
        default:
          return;
      }

      if (targetRef.current) {
        const button = targetRef.current;
        const container = button.parentElement;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const buttonRect = button.getBoundingClientRect();
          const left = buttonRect.left - containerRect.left;
          const width = buttonRect.width;

          setIndicatorStyle({ left, width });
          if (!isPreviewOpen) {
            setIndicatorStyle({ left: left, width: 0 });
          }
        }
      }
    };

    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(updateIndicator, SHORT_ANIMATION_DELAY);
    return () => clearTimeout(timeoutId);
  }, [previewMode, displayCount, isPreviewOpen, isCompact]);

  const renderButton = (
    mode: PreviewMode,
    ref: React.RefObject<HTMLButtonElement | null>,
    icon: React.ReactNode,
    text: string,
    testId: string,
    badge?: React.ReactNode,
    isDisabled?: boolean,
    onClickOverride?: () => void,
  ) => {
    const buttonContent = (
      <button
        data-testid={testId}
        ref={ref}
        className={`no-app-region-drag cursor-pointer relative flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-medium z-10 hover:bg-[var(--background)] flex-col ${
          isDisabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
        onClick={() => {
          if (onClickOverride) {
            onClickOverride();
          } else {
            selectPanel(mode);
          }
        }}
        disabled={isDisabled}
        title={isDisabled ? "App must be running and ready to publish" : ""}
      >
        {icon}
        <span>
          {!isCompact && <span>{text}</span>}
          {badge}
        </span>
      </button>
    );

    if (isCompact) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
          <TooltipContent>
            <p>{text}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return buttonContent;
  };
  const iconSize = 15;

  return (
    <TooltipProvider>
      <div className="flex items-center justify-between px-1 py-2 mt-1 border-b border-border">
        <div className="relative flex rounded-md p-0.5 gap-0.5">
          <motion.div
            className="absolute top-0.5 bottom-0.5 bg-[var(--background-lightest)] shadow rounded-md"
            animate={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
            }}
            transition={{
              type: "spring",
              stiffness: 600,
              damping: 35,
              mass: 0.6,
            }}
          />
          {renderButton(
            "preview",
            previewRef,
            <Eye size={iconSize} />,
            "Preview",
            "preview-mode-button",
          )}
          {/* Problems button disabled - As of now this feature is disabled */}
          {renderButton(
            "problems",
            problemsRef,
            <AlertTriangle size={iconSize} />,
            "Problems",
            "problems-mode-button",
            displayCount && (
              <span className="ml-0.5 px-1 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full min-w-[16px] text-center">
                {displayCount}
              </span>
            ),
            true, // Disabled
          )}
          {renderButton(
            "code",
            codeRef,
            <Code size={iconSize} />,
            "Code",
            "code-mode-button",
          )}
          {/* Configure button disabled - As of now this feature is disabled */}
          {renderButton(
            "configure",
            configureRef,
            <Wrench size={iconSize} />,
            "Configure",
            "configure-mode-button",
            undefined,
            true, // Disabled
          )}
          {/* Security button disabled - As of now this feature is disabled */}
          {renderButton(
            "security",
            securityRef,
            <Shield size={iconSize} />,
            "Security",
            "security-mode-button",
            undefined,
            true, // Disabled
          )}
          {renderButton(
            "publish",
            publishRef,
            <Globe size={iconSize} />,
            "Publish",
            "publish-mode-button",
            undefined,
            !isPublishEnabled,
            isPublishEnabled ? handlePublishClick : undefined,
          )}
        </div>
        {/* Chat activity bell and more options disabled - As of now these features are disabled */}
        <div className="flex items-center gap-1 opacity-50 pointer-events-none">
          <ChatActivityButton />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="preview-more-options-button"
                className="no-app-region-drag flex items-center justify-center p-1.5 rounded-md text-sm hover:bg-[var(--background-darkest)] transition-colors"
                title="More options"
                disabled
              >
                <MoreVertical size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem
                onClick={isPublishEnabled ? onCleanRestart : undefined}
                disabled={!isPublishEnabled}
              >
                <Cog size={16} />
                <div className="flex flex-col">
                  <span>Rebuild</span>
                  <span className="text-xs text-muted-foreground">
                    Re-installs node_modules and restarts
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onClearSessionData}>
                <Trash2 size={16} />
                <div className="flex flex-col">
                  <span>Clear Cache</span>
                  <span className="text-xs text-muted-foreground">
                    Clears cookies and local storage and other app cache
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TooltipProvider>
  );
};
