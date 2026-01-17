import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";

// IPC spies
const startHelpChatSpy = vi.fn();

// IPC client - must return object from getInstance
vi.mock("@/api/ipc_client", () => {
  return {
    IpcClient: {
      getInstance: vi.fn(() => ({
        startHelpChat: (...args: any[]) => startHelpChatSpy(...args),
      })),
    },
  };
});

// uuid
vi.mock("uuid", () => ({
  v4: () => "test-session-id",
}));

// Loading and Markdown component
vi.mock("@/components/LoadingBlock", () => ({
  LoadingBlock: ({ isStreaming }: any) =>
    isStreaming ? <div data-testid="loading" /> : null,
  VanillaMarkdownParser: ({ content }: any) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

// UI mocks
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

// component
import { HelpBotDialog } from "../HelpBotDialog";

// helpers
const sendMessage = async (container: HTMLElement, text = "Hello") => {
  await act(async () => {
    fireEvent.change(container.querySelector("input")!, {
      target: { value: text },
    });
  });

  await act(async () => {
    fireEvent.click(container.querySelector("button")!);
    await Promise.resolve();
  });
};

// tests
describe("HelpBotDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no messages", () => {
    const { getByText } = render(
      <HelpBotDialog isOpen onClose={vi.fn()} />
    );

    expect(
      getByText("Ask a question about using Dyad.")
    ).toBeTruthy();
  });

  it("sends a message and streams assistant response", async () => {
    startHelpChatSpy.mockImplementation(
      (_sessionId, _input, handlers) => {
        handlers.onChunk("Hi");
        handlers.onChunk(" there");
        handlers.onEnd();
      }
    );

    const { container, getByText, queryByTestId } = render(
      <HelpBotDialog isOpen onClose={vi.fn()} />
    );

    await sendMessage(container, "Hello");

    expect(startHelpChatSpy).toHaveBeenCalled();
    expect(getByText("Hello")).toBeTruthy();
    expect(getByText("Hi there")).toBeTruthy();
    expect(queryByTestId("loading")).toBeFalsy();
  });

  it("shows loading block while streaming", async () => {
    startHelpChatSpy.mockImplementation(
      (_sessionId, _input, handlers) => {
        handlers.onChunk("Streaming...");
      }
    );

    const { container, getByTestId } = render(
      <HelpBotDialog isOpen onClose={vi.fn()} />
    );

    await sendMessage(container, "Stream");

    expect(getByTestId("loading")).toBeTruthy();
  });

  it("handles error from IPC and shows error banner", async () => {
    startHelpChatSpy.mockImplementation(
      (_sessionId, _input, handlers) => {
        handlers.onError("Something went wrong");
      }
    );

    const { container, getByText } = render(
      <HelpBotDialog isOpen onClose={vi.fn()} />
    );

    await sendMessage(container, "Fail");

    expect(getByText("Error:")).toBeTruthy();
    expect(getByText("Something went wrong")).toBeTruthy();
  });

  it("clears state when dialog is closed", async () => {
    const { rerender, queryByText } = render(
      <HelpBotDialog isOpen onClose={vi.fn()} />
    );

    rerender(<HelpBotDialog isOpen={false} onClose={vi.fn()} />);

    expect(queryByText("Ask a question about using Dyad.")).toBeTruthy();
  });
});
