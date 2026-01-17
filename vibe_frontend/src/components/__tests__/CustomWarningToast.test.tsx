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
  AlertCircle: () => <span data-icon="warning" />,
  X: () => <span data-icon="x" />,
}));

// component
import { CustomWarningToast } from "../CustomWarningToast";

// tests
describe("CustomWarningToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders warning title and message", () => {
    const { getByText } = render(
      <CustomWarningToast message="Be careful!" toastId="1" />
    );

    expect(getByText("Warning")).toBeTruthy();
    expect(getByText("Be careful!")).toBeTruthy();
  });

  it("renders warning icon", () => {
    const { container } = render(
      <CustomWarningToast message="Icon check" toastId="1" />
    );

    expect(container.querySelector('[data-icon="warning"]')).toBeTruthy();
  });

  it("dismisses toast when close button is clicked", () => {
    const { container } = render(
      <CustomWarningToast message="Close me" toastId="toast-77" />
    );

    const closeButton = container.querySelector(
      'button[title="Close"]'
    )!;

    fireEvent.click(closeButton);

    expect(dismissSpy).toHaveBeenCalledWith("toast-77");
  });

  it("stops propagation on close click", () => {
    const parentClick = vi.fn();

    const { container } = render(
      <div onClick={parentClick}>
        <CustomWarningToast message="Stop propagation" toastId="1" />
      </div>
    );

    const closeButton = container.querySelector(
      'button[title="Close"]'
    )!;

    fireEvent.click(closeButton);

    expect(parentClick).not.toHaveBeenCalled();
    expect(dismissSpy).toHaveBeenCalled();
  });
});
