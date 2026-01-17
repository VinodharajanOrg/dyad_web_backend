import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, fireEvent, act } from "@testing-library/react";

//date-fns
vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "2 minutes ago",
}));

// next/navigation
const pushSpy = vi.fn();
let pathnameMock = "/";
let searchParamsMock = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
  usePathname: () => pathnameMock,
  useSearchParams: () => searchParamsMock,
}));

//jotai — PROPER atom routing
let selectedChatIdState: number | null = null;
let selectedAppIdState: number | null = 1;
const setSelectedChatId = vi.fn((v) => (selectedChatIdState = v));
const setDropdownOpen = vi.fn();

vi.mock("jotai", () => ({
  atom: (v: any) => v,
  useAtom: (atom: any) => {
    if (atom === "selectedChatIdAtom") {
      return [selectedChatIdState, setSelectedChatId];
    }
    if (atom === "selectedAppIdAtom") {
      return [selectedAppIdState, vi.fn()];
    }
    if (atom === "dropdownOpenAtom") {
      return [false, setDropdownOpen];
    }
    return [null, vi.fn()];
  },
}));

vi.mock("@/atoms/chatAtoms", () => ({
  selectedChatIdAtom: "selectedChatIdAtom",
}));
vi.mock("@/atoms/appAtoms", () => ({
  selectedAppIdAtom: "selectedAppIdAtom",
}));
vi.mock("@/atoms/uiAtoms", () => ({
  dropdownOpenAtom: "dropdownOpenAtom",
}));

// sidebar + button
vi.mock("@/components/ui/sidebar", () => ({
  SidebarGroup: ({ children, ...r }: any) => <div {...r}>{children}</div>,
  SidebarGroupContent: ({ children }: any) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: any) => <div>{children}</div>,
  SidebarMenu: ({ children }: any) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...r }: any) => (
    <button onClick={onClick} {...r}>
      {children}
    </button>
  ),
}));

// dropdown menu
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div onClick={onClick}>{children}</div>
  ),
}));

// toasts
vi.mock("@/lib/toast", () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

// chats hooks (React Query)
let chatsMock: any[] = [];
let loadingMock = false;
const refreshChatsSpy = vi.fn();
const createChatSpy = vi.fn();
const deleteChatSpy = vi.fn();

vi.mock("@/hooks/useChats", () => ({
  useChats: () => ({
    data: chatsMock,
    isLoading: loadingMock,
    refetch: refreshChatsSpy,
  }),
  useCreateChat: () => ({
    mutateAsync: createChatSpy,
  }),
  useDeleteChat: () => ({
    mutateAsync: deleteChatSpy,
  }),
}));

// other hooks/components
const selectChatSpy = vi.fn();

vi.mock("@/hooks/useSelectChat", () => ({
  useSelectChat: () => ({ selectChat: selectChatSpy }),
}));

vi.mock("@/components/chat/RenameChatDialog", () => ({
  RenameChatDialog: ({ isOpen }: any) =>
    isOpen ? <div data-testid="rename-dialog" /> : null,
}));

vi.mock("@/components/chat/DeleteChatDialog", () => ({
  DeleteChatDialog: ({ isOpen }: any) =>
    isOpen ? <div data-testid="delete-dialog" /> : null,
}));


vi.mock("../ChatSearchDialog", () => ({
  ChatSearchDialog: ({ open }: any) =>
    open ? <div data-testid="search-dialog" /> : null,
}));

//IMPORT AFTER MOCKS
import { ChatList } from "../ChatList";

//TESTS
describe("ChatList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatsMock = [];
    loadingMock = false;
    selectedChatIdState = null;
    pathnameMock = "/";
    searchParamsMock = new URLSearchParams();
  });

  it("returns null when show is false", () => {
    const { container } = render(<ChatList show={false} />);
    expect(container.innerHTML === "").toBeTruthy();
  });

  it("renders loading state", () => {
    loadingMock = true;
    const { getByText } = render(<ChatList show />);
    expect(getByText("Loading chats...")).toBeTruthy();
  });

  it("renders empty state", () => {
    chatsMock = [];
    const { getByText } = render(<ChatList show />);
    expect(getByText("No chats found")).toBeTruthy();
  });

  it("renders chats and handles chat click", () => {
    chatsMock = [
      { id: 1, appId: 1, title: "Chat 1", createdAt: new Date().toISOString() },
    ];

    const { getByText } = render(<ChatList show />);
    fireEvent.click(getByText("Chat 1"));

    expect(selectChatSpy).toHaveBeenCalled();
  });

  it("creates a new chat when app is selected", async () => {
    createChatSpy.mockResolvedValueOnce({ id: 99 });

    const { getByText } = render(<ChatList show />);

    await act(async () => {
      fireEvent.click(getByText("New Chat"));
    });

    expect(createChatSpy).toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalled();
    expect(refreshChatsSpy).toHaveBeenCalled();
  });

  it("opens search dialog", () => {
    const { getByTestId } = render(<ChatList show />);
    fireEvent.click(getByTestId("search-chats-button"));
    expect(getByTestId("search-dialog")).toBeTruthy();
  });

  it("opens rename and delete dialogs for selected chat", () => {
    selectedChatIdState = 1;
    chatsMock = [
      { id: 1, appId: 1, title: "Chat 1", createdAt: new Date().toISOString() },
    ];

    const { getByText, getByTestId } = render(<ChatList show />);

    fireEvent.click(getByText("Rename Chat"));
    expect(getByTestId("rename-dialog")).toBeTruthy();

    fireEvent.click(getByText("Delete Chat"));
    expect(getByTestId("delete-dialog")).toBeTruthy();
  });
});
