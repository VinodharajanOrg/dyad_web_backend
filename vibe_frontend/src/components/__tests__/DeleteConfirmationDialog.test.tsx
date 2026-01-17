import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";

//UI mocks — alert-dialog
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: any) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: any) => <div>{children}</div>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: any) => (
    <button>{children}</button>
  ),
  AlertDialogAction: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

// UI mocks — button
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

// UI mocks — tooltip
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

// icons
vi.mock("lucide-react", () => ({
  Trash2: () => <span data-icon="trash" />,
}));

// component
import { DeleteConfirmationDialog } from "../DeleteConfirmationDialog";

// tests
describe("DeleteConfirmationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders default trigger button with tooltip", () => {
    const { container, getAllByText } = render(
      <DeleteConfirmationDialog
        itemName="Test Item"
        onDelete={vi.fn()}
      />
    );

    expect(container.querySelector('[data-icon="trash"]')).toBeTruthy();

    // multiple occurrences are valid
    expect(getAllByText("Delete item").length).toBeTruthy();
  });

  it("renders custom trigger when provided", () => {
    const { getByText } = render(
      <DeleteConfirmationDialog
        itemName="File A"
        onDelete={vi.fn()}
        trigger={<button>Custom Trigger</button>}
      />
    );

    expect(getByText("Custom Trigger")).toBeTruthy();
  });

  it("renders dialog title and description with item name and type", () => {
    const { getByText } = render(
      <DeleteConfirmationDialog
        itemName="My Prompt"
        itemType="Prompt"
        onDelete={vi.fn()}
      />
    );

    expect(getByText("Delete Prompt")).toBeTruthy();
    expect(
      getByText(
        'Are you sure you want to delete "My Prompt"? This action cannot be undone.'
      )
    ).toBeTruthy();
  });

  it("calls onDelete when Delete action is clicked", () => {
    const onDelete = vi.fn();

    const { getByText } = render(
      <DeleteConfirmationDialog
        itemName="To Remove"
        onDelete={onDelete}
      />
    );

    fireEvent.click(getByText("Delete"));

    expect(onDelete).toHaveBeenCalled();
  });

  it("renders Cancel button", () => {
    const { getByText } = render(
      <DeleteConfirmationDialog
        itemName="Cancelable"
        onDelete={vi.fn()}
      />
    );

    expect(getByText("Cancel")).toBeTruthy();
  });
});
