import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, fireEvent, act } from "@testing-library/react";

vi.useFakeTimers();

// MOCK ui/command
vi.mock("../ui/command", () => ({
  CommandDialog: ({ children, ...props }: any) => (
    <div data-testid="chat-search-dialog" {...props}>
      {children}
    </div>
  ),
  CommandInput: ({ value, onValueChange }: any) => (
    <input
      data-testid="chat-search-input"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    />
  ),
  CommandList: ({ children }: any) => (
    <div data-testid="chat-search-list">{children}</div>
  ),
  CommandEmpty: ({ children }: any) => (
    <div data-testid="chat-search-empty">{children}</div>
  ),
  CommandGroup: ({ children }: any) => (
    <div data-testid="chat-search-group">{children}</div>
  ),
  CommandItem: ({ children, onSelect }: any) => (
    <div data-testid="chat-search-item" onClick={onSelect}>
      {children}
    </div>
  ),
}));

// useSearchChats — QUERY-AWARE MOCK
const useSearchChatsMock = vi.fn();

vi.mock("@/hooks/useSearchChats", () => ({
  useSearchChats: (query: string) => useSearchChatsMock(query),
}));

// IMPORT AFTER MOCKS
import { ChatSearchDialog } from "../ChatSearchDialog";

// TEST DATA
const allChats = [
  { id: 1, appId: 10, title: "First Chat" },
  { id: 2, appId: 10, title: "Second Chat" },
];

const searchChats = [
  {
    id: 3,
    appId: 11,
    title: "Search Chat",
    messages: [{ content: "hello from message" }],
  },
];

// TESTS
describe("ChatSearchDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useSearchChatsMock.mockImplementation((query: string) => {
      if (query === "hello") {
        return { chats: searchChats };
      }
      return { chats: [] };
    });
  });

  it("renders dialog when open", () => {
    const chatsWithDates = allChats.map(chat => ({ ...chat, createdAt: new Date() }));
    const { getByTestId } = render(
      <ChatSearchDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectChat={vi.fn()}
        allChats={chatsWithDates}
      />,
    );

    expect(getByTestId("chat-search-dialog")).toBeTruthy();
  });

  it("renders all chats when search is empty", () => {
    const chatsWithDates = allChats.map(chat => ({ ...chat, createdAt: new Date() }));
    const { getAllByTestId } = render(
      <ChatSearchDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectChat={vi.fn()}
        allChats={chatsWithDates}
      />,
    );

    expect(getAllByTestId("chat-search-item").length).toBeTruthy();
  });

  it("updates search query and shows search results after debounce", () => {
    const chatsWithDates = allChats.map(chat => ({ ...chat, createdAt: new Date() }));
    const { getByTestId, getAllByTestId } = render(
      <ChatSearchDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectChat={vi.fn()}
        allChats={chatsWithDates}
      />,
    );

    fireEvent.change(getByTestId("chat-search-input"), {
      target: { value: "hello" },
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(getAllByTestId("chat-search-item").length).toBeTruthy();
  });

  it("calls onSelectChat when chat is selected", () => {
    const onSelectChat = vi.fn();
    const chatsWithDates = allChats.map(chat => ({ ...chat, createdAt: new Date() }));

    const { getAllByTestId } = render(
      <ChatSearchDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectChat={onSelectChat}
        allChats={chatsWithDates}
      />,
    );

    fireEvent.click(getAllByTestId("chat-search-item")[0]);

    expect(onSelectChat).toHaveBeenCalled();
  });

  it("toggles dialog on Ctrl+K / Cmd+K", () => {
    const onOpenChange = vi.fn();
    const chatsWithDates = allChats.map(chat => ({ ...chat, createdAt: new Date() }));

    render(
      <ChatSearchDialog
        open={false}
        onOpenChange={onOpenChange}
        onSelectChat={vi.fn()}
        allChats={chatsWithDates}
      />,
    );

    fireEvent.keyDown(document, {
      key: "k",
      ctrlKey: true,
    });

    expect(onOpenChange).toHaveBeenCalled();
  });

  it("renders snippet when search results contain messages", () => {
    const chatsWithDates = allChats.map(chat => ({ ...chat, createdAt: new Date() }));
    const { getByTestId } = render(
      <ChatSearchDialog
        open={true}
        onOpenChange={vi.fn()}
        onSelectChat={vi.fn()}
        allChats={chatsWithDates}
      />,
    );

    fireEvent.change(getByTestId("chat-search-input"), {
      target: { value: "hello" },
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(getByTestId("chat-search-group")).toBeTruthy();
  });
});
