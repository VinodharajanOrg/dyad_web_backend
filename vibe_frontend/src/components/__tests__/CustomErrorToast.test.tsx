import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";

// sonner toast
const dismissSpy = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    dismiss: (id: any) => dismissSpy(id),
  },
}));

// lucide-react icons
vi.mock("lucide-react", () => ({
  X: () => <span data-icon="x" />,
  Copy: () => <span data-icon="copy" />,
  Check: () => <span data-icon="check" />,
}));

// component
import { CustomErrorToast } from "../CustomErrorToast";

// tests
describe("CustomErrorToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders error message", () => {
    const { getByText } = render(
      <CustomErrorToast message="Something went wrong" toastId="1" />
    );

    expect(getByText("Error")).toBeTruthy();
    expect(getByText("Something went wrong")).toBeTruthy();
  });

  it("calls onCopy when copy button is clicked", () => {
    const onCopy = vi.fn();

    const { container } = render(
      <CustomErrorToast
        message="Copy this"
        toastId="1"
        onCopy={onCopy}
      />
    );

    const copyButton = container.querySelector(
      'button[title="Copy to clipboard"]'
    )!;

    fireEvent.click(copyButton);

    expect(onCopy).toHaveBeenCalled();
  });

  it("does not throw when onCopy is undefined", () => {
    const { container } = render(
      <CustomErrorToast message="No copy" toastId="1" />
    );

    const copyButton = container.querySelector(
      'button[title="Copy to clipboard"]'
    )!;

    fireEvent.click(copyButton);

    expect(dismissSpy).not.toHaveBeenCalled();
  });

  it("shows check icon when copied is true", () => {
    const { container } = render(
      <CustomErrorToast
        message="Copied"
        toastId="1"
        copied
      />
    );

    expect(container.querySelector('[data-icon="check"]')).toBeTruthy();
  });

  it("dismisses toast when close button is clicked", () => {
    const { container } = render(
      <CustomErrorToast message="Close me" toastId="toast-123" />
    );

    const closeButton = container.querySelector(
      'button[title="Close"]'
    )!;

    fireEvent.click(closeButton);

    expect(dismissSpy).toHaveBeenCalledWith("toast-123");
  });
});
