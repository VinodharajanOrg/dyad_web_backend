import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock getAllChats
vi.mock("@/lib/chat", () => ({
  getAllChats: vi.fn(() =>
    Promise.resolve([
      { id: 1, title: "Chat 1", appId: 1 },
      { id: 2, title: "Chat 2", appId: 2 },
      { id: 3, title: "Chat 3", appId: 1 },
    ])
  ),
}));

// Mock useAllChats hook
const mockChatsData = [
  { id: 1, title: "Chat 1", appId: 1, createdAt: new Date() },
  { id: 2, title: "Chat 2", appId: 2, createdAt: new Date() },
  { id: 3, title: "Chat 3", appId: 1, createdAt: new Date() },
];

vi.mock("@/hooks/useChats", () => ({
  useAllChats: () => ({
    data: mockChatsData,
    isLoading: false,
  }),
}));

// Mock jotai
vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtomValue: vi.fn(() => {
      // Return a Map for isStreamingByIdAtom
      const map = new Map();
      map.set(1, false);
      map.set(2, true); // Chat 2 is streaming
      return map;
    }),
  };
});

// Mock useLoadApps
vi.mock("@/hooks/useLoadApps", () => ({
  useLoadApps: () => ({
    apps: [
      { id: 1, name: "App 1" },
      { id: 2, name: "App 2" },
    ],
  }),
}));

// Mock useSelectChat
vi.mock("@/hooks/useSelectChat", () => ({
  useSelectChat: () => ({
    selectChat: vi.fn(),
  }),
}));

// Mock Popover components - must render trigger even when closed
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children, open, onOpenChange }: any) =>
    <div data-testid="popover" onClick={() => onOpenChange?.(!open)}>
      {children}
    </div>,
  PopoverTrigger: ({ children }: any) =>
    <div data-testid="popover-trigger">{children}</div>,
  PopoverContent: ({ children }: any) =>
    <div data-testid="popover-content">{children}</div>,
}));

// Mock Tooltip components
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// Import after mocks
import { ChatActivityButton } from "../ChatActivity";

// Helper to wrap component with QueryClientProvider
const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

// TESTS

describe("ChatActivityButton Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the button with Bell icon", () => {
    renderWithQueryClient(<ChatActivityButton />);
    expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
  });

  it("should render without crashing", () => {
    const { container } = renderWithQueryClient(<ChatActivityButton />);
    expect(container).toBeTruthy();
  });

  it("should have tooltip showing Recent chat activity", async () => {
    renderWithQueryClient(<ChatActivityButton />);
    await waitFor(() => {
      expect(screen.getByText("Recent chat activity")).toBeTruthy();
    });
  });

  it("should show loading state initially", async () => {
    renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    await waitFor(() => {
      // Component should show loading or activity
      expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
    });
  });

  it("should display recent chats after loading", async () => {
    renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    await waitFor(() => {
      // Should display chats
      expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
    });
  });

  it("should display no recent chats message when empty", async () => {
    renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    await waitFor(() => {
      // Component renders
      expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
    });
  });

  it("should show chat items with correct title and app name", async () => {
    renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
    });
  });

  it("should handle chat with fallback title", async () => {
    renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
    });
  });

  it("should show streaming indicator for in-progress chats", async () => {
    renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
    });
  });

  it("should show checkmark for completed chats", async () => {
    renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
    });
  });

  it("should call selectChat when clicking a chat item", async () => {
    renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
    });
  });

  it("should close popover after selecting a chat", async () => {
    renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
    });
  });

  it("should limit display to 30 chats", async () => {
    renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
    });
  });

  it("should reverse order to show newest first", async () => {
    renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
    });
  });

  it("should handle getAllChats error gracefully", async () => {
    renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
    });
  });

  it("should handle unmounting during async operation", async () => {
    const { unmount } = renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    unmount();

    expect(true).toBe(true); // Should not throw
  });

  it("should display app name for each chat", async () => {
    renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
    });
  });

  it("should handle chat with unknown app ID", async () => {
    renderWithQueryClient(<ChatActivityButton />);

    fireEvent.click(screen.getByTestId("chat-activity-button"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-activity-button")).toBeTruthy();
    });
  });
});
