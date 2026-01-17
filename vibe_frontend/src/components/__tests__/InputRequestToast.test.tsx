import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// HOIST-SAFE MOCK STATE
const hoisted = vi.hoisted(() => ({
  dismissMock: vi.fn(),
}));

// sonner toast (HOIST SAFE)
vi.mock("sonner", () => ({
  toast: {
    dismiss: hoisted.dismissMock,
  },
}));

// lucide-react icons
vi.mock("lucide-react", () => ({
  X: () => <span data-icon="x" />,
  AlertTriangle: () => <span data-icon="alert" />,
}));

// Button (shadcn)
vi.mock("./ui/button", () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

//Component under test (IMPORT AFTER MOCKS)
import { InputRequestToast } from "../InputRequestToast";

describe("InputRequestToast", () => {
  const toastId = "toast-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders cleaned message", () => {
    render(
      <InputRequestToast
        toastId={toastId}
        message={`  Line 1 \n\n Line 2 \n   \nLine 3 `}
        onResponse={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        (content) =>
          content.includes("Line 1") &&
          content.includes("Line 2") &&
          content.includes("Line 3")
      )
    ).toBeTruthy();

    expect(screen.getByText("Input Required")).toBeTruthy();
    expect(screen.getByText("Yes")).toBeTruthy();
    expect(screen.getByText("No")).toBeTruthy();
  });

  it("calls onResponse('y') and dismisses toast when Yes is clicked", () => {
    const onResponse = vi.fn();

    render(
      <InputRequestToast
        toastId={toastId}
        message="Confirm?"
        onResponse={onResponse}
      />
    );

    fireEvent.click(screen.getByText("Yes"));

    expect(onResponse).toHaveBeenCalledWith("y");
    expect(hoisted.dismissMock).toHaveBeenCalledWith(toastId);
  });

  it("calls onResponse('n') and dismisses toast when No is clicked", () => {
    const onResponse = vi.fn();

    render(
      <InputRequestToast
        toastId={toastId}
        message="Confirm?"
        onResponse={onResponse}
      />
    );

    fireEvent.click(screen.getByText("No"));

    expect(onResponse).toHaveBeenCalledWith("n");
    expect(hoisted.dismissMock).toHaveBeenCalledWith(toastId);
  });

  it("dismisses toast when close button is clicked", () => {
    render(
      <InputRequestToast
        toastId={toastId}
        message="Close me"
        onResponse={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("Close"));

    expect(hoisted.dismissMock).toHaveBeenCalledWith(toastId);
  });
});
