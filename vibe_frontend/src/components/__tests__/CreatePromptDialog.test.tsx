import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import React from "react";

//FORCE Dialog ALWAYS OPEN (CRITICAL FIX)
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

// UI mocks
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: React.forwardRef((props: any, ref: any) => (
    <textarea ref={ref} {...props} />
  )),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Plus: () => <span />,
  Save: () => <span />,
  Edit2: () => <span />,
}));

// components
import {
  CreateOrEditPromptDialog,
  CreatePromptDialog,
} from "../CreatePromptDialog";

// helpers
const fillForm = async (
  container: HTMLElement,
  title = "Title",
  content = "Content"
) => {
  await act(async () => {
    fireEvent.change(
      container.querySelector('input[placeholder="Title"]')!,
      { target: { value: title } }
    );
    fireEvent.change(
      container.querySelector('textarea[placeholder="Content"]')!,
      { target: { value: content } }
    );
  });
};

const clickSave = async (container: HTMLElement) => {
  await act(async () => {
    fireEvent.click(
      [...container.querySelectorAll("button")].find(
        (b) => b.textContent?.includes("Save")
      )!
    );
    await Promise.resolve();
  });
};

//TESTS
describe("CreateOrEditPromptDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders create mode with default trigger", () => {
    const { getByText } = render(
      <CreateOrEditPromptDialog mode="create" />
    );

    expect(getByText("New Prompt")).toBeTruthy();
  });

  it("creates prompt successfully", async () => {
    const createSpy = vi.fn().mockResolvedValueOnce(undefined);

    const { container } = render(
      <CreateOrEditPromptDialog
        mode="create"
        onCreatePrompt={createSpy}
        isOpen
      />
    );

    await fillForm(container);
    await clickSave(container);

    expect(createSpy).toHaveBeenCalled();
  });

  it("does not save when title is empty", async () => {
    const createSpy = vi.fn();

    const { container } = render(
      <CreateOrEditPromptDialog
        mode="create"
        onCreatePrompt={createSpy}
        isOpen
      />
    );

    await act(async () => {
      fireEvent.change(
        container.querySelector('textarea[placeholder="Content"]')!,
        { target: { value: "Content" } }
      );
    });

    await clickSave(container);

    expect(createSpy).not.toHaveBeenCalled();
  });

  it("renders edit mode and updates prompt", async () => {
    const updateSpy = vi.fn().mockResolvedValueOnce(undefined);

    const prompt = {
      id: 1,
      title: "Old",
      description: "Desc",
      content: "Old content",
    };

    const { container, getByText } = render(
      <CreateOrEditPromptDialog
        mode="edit"
        prompt={prompt}
        onUpdatePrompt={updateSpy}
        isOpen
      />
    );

    expect(getByText("Edit Prompt")).toBeTruthy();

    await fillForm(container, "New title", "New content");
    await clickSave(container);

    expect(updateSpy).toHaveBeenCalled();
  });

  it("cancel resets draft and closes", async () => {
    const onOpenChange = vi.fn();

    const { container, getByText } = render(
      <CreateOrEditPromptDialog
        mode="create"
        isOpen
        onOpenChange={onOpenChange}
      />
    );

    await act(async () => {
      fireEvent.change(
        container.querySelector('input[placeholder="Title"]')!,
        { target: { value: "X" } }
      );
    });

    fireEvent.click(getByText("Cancel"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("CreatePromptDialog wrapper works", () => {
    const createSpy = vi.fn();

    const { getByText } = render(
      <CreatePromptDialog onCreatePrompt={createSpy} isOpen />
    );

    expect(getByText("Create New Prompt")).toBeTruthy();
  });
});
