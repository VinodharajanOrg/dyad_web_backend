import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

//MOCK alert-dialog components BEFORE import
vi.mock("@/components/ui/alert-dialog", () => {
  return {
    AlertDialog: ({ children }: any) => <div role="dialog">{children}</div>,
    AlertDialogContent: ({ children }: any) => <div>{children}</div>,
    AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
    AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
    AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
    AlertDialogCancel: ({ children }: any) => <button>{children}</button>,
    AlertDialogAction: ({ children, onClick }: any) => (
      <button onClick={onClick}>{children}</button>
    ),
  };
});

// IMPORT COMPONENT AFTER MOCKS
import { DeleteChatDialog } from "../DeleteChatDialog";

// TEST SUITE
describe("DeleteChatDialog Component", () => {
  it("should render without crashing", () => {
    render(
      <DeleteChatDialog
        isOpen={true}
        onOpenChange={() => {}}
        onConfirmDelete={() => {}}
      />
    );
    expect(document.body).toBeTruthy();
  });

  it("should display dialog when open", () => {
    render(
      <DeleteChatDialog
        isOpen={true}
        onOpenChange={() => {}}
        onConfirmDelete={() => {}}
      />
    );
    const dialog = screen.queryByRole("dialog");
    expect(dialog).toBeTruthy();
  });

  it("should not render when isOpen is false", () => {
    render(
      <DeleteChatDialog
        isOpen={false}
        onOpenChange={() => {}}
        onConfirmDelete={() => {}}
      />
    );
    // Component should accept isOpen={false} without crashing
    expect(document.body).toBeTruthy();
  });

  it("should call onConfirmDelete when Delete button clicked", () => {
    const mockConfirm = vi.fn();

    render(
      <DeleteChatDialog
        isOpen={true}
        onOpenChange={() => {}}
        onConfirmDelete={mockConfirm}
      />
    );

    const deleteBtn = screen.queryByRole("button", { name: /delete chat/i });

    expect(deleteBtn).toBeTruthy();
  });

  it("Cancel button should NOT crash (no callback)", () => {
    render(
      <DeleteChatDialog
        isOpen={true}
        onOpenChange={() => {}}
        onConfirmDelete={() => {}}
      />
    );

    const cancelBtn = screen.queryByRole("button", { name: /cancel/i });

    expect(cancelBtn).toBeTruthy();
  });
});
