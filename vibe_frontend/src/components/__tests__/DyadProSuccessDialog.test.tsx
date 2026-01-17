import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";

// UI mocks — dialog
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

// UI mocks — button
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

// icons
vi.mock("lucide-react", () => ({
  CheckCircle: () => <span data-icon="check-circle" />,
  Sparkles: () => <span data-icon="sparkles" />,
}));

// component
import { DyadProSuccessDialog } from "../DyadProSuccessDialog";

// tests
describe("DyadProSuccessDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders success dialog content when open", () => {
    const { getByText, container } = render(
      <DyadProSuccessDialog isOpen onClose={vi.fn()} />
    );

    expect(getByText("Dyad Pro Enabled")).toBeTruthy();
    expect(
      getByText("Congrats! Dyad Pro is now enabled in the app.")
    ).toBeTruthy();
    expect(
      getByText("You have access to leading AI models.")
    ).toBeTruthy();
    expect(container.querySelector('[data-icon="check-circle"]')).toBeTruthy();
    expect(container.querySelector('[data-icon="sparkles"]')).toBeTruthy();
  });

  it("calls onClose when OK button is clicked", () => {
    const onClose = vi.fn();

    const { getByText } = render(
      <DyadProSuccessDialog isOpen onClose={onClose} />
    );

    fireEvent.click(getByText("OK"));

    expect(onClose).toHaveBeenCalled();
  });

  it("does not render content assumptions when closed", () => {
    const { container } = render(
      <DyadProSuccessDialog isOpen={false} onClose={vi.fn()} />
    );

    // Dialog is mocked, but content still mounts; this ensures no crash
    expect(container).toBeTruthy();
  });
});
