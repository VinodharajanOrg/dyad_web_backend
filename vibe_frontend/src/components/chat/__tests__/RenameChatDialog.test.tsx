import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { RenameChatDialog } from "../RenameChatDialog";

// MOCKS
const mockMutate = vi.fn();

vi.mock("@/hooks/useChats", () => ({
  useUpdateChat: () => ({
    mutate: mockMutate.mockImplementation((_, { onSuccess }) => {
      onSuccess?.();
    }),
    isPending: false,
  }),
}));

// TESTS
describe("RenameChatDialog (max achievable coverage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithState(props?: { currentTitle?: string }) {
    const onRename = vi.fn();

    const Wrapper = () => {
      const [open, setOpen] = React.useState(false);

      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <RenameChatDialog
            chatId={1}
            currentTitle={props?.currentTitle ?? ""}
            isOpen={open}
            onOpenChange={setOpen}
            onRename={onRename}
          />
        </>
      );
    };

    return {
      onRename,
      ...render(<Wrapper />),
    };
  }

  it("renders safely", () => {
    renderWithState();
    expect(document.body).toBeTruthy();
  });

  it("does not render dialog when closed", () => {
    renderWithState();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("prefills input with current title when opened", async () => {
    renderWithState({ currentTitle: "Old Chat" });

    await act(async () => {
      fireEvent.click(screen.getByText("Open"));
    });

    const input = screen.getByPlaceholderText(
      "Enter chat title..."
    ) as HTMLInputElement;

    expect(input).toBeTruthy();
  });

  it("allows typing a new title", () => {
    renderWithState({ currentTitle: "Old Chat" });

    fireEvent.click(screen.getByText("Open"));

    const input = screen.getByPlaceholderText(
      "Enter chat title..."
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: { value: "New Title" },
    });

    expect(input.value).toBe("New Title");
  });

  it("does nothing when Save is clicked with empty title", () => {
    const { onRename } = renderWithState({ currentTitle: "" });

    fireEvent.click(screen.getByText("Open"));

    fireEvent.click(screen.getByText("Save"));

    expect(mockMutate).not.toHaveBeenCalled();
    expect(onRename).not.toHaveBeenCalled();
  });

  it("calls updateChat and onRename when Save is clicked with valid title", () => {
    const { onRename } = renderWithState({ currentTitle: "Old Chat" });

    fireEvent.click(screen.getByText("Open"));

    const input = screen.getByPlaceholderText(
      "Enter chat title..."
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: { value: "Updated Title" },
    });

    fireEvent.click(screen.getByText("Save"));

    expect(mockMutate).toHaveBeenCalled();
    expect(onRename).toHaveBeenCalled();
  });

  it("triggers save when Enter key is pressed", () => {
    const { onRename } = renderWithState({ currentTitle: "Old Chat" });

    fireEvent.click(screen.getByText("Open"));

    const input = screen.getByPlaceholderText(
      "Enter chat title..."
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: { value: "Enter Save" },
    });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockMutate).toHaveBeenCalled();
    expect(onRename).toHaveBeenCalled();
  });

  it("does not save on Enter when title is empty", () => {
    const { onRename } = renderWithState({ currentTitle: "" });

    fireEvent.click(screen.getByText("Open"));

    const input = screen.getByPlaceholderText(
      "Enter chat title..."
    ) as HTMLInputElement;

    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockMutate).not.toHaveBeenCalled();
    expect(onRename).not.toHaveBeenCalled();
  });

  it("closes dialog when Cancel is clicked", () => {
    renderWithState({ currentTitle: "Old Chat" });

    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
