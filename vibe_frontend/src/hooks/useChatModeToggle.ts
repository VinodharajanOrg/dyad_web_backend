import { useCallback, useMemo } from "react";
import { useAtom } from "jotai";
import { selectedChatModeAtom } from "@/atoms/chatAtoms";
import { useShortcut } from "./useShortcut";
import { usePostHog } from "posthog-js/react";
import { ChatModeSchema } from "../lib/schemas";

export function useChatModeToggle() {
  const [selectedChatMode, setSelectedChatMode] = useAtom(selectedChatModeAtom);
  const posthog = usePostHog();

  // Detect if user is on mac
  const isMac = useIsMac();

  // Memoize the modifiers object to prevent re-registration
  const modifiers = useMemo(
    () => ({
      ctrl: !isMac,
      meta: isMac,
    }),
    [isMac],
  );

  // Function to toggle between ask and build chat modes
  const toggleChatMode = useCallback(() => {
    if (!selectedChatMode) return;

    const modes = ChatModeSchema.options;
    const currentIndex = modes.indexOf(selectedChatMode);
    const newMode = modes[(currentIndex + 1) % modes.length];

    setSelectedChatMode(newMode);
    posthog.capture("chat:mode_toggle", {
      from: selectedChatMode,
      to: newMode,
      trigger: "keyboard_shortcut",
    });
  }, [selectedChatMode, setSelectedChatMode, posthog]);

  // Add keyboard shortcut with memoized modifiers
  useShortcut(
    ".",
    modifiers,
    toggleChatMode,
    true, // Always enabled since we're not dependent on component selector
  );

  return { toggleChatMode, isMac };
}

// Add this function at the top
type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string;
  };
};

export function detectIsMac(): boolean {
  const nav = navigator as NavigatorWithUserAgentData;
  // Try modern API first
  if ("userAgentData" in nav && nav.userAgentData?.platform) {
    return nav.userAgentData.platform.toLowerCase().includes("mac");
  }

  // Fallback to user agent check
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}
// Export the utility function and hook for use elsewhere
export function useIsMac(): boolean {
  return useMemo(() => detectIsMac(), []);
}
