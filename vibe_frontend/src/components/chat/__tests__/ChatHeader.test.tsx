import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatHeader } from "../ChatHeader";

//SHARED MOCK FUNCTIONS
const mockPush = vi.fn();
const mockSetSelectedChatId = vi.fn();
const mockRefetch = vi.fn();
const mockMutateAsync = vi.fn();
const mockShowError = vi.fn();

// next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// jotai
vi.mock("jotai", () => ({
  atom: (v: any) => v,
  useAtomValue: vi.fn(() => "app-1"),
  useAtom: vi.fn(() => ["chat-1", mockSetSelectedChatId]),
}));

// hooks
vi.mock("@/hooks/useChats", () => ({
  useChats: () => ({
    refetch: mockRefetch,
  }),
  useCreateChat: () => ({
    mutateAsync: mockMutateAsync,
  }),
}));

vi.mock("@/hooks/useStreamChat", () => ({
  useStreamChat: () => ({ isStreaming: false }),
}));

vi.mock("@/hooks/useCheckoutVersion", () => ({
  useCheckoutVersion: () => ({
    checkoutVersion: vi.fn(),
    isCheckingOutVersion: false,
  }),
}));

vi.mock("@/hooks/useRenameBranch", () => ({
  useRenameBranch: () => ({
    renameBranch: vi.fn(),
    isRenamingBranch: false,
  }),
}));

// toast
vi.mock("@/lib/toast", () => ({
  showError: (...args: any[]) => mockShowError(...args),
  showSuccess: vi.fn(),
}));

// icons
vi.mock("lucide-react", () => ({
  PanelRightOpen: () => <div data-testid="icon-open" />,
  PanelRightClose: () => <div data-testid="icon-close" />,
  PlusCircle: () => <div data-testid="icon-plus" />,
}));

// UI
vi.mock("@/components/ui/button", () => ({
  Button: ({ onClick, children }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock("@/components/ui/LoadingBar", () => ({
  LoadingBar: () => <div data-testid="loading-bar" />,
}));

// Tests
describe("ChatHeader – MAXIMUM ACHIEVABLE COVERAGE", () => {
  const baseProps = {
    isVersionPaneOpen: false,
    isPreviewOpen: false,
    onTogglePreview: vi.fn(),
    onVersionClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new chat successfully and navigates", async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: "new-chat-id" });

    render(<ChatHeader {...baseProps} />);

    fireEvent.click(screen.getByText("New Chat"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ appId: "app-1" });
      expect(mockSetSelectedChatId).toHaveBeenCalledWith("new-chat-id");
      expect(mockPush).toHaveBeenCalledWith(
        "/app-1/chat?id=new-chat-id"
      );
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it("shows error toast when chat creation fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("boom"));

    render(<ChatHeader {...baseProps} />);

    fireEvent.click(screen.getByText("New Chat"));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalled();
    });
  });

  it("renders preview open icon when preview is closed", () => {
    render(<ChatHeader {...baseProps} isPreviewOpen={false} />);
    expect(screen.getByTestId("icon-open")).toBeTruthy();
  });

  it("renders preview close icon when preview is open", () => {
    render(<ChatHeader {...baseProps} isPreviewOpen={true} />);
    expect(screen.getByTestId("icon-close")).toBeTruthy();
  });

  it("calls onTogglePreview when preview button is clicked", () => {
    render(<ChatHeader {...baseProps} />);
    fireEvent.click(
      screen.getByTestId("toggle-preview-panel-button")
    );
    expect(baseProps.onTogglePreview).toHaveBeenCalled();
  });

  it("renders loading bar", () => {
    render(<ChatHeader {...baseProps} />);
    expect(screen.getByTestId("loading-bar")).toBeTruthy();
  });
});
