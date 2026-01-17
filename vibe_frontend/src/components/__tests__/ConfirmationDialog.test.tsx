import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import ConfirmationDialog from "../ConfirmationDialog";

describe("ConfirmationDialog", () => {
  it("returns null when isOpen is false", () => {
    const { container } = render(
      <ConfirmationDialog
        isOpen={false}
        title="Title"
        message="Message"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders dialog with title and message when open", () => {
    const { getByText } = render(
      <ConfirmationDialog
        isOpen
        title="Delete item"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(getByText("Delete item")).toBeTruthy();
    expect(getByText("Are you sure?")).toBeTruthy();
  });

  it("uses default confirm and cancel button texts", () => {
    const { getByText } = render(
      <ConfirmationDialog
        isOpen
        title="Title"
        message="Message"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(getByText("Confirm")).toBeTruthy();
    expect(getByText("Cancel")).toBeTruthy();
  });

  it("uses custom confirm and cancel texts", () => {
    const { getByText } = render(
      <ConfirmationDialog
        isOpen
        title="Title"
        message="Message"
        confirmText="Yes"
        cancelText="No"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(getByText("Yes")).toBeTruthy();
    expect(getByText("No")).toBeTruthy();
  });

  it("calls onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn();

    const { getByText } = render(
      <ConfirmationDialog
        isOpen
        title="Title"
        message="Message"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();

    const { getByText } = render(
      <ConfirmationDialog
        isOpen
        title="Title"
        message="Message"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel when backdrop is clicked", () => {
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmationDialog
        isOpen
        title="Title"
        message="Message"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    const backdrop = container.querySelector(".bg-gray-500");
    expect(backdrop).toBeTruthy();

    fireEvent.click(backdrop as HTMLElement);
    expect(onCancel).toHaveBeenCalled();
  });

  it("applies custom confirm button class", () => {
    const { getByText } = render(
      <ConfirmationDialog
        isOpen
        title="Title"
        message="Message"
        confirmButtonClass="custom-class"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const confirmButton = getByText("Confirm");
    expect(confirmButton.className.includes("custom-class")).toBeTruthy();
  });
});
