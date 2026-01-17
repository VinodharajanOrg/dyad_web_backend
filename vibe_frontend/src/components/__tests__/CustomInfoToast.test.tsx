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
  Info: () => <span data-icon="info" />,
  X: () => <span data-icon="x" />,
}));

// component
import { CustomInfoToast } from "../CustomInfoToast";

// tests
describe("CustomInfoToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders info title and message", () => {
    const { getByText } = render(
      <CustomInfoToast message="Information message" toastId="1" />
    );

    expect(getByText("Info")).toBeTruthy();
    expect(getByText("Information message")).toBeTruthy();
  });

  it("renders info icon", () => {
    const { container } = render(
      <CustomInfoToast message="Info icon" toastId="1" />
    );

    expect(container.querySelector('[data-icon="info"]')).toBeTruthy();
  });

  it("dismisses toast when close button is clicked", () => {
    const { container } = render(
      <CustomInfoToast message="Close me" toastId="toast-42" />
    );

    const closeButton = container.querySelector(
      'button[title="Close"]'
    )!;

    fireEvent.click(closeButton);

    expect(dismissSpy).toHaveBeenCalledWith("toast-42");
  });

  it("stops propagation on close click", () => {
    const parentClick = vi.fn();

    const { container } = render(
      <div onClick={parentClick}>
        <CustomInfoToast message="Stop propagation" toastId="1" />
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
