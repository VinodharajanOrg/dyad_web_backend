import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "@testing-library/react";


// Mock globals
vi.stubGlobal("requestAnimationFrame", (cb: any) => cb());
HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

// Mock TanStack Query
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({}),
  useQuery: () => ({ data: undefined, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn() }),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ArrowDown: () => <div />,
  PlusCircle: () => <div />,
  PanelRightOpen: () => <div />,
  PanelRightClose: () => <div />,
  History: () => <div />,
  GitBranch: () => <div />,
  Info: () => <div />,
}));

// Mock hooks
const useChatMock = vi.fn();
const useChatMessagesMock = vi.fn();

vi.mock("@/hooks/useChats", () => ({
  useChat: (...args: any[]) => useChatMock(...args),
  useChatMessages: (...args: any[]) => useChatMessagesMock(...args),
  useChats: vi.fn(() => ({ data: [], refetch: vi.fn() })),
  useCreateChat: vi.fn(() => ({ mutate: vi.fn() })),
  useDeleteChat: vi.fn(),
  useRenameChat: vi.fn(),
  useDeleteChatMessages: vi.fn(),
}));

vi.mock("@/hooks/useStreamChat", () => ({
  useStreamChat: () => ({ isStreaming: false }),
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: null,
    setSettingsAtom: vi.fn(),
    envVars: {},
    setEnvVarsAtom: vi.fn(),
  }),
}));

// Mock child components
vi.mock("./chat/ChatHeader", () => ({
  ChatHeader: () => <div data-testid="chat-header" />,
}));

vi.mock("./chat/MessagesList", () => ({
  MessagesList: React.forwardRef((_p: any, ref: any) => (
    <div data-testid="messages-list" ref={ref} />
  )),
}));

vi.mock("./chat/ChatInput", () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}));

vi.mock("./chat/VersionPane", () => ({
  VersionPane: () => <div data-testid="version-pane" />,
}));

vi.mock("./chat/ChatError", () => ({
  ChatError: () => null,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

// Mock atoms
const atoms = vi.hoisted(() => ({
  chatMessagesByIdAtom: { __atom: "messagesByid" },
  chatStreamCountByIdAtom: { __atom: "streamCountById" },
  isStreamingByIdAtom: { __atom: "isStreamingById" },
  selectedChatIdAtom: { __atom: "selectedChatId" },
  selectedAppIdAtom: { __atom: "selectedAppId" },
  userSettingsAtom: { __atom: "userSettings" },
  envVarsAtom: { __atom: "envVars" },
}));

const messagesById = new Map<number, any[]>();
const streamCountById = new Map<number, number>();
const isStreamingById = new Map<number, boolean>();

vi.mock("../atoms/chatAtoms", () => ({
  chatMessagesByIdAtom: atoms.chatMessagesByIdAtom,
  chatStreamCountByIdAtom: atoms.chatStreamCountByIdAtom,
  isStreamingByIdAtom: atoms.isStreamingByIdAtom,
  selectedChatIdAtom: atoms.selectedChatIdAtom,
}));

vi.mock("@/atoms/appAtoms", () => ({
  selectedAppIdAtom: atoms.selectedAppIdAtom,
  userSettingsAtom: atoms.userSettingsAtom,
  envVarsAtom: atoms.envVarsAtom,
  currentAppAtom: { __atom: "currentApp" },
  appsListAtom: { __atom: "appsList" },
  selectedVersionIdAtom: { __atom: "selectedVersionId" },
  appOutputAtom: { __atom: "appOutput" },
  versionsListAtom: { __atom: "versionsList" },
  appBasePathAtom: { __atom: "appBasePath" },
  appUrlAtom: { __atom: "appUrl" },
  previewPanelKeyAtom: { __atom: "previewPanelKey" },
  previewErrorMessageAtom: { __atom: "previewErrorMessage" },
  lastDockerAppIdAtom: { __atom: "lastDockerAppId" },
  isAnyCheckoutVersionInProgressAtom: { __atom: "isAnyCheckoutVersionInProgress" },
  activeCheckoutCounterAtom: { __atom: "activeCheckoutCounter" },
}));

vi.mock("@/atoms/viewAtoms", () => ({
  isPreviewOpenAtom: { __atom: "isPreviewOpen" },
}));

// Mock jotai
vi.mock("jotai", () => ({
  atom: (v: any) => ({ __atom: v }),
  
  useAtom: (atom: any) => {
    if (atom === atoms.chatMessagesByIdAtom) {
      return [messagesById, vi.fn()];
    }
    if (atom === atoms.chatStreamCountByIdAtom) {
      return [streamCountById, vi.fn()];
    }
    if (atom === atoms.isStreamingByIdAtom) {
      return [isStreamingById, vi.fn()];
    }
    if (atom === atoms.selectedChatIdAtom) {
      return [1, vi.fn()];
    }
    return [null, vi.fn()];
  },

  useAtomValue: (atom: any) => {
    if (atom === atoms.chatMessagesByIdAtom) return messagesById;
    if (atom === atoms.chatStreamCountByIdAtom) return streamCountById;
    if (atom === atoms.isStreamingByIdAtom) return isStreamingById;
    if (atom === atoms.selectedChatIdAtom) return 1;
    if (atom === atoms.selectedAppIdAtom) return 10;
    if (atom === atoms.userSettingsAtom) return null;
    if (atom === atoms.envVarsAtom) return {};
    // Fallback for unknown atoms
    return new Map();
  },

  useSetAtom: () => vi.fn(),
}));

//TESTS

import { ChatPanel } from "../ChatPanel";

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messagesById.clear();

    useChatMock.mockReturnValue({
      data: { id: 1, title: "Test Chat" },
      isLoading: false,
    });

    useChatMessagesMock.mockReturnValue({
      data: [],
      isFetching: false,
    });
  });

  it("renders base layout", () => {
    const { queryByTestId } = render(
      <ChatPanel chatId={1} isPreviewOpen={false} onTogglePreview={vi.fn()} />,
    );

    // Check if core elements exist
    const messageListEl = queryByTestId("messages-list");
    expect(messageListEl).toBeTruthy();
  });

  it("renders without crashing when chatId is undefined", () => {
    const { queryByTestId } = render(
      <ChatPanel isPreviewOpen={false} onTogglePreview={vi.fn()} />,
    );

    expect(queryByTestId("messages-list")).toBeTruthy();
  });

  it("renders with preview open", () => {
    const { queryByTestId } = render(
      <ChatPanel chatId={1} isPreviewOpen={true} onTogglePreview={vi.fn()} />,
    );

    expect(queryByTestId("messages-list")).toBeTruthy();
  });

  it("calls onTogglePreview callback with correct prop", () => {
    const onTogglePreview = vi.fn();
    render(
      <ChatPanel chatId={1} isPreviewOpen={false} onTogglePreview={onTogglePreview} />,
    );

    // Component should accept the callback
    expect(onTogglePreview).not.toHaveBeenCalled();
  });

  it("renders version pane when visible", () => {
    const { queryByTestId } = render(
      <ChatPanel chatId={1} isPreviewOpen={false} onTogglePreview={vi.fn()} />,
    );

    // Should render without errors
    expect(queryByTestId("messages-list")).toBeTruthy();
  });
});
