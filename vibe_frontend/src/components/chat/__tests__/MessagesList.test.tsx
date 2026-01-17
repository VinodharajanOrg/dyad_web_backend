import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

//GLOBAL MOCK STATE
let mockIsStreaming = false;
let mockIsAnyProviderSetup = true;
let mockIsProviderSetup = false;
let mockAtomValue: number | null = 1;

const mockSetMessagesById = vi.fn();
const mockMutateAsync = vi.fn();

// Hoisted mocks for toast
const { mockToastError, mockToastWarning } = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockToastWarning: vi.fn(),
}));

// Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Jotai
vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtomValue: () => mockAtomValue,
    useSetAtom: () => mockSetMessagesById,
  };
});

// Stream chat
vi.mock("@/hooks/useStreamChat", () => ({
  useStreamChat: () => ({
    isStreaming: mockIsStreaming,
    streamMessage: vi.fn(),
  }),
}));

// Settings
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: {
      selectedModel: { name: "free", provider: "auto" },
      enableDyadPro: false,
    },
  }),
}));

// Providers
vi.mock("@/hooks/useLanguageModelProviders", () => ({
  useLanguageModelProviders: () => ({
    isAnyProviderSetup: () => mockIsAnyProviderSetup,
    isProviderSetup: () => mockIsProviderSetup,
  }),
}));

// Budget
vi.mock("@/hooks/useUserBudgetInfo", () => ({
  useUserBudgetInfo: () => ({
    userBudget: null,
  }),
}));

// Delete chat messages
vi.mock("@/hooks/useChats", () => ({
  useDeleteChatMessages: () => ({
    mutateAsync: mockMutateAsync,
  }),
}));

// Toasts
vi.mock("@/lib/toast", () => ({
  showError: mockToastError,
  showWarning: mockToastWarning,
}));

// ChatMessage
vi.mock("../ChatMessage", () => ({
  default: ({ message }: any) => (
    <div data-testid="chat-message">{message.content}</div>
  ),
}));

// Setup banners
vi.mock("../SetupBanner", () => ({
  OpenRouterSetupBanner: () => <div>Setup OpenRouter API Key</div>,
  SetupBanner: () => <div />,
}));

//IMPORT AFTER MOCKS
import { MessagesList } from "../MessagesList";

//TESTS
describe("MessagesList (max achievable coverage)", () => {
  const messagesEndRef = {
    current: document.createElement("div"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsStreaming = false;
    mockIsAnyProviderSetup = true;
    mockIsProviderSetup = false;
    mockAtomValue = 1;
  });

  it("shows setup banner instead of empty state when providers are not set up", () => {
    mockIsAnyProviderSetup = false;

    render(<MessagesList messages={[]} messagesEndRef={messagesEndRef} />);

    expect(screen.queryByText("No messages yet")).toBeNull();
    expect(screen.getByText("Setup OpenRouter API Key")).toBeTruthy();
  });

  it("shows empty state when no messages and no setup banner", () => {
    mockIsAnyProviderSetup = true;
    mockIsProviderSetup = true;

    render(<MessagesList messages={[]} messagesEndRef={messagesEndRef} />);

    expect(screen.getByText("No messages yet")).toBeTruthy();
  });

  it("renders messages when provided", () => {
    render(
      <MessagesList
        messages={[{ id: "1", content: "Hello", role: "user", chatId: 1 }]}
        messagesEndRef={messagesEndRef}
      />
    );

    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("shows undo button for assistant message with commitHash", () => {
    render(
      <MessagesList
        messages={[
          { id: "1", content: "User", role: "user", chatId: 1 },
          {
            id: "2",
            content: "Assistant",
            role: "assistant",
            commitHash: "abc",
            chatId: 1,
          },
        ]}
        messagesEndRef={messagesEndRef}
      />
    );

    expect(screen.getByText("Undo")).toBeTruthy();
  });

  it("undo removes last two messages when previous assistant exists", async () => {
    render(
      <MessagesList
        messages={[
          {
            id: "1",
            content: "Assistant A",
            role: "assistant",
            commitHash: "a0",
            chatId: 1,
          },
          { id: "2", content: "User", role: "user", chatId: 1 },
          {
            id: "3",
            content: "Assistant B",
            role: "assistant",
            commitHash: "a1",
            chatId: 1,
          },
        ]}
        messagesEndRef={messagesEndRef}
      />
    );

    fireEvent.click(screen.getByText("Undo"));

    await waitFor(() => {
      expect(mockSetMessagesById).toHaveBeenCalled();
    });
  });

  it("undo clears messages when initialCommitHash exists and messages < 3", async () => {
    render(
      <MessagesList
        messages={[
          {
            id: "1",
            content: "Assistant",
            role: "assistant",
            commitHash: "init",
            chatId: 1,
          },
        ]}
        chatData={{ initialCommitHash: "init" }}
        messagesEndRef={messagesEndRef}
      />
    );

    fireEvent.click(screen.getByText("Undo"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(1);
      expect(mockSetMessagesById).toHaveBeenCalled();
    });
  });

  it("shows warning when undo is clicked without initialCommitHash", async () => {
    render(
      <MessagesList
        messages={[
          {
            id: "1",
            content: "Assistant",
            role: "assistant",
            commitHash: "abc",
            chatId: 1,
          },
        ]}
        messagesEndRef={messagesEndRef}
        chatData={{}} // chatData without initialCommitHash
      />
    );

    fireEvent.click(screen.getByText("Undo"));

    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith(
        "No initial commit hash found for chat. Need to manually undo code changes"
      );
    });
  });

  it("does nothing when undo is clicked without selectedChatId", async () => {
    mockAtomValue = null;

    render(
      <MessagesList
        messages={[
          {
            id: "1",
            content: "Assistant",
            role: "assistant",
            commitHash: "abc",
            chatId: 1,
          },
        ]}
        messagesEndRef={messagesEndRef}
      />
    );

    fireEvent.click(screen.getByText("Undo"));

    await waitFor(() => {
      expect(mockSetMessagesById).not.toHaveBeenCalled();
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });
  });

  it("does not render undo controls while streaming", () => {
    mockIsStreaming = true;

    render(
      <MessagesList
        messages={[
          {
            id: "1",
            content: "Assistant",
            role: "assistant",
            commitHash: "abc",
            chatId: 1,
          },
        ]}
        messagesEndRef={messagesEndRef}
      />
    );

    expect(screen.queryByText("Undo")).toBeNull();
  });

  it("shows error toast when undo operation throws", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("boom"));

    render(
      <MessagesList
        messages={[
          {
            id: "1",
            content: "Assistant",
            role: "assistant",
            commitHash: "abc",
            chatId: 1,
          },
        ]}
        chatData={{ initialCommitHash: "init-hash" }}
        messagesEndRef={messagesEndRef}
      />
    );

    fireEvent.click(screen.getByText("Undo"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });
  });

  it("does not render setup banner when provider is already configured", () => {
    mockIsProviderSetup = true;

    render(<MessagesList messages={[]} messagesEndRef={messagesEndRef} />);

    expect(screen.queryByText("Setup OpenRouter API Key")).toBeNull();
  });
});
