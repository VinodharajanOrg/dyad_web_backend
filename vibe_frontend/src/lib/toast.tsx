"use client";
import { toast } from "sonner";
import { PostHog } from "posthog-js";
import React from "react";
import { CustomErrorToast } from "../components/CustomErrorToast";
import { CustomSuccessToast } from "../components/CustomSuccessToast";
import { CustomWarningToast } from "../components/CustomWarningToast";
import { CustomInfoToast } from "../components/CustomInfoToast";
import { InputRequestToast } from "../components/InputRequestToast";
import { McpConsentToast } from "../components/McpConsentToast";

/**
 * Toast utility functions for consistent notifications across the app
 * Toasts stack vertically when multiple are shown together
 */

/**
 * Show a success toast
 * @param message The message to display
 * @param duration Duration in milliseconds (default: 5000)
 */
export const showSuccess = (message: string, duration: number = 5000) => {
  const toastId = toast.custom(
    (t) => <CustomSuccessToast message={message} toastId={t} />,
    { duration },
  );
  return toastId;
};

/**
 * Show an error toast
 * @param message The error message to display
 */
export const showError = (message: any) => {
  const errorMessage = message.toString();
  console.error(message);

  const onCopy = (toastId: string | number) => {
    navigator.clipboard.writeText(errorMessage);

    // Update the toast to show the 'copied' state
    toast.custom(
      (t) => (
        <CustomErrorToast
          message={errorMessage}
          toastId={t}
          copied={true}
          onCopy={() => onCopy(t)}
        />
      ),
      { id: toastId, duration: Infinity },
    );

    // After 2 seconds, revert the toast back to the original state
    setTimeout(() => {
      toast.custom(
        (t) => (
          <CustomErrorToast
            message={errorMessage}
            toastId={t}
            copied={false}
            onCopy={() => onCopy(t)}
          />
        ),
        { id: toastId, duration: Infinity },
      );
    }, 2000);
  };

  // Use custom error toast with enhanced features
  const toastId = toast.custom(
    (t) => (
      <CustomErrorToast
        message={errorMessage}
        toastId={t}
        onCopy={() => onCopy(t)}
      />
    ),
    { duration: 8_000 },
  );

  return toastId;
};

/**
 * Show a warning toast
 * @param message The warning message to display
 * @param duration Duration in milliseconds (default: 5000)
 */
export const showWarning = (message: string, duration: number = 5000) => {
  console.warn(message);
  const toastId = toast.custom(
    (t) => <CustomWarningToast message={message} toastId={t} />,
    { duration },
  );
  return toastId;
};

/**
 * Show an info toast
 * @param message The info message to display
 * @param duration Duration in milliseconds (default: 5000)
 */
export const showInfo = (message: string, duration: number = 5000) => {
  const toastId = toast.custom(
    (t) => <CustomInfoToast message={message} toastId={t} />,
    { duration },
  );
  return toastId;
};

/**
 * Show an input request toast for interactive prompts (y/n)
 * @param message The prompt message to display
 * @param onResponse Callback function called when user responds
 */
export const showInputRequest = (
  message: string,
  onResponse: (response: "y" | "n") => void,
) => {
  const toastId = toast.custom(
    (t) => (
      <InputRequestToast
        message={message}
        toastId={t}
        onResponse={onResponse}
      />
    ),
    { duration: Infinity }, // Don't auto-close
  );

  return toastId;
};

export function showMcpConsentToast(args: {
  serverName: string;
  toolName: string;
  toolDescription?: string | null;
  inputPreview?: string | null;
  onDecision: (d: "accept-once" | "accept-always" | "decline") => void;
}) {
  const toastId = toast.custom(
    (t) => (
      <McpConsentToast
        toastId={t}
        serverName={args.serverName}
        toolName={args.toolName}
        toolDescription={args.toolDescription}
        inputPreview={args.inputPreview}
        onDecision={args.onDecision}
      />
    ),
    { duration: Infinity },
  );
  return toastId;
}

export const showExtraFilesToast = ({
  files,
  error,
  posthog,
}: {
  files: string[];
  error?: string;
  posthog: PostHog;
}) => {
  if (error) {
    showError(
      `Error committing files ${files.join(", ")} changed outside of Dyad: ${error}`,
    );
    posthog.capture("extra-files:error", {
      files: files,
      error,
    });
  } else {
    showWarning(
      `Files changed outside of Dyad have automatically been committed:
    \n\n${files.join("\n")}`,
    );
    posthog.capture("extra-files:warning", {
      files: files,
    });
  }
};

// Re-export for direct use
export { toast };
