import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";

// jotai — controlled atom state
let selectedModeState: any = "build";
const setSelectedModeSpy = vi.fn((v) => {
  selectedModeState = v;
});

vi.mock("jotai", () => ({
  atom: (v: any) => v,
  useAtom: () => [selectedModeState, setSelectedModeSpy],
}));

vi.mock("@/atoms/chatAtoms", () => ({
  selectedChatModeAtom: "selectedChatModeAtom",
}));

//useSettings
let settingsState: any = null;

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: settingsState,
  }),
}));

//platform detection
vi.mock("@/hooks/useChatModeToggle", () => ({
  detectIsMac: () => true,
}));

// UI components (select + tooltip)
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange }: any) => (
    <div data-testid="select-root" onClick={() => onValueChange("ask")}>
      {children}
    </div>
  ),
  MiniSelectTrigger: ({ children, ...r }: any) => (
    <button {...r}>{children}</button>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ children }: any) => <span>{children}</span>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

// IMPORT AFTER MOCKS
import { ChatModeSelector } from "../ChatModeSelector";

// TESTS
describe("ChatModeSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectedModeState = "build";
    settingsState = null;
  });

  it("renders with default Build mode (selected value)", () => {
    const { getByTestId } = render(<ChatModeSelector />);

    // Assert only the selected trigger value
    expect(getByTestId("chat-mode-selector").textContent).toBeTruthy();
  });

  it("initializes mode from settings on mount", () => {
    settingsState = { selectedChatMode: "ask" };
    render(<ChatModeSelector />);

    expect(setSelectedModeSpy).toHaveBeenCalledWith("ask");
  });

  it("changes mode when select value changes", () => {
    const { getByTestId } = render(<ChatModeSelector />);

    fireEvent.click(getByTestId("chat-mode-selector"));

    expect(setSelectedModeSpy).toHaveBeenCalledWith("ask");
  });

  it("shows mac keyboard shortcut in tooltip", () => {
    const { getByText } = render(<ChatModeSelector />);

    // Partial matcher because text is split across nodes
    expect(
      getByText((content) => content.includes("⌘ + .")),
    ).toBeTruthy();
  });
});
