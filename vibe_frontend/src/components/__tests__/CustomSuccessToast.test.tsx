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
  CheckCircle2: () => <span data-icon="success" />,
  X: () => <span data-icon="x" />,
}));

// component
import { CustomSuccessToast } from "../CustomSuccessToast";

// tests
describe("CustomSuccessToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders success title and message", () => {
    const { getByText } = render(
      <CustomSuccessToast message="Operation successful" toastId="1" />
    );

    expect(getByText("Success")).toBeTruthy();
    expect(getByText("Operation successful")).toBeTruthy();
  });

  it("renders success icon", () => {
    const { container } = render(
      <CustomSuccessToast message="Icon check" toastId="1" />
    );

    expect(container.querySelector('[data-icon="success"]')).toBeTruthy();
  });

  it("dismisses toast when close button is clicked", () => {
    const { container } = render(
      <CustomSuccessToast message="Close me" toastId="toast-99" />
    );

    const closeButton = container.querySelector(
      'button[title="Close"]'
    )!;

    fireEvent.click(closeButton);

    expect(dismissSpy).toHaveBeenCalledWith("toast-99");
  });

  it("stops propagation on close click", () => {
    const parentClick = vi.fn();

    const { container } = render(
      <div onClick={parentClick}>
        <CustomSuccessToast message="Stop propagation" toastId="1" />
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
