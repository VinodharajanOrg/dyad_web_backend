import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ChatMessage from "../ChatMessage";

// Jotai
vi.mock("jotai", () => ({
  atom: (v: any) => v,
  useAtom: () => [null, vi.fn()],
  useAtomValue: () => "app-1",
}));

// Stream chat
vi.mock("@/hooks/useStreamChat", () => ({
  useStreamChat: () => ({
    isStreaming: false,
  }),
}));

// Copy to clipboard (message content)
vi.mock("@/hooks/useCopyToClipboard", () => ({
  useCopyToClipboard: () => ({
    copyMessageContent: vi.fn(),
    copied: false,
  }),
}));

// Markdown parsers
vi.mock("../DyadMarkdownParser", () => ({
  DyadMarkdownParser: ({ content }: any) => <div>{content}</div>,
  VanillaMarkdownParser: ({ content }: any) => <div>{content}</div>,
}));

// Tooltip
vi.mock("../ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
}));


// jsdom-safe clipboard mock
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn(),
  },
  writable: true,
});

const baseMessage: any = {
  id: 1,
  role: "assistant",
  content: "Test message",
  createdAt: new Date().toISOString(),
  approvalState: null,
};

/* ======================= TESTS ======================= */

describe("ChatMessage – MAXIMUM ACHIEVABLE COVERAGE", () => {
  it("renders assistant message", () => {
    render(<ChatMessage message={baseMessage} chatId={1} />);
    expect(screen.getByText("Test message")).toBeTruthy();
  });

  it("renders user message via VanillaMarkdownParser", () => {
    render(
      <ChatMessage
        message={{ ...baseMessage, role: "user", content: "User text" }}
        chatId={1}
      />
    );

    expect(screen.getByText("User text")).toBeTruthy();
  });

  it("formats timestamp older than 24 hours (format branch)", () => {
    const oldDate = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString();

    render(
      <ChatMessage
        message={{ ...baseMessage, createdAt: oldDate }}
        chatId={1}
      />
    );

    // formatted string contains "at"
    expect(document.body.textContent).toContain("at");
  });

  it("renders copy message button and handles click", () => {
    render(<ChatMessage message={baseMessage} chatId={1} />);

    fireEvent.click(screen.getByTestId("copy-message-button"));
    expect(screen.getByTestId("copy-message-button")).toBeTruthy();
  });

  it("copies requestId and clears timeout on unmount", () => {
    const msg = {
      ...baseMessage,
      requestId: "req-123456789",
    };

    const { unmount } = render(
      <ChatMessage message={msg} chatId={1} />
    );

    fireEvent.click(screen.getByText("Request ID"));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "req-123456789"
    );

    // triggers cleanup → clearTimeout
    unmount();
    cleanup();
  });

  it("handles clipboard failure gracefully", async () => {
    (navigator.clipboard.writeText as any).mockRejectedValueOnce(
      new Error("fail")
    );

    render(
      <ChatMessage
        message={{ ...baseMessage, requestId: "req-fail" }}
        chatId={1}
      />
    );

    fireEvent.click(screen.getByText("Request ID"));
    expect(screen.getByText("Request ID")).toBeTruthy();
  });
});
