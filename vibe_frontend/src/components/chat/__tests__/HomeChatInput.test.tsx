import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HomeChatInput } from "../HomeChatInput";

// SHARED MOCK STATE
let mockInputValue = "";
const mockSetInputValue = vi.fn((v) => {
  mockInputValue = v;
});

let mockIsStreaming = false;
const mockClearAttachments = vi.fn();
const mockCapture = vi.fn();


// jotai
vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtom: () => [mockInputValue, mockSetInputValue],
  };
});

// settings
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: { theme: "light" },
  }),
}));

// stream hook
vi.mock("@/hooks/useStreamChat", () => ({
  useStreamChat: () => ({
    isStreaming: mockIsStreaming,
  }),
}));

// PARTIAL mock (keeps detectIsMac)
vi.mock("@/hooks/useChatModeToggle", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/useChatModeToggle")>();
  return {
    ...actual,
    useChatModeToggle: () => {},
  };
});

// KILL React Query at the source
vi.mock("@/hooks/useLanguageModelProviders", () => ({
  useLanguageModelProviders: () => ({
    isAnyProviderSetup: () => true,
    isProviderSetup: () => true,
  }),
}));

vi.mock("@/hooks/useLanguageModelsByProviders", () => ({
  useLanguageModelsByProviders: () => ({
    models: [],
    isLoading: false,
  }),
}));

// attachments
vi.mock("@/hooks/useAttachments", () => ({
  useAttachments: () => ({
    attachments: [],
    isDraggingOver: false,
    handleFileSelect: vi.fn(),
    removeAttachment: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDrop: vi.fn(),
    clearAttachments: mockClearAttachments,
    handlePaste: vi.fn(),
  }),
}));

// posthog
vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({
    capture: mockCapture,
  }),
}));

// UI children
vi.mock("../ChatInputControls", () => ({
  ChatInputControls: () => <div />,
}));

vi.mock("../LexicalChatInput", () => ({
  LexicalChatInput: ({ value, onChange, onSubmit }: any) => (
    <textarea
      role="textbox"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit();
      }}
    />
  ),
}));

vi.mock("../AttachmentsList", () => ({
  AttachmentsList: () => <div />,
}));

vi.mock("../DragDropOverlay", () => ({
  DragDropOverlay: () => <div />,
}));

vi.mock("../FileAttachmentDropdown", () => ({
  FileAttachmentDropdown: () => <div />,
}));

// TESTS
describe("HomeChatInput (max achievable coverage)", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockInputValue = "";
    mockIsStreaming = false;
  });

  it("renders safely when settings exist", () => {
    render(<HomeChatInput onSubmit={onSubmit} isStreaming={false} />);
    expect(screen.getByTestId("home-chat-input-container")).toBeTruthy();
  });

  it("does not submit when input is empty", () => {
    render(<HomeChatInput onSubmit={onSubmit} isStreaming={false} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits when input has text", () => {
    mockInputValue = "Hello";

    render(<HomeChatInput onSubmit={onSubmit} isStreaming={false} />);

    fireEvent.click(screen.getByTitle("Send message"));

    expect(onSubmit).toHaveBeenCalled();
    expect(mockClearAttachments).toHaveBeenCalled();
    expect(mockCapture).toHaveBeenCalledWith("chat:home_submit");
  });

  it("does not submit while streaming", () => {
    mockIsStreaming = true;
    render(<HomeChatInput onSubmit={onSubmit} isStreaming={true} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hello" },
    });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders stop button when streaming", () => {
    render(<HomeChatInput onSubmit={onSubmit} isStreaming={true} />);
    expect(
      screen.getByTitle("Cancel generation (unavailable here)")
    ).toBeTruthy();
  });

  it("renders send button when not streaming", () => {
    render(<HomeChatInput onSubmit={onSubmit} isStreaming={false} />);
    expect(screen.getByTitle("Send message")).toBeTruthy();
  });
});
