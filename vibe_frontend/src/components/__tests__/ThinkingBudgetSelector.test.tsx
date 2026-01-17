import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

//Hoisted Mocks
const mocks = vi.hoisted(() => ({
  updateSettings: vi.fn(),
}));

let mockSettings: any = null;

// useSettings
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: mockSettings,
    updateSettings: mocks.updateSettings,
  }),
}));

//Radix Select
let selectOnValueChange: ((v: string) => void) | null = null;

vi.mock("@/components/ui/select", () => ({
  Select: ({ onValueChange, children }: any) => {
    selectOnValueChange = onValueChange;
    return <div data-testid="select">{children}</div>;
  },
  SelectTrigger: ({ children }: any) => (
    <button data-testid="select-trigger">{children}</button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => (
    <button
      data-testid={`select-item-${value}`}
      onClick={() => selectOnValueChange?.(value)}
    >
      {children}
    </button>
  ),
}));

// IMPORT AFTER MOCKS
import { ThinkingBudgetSelector } from "../ThinkingBudgetSelector";

// TESTS
describe("ThinkingBudgetSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = null;
    selectOnValueChange = null;
  });

  it("renders with default value when settings are missing", () => {
    mockSettings = null;

    render(<ThinkingBudgetSelector />);

    expect(screen.getByText("Balanced thinking for most conversations."))
      .toBeTruthy();
  });

  it("renders description for low thinking budget", () => {
    mockSettings = { thinkingBudget: "low" };

    render(<ThinkingBudgetSelector />);

    expect(
      screen.getByText(
        "Minimal thinking tokens for faster responses and lower costs.",
      ),
    ).toBeTruthy();
  });

  it("renders description for high thinking budget", () => {
    mockSettings = { thinkingBudget: "high" };

    render(<ThinkingBudgetSelector />);

    expect(
      screen.getByText(
        "Extended thinking for complex problems requiring deep analysis.",
      ),
    ).toBeTruthy();
  });

  it("updates settings when a new budget is selected", async () => {
    mockSettings = { thinkingBudget: "medium" };

    render(<ThinkingBudgetSelector />);

    // Click HIGH option
    fireEvent.click(screen.getByTestId("select-item-high"));

    // wait microtask (important for state propagation)
    await Promise.resolve();

    expect(mocks.updateSettings).toHaveBeenCalledWith({
      thinkingBudget: "high",
    });
  });

  it("falls back to medium description if value is unknown", () => {
    mockSettings = { thinkingBudget: "unknown" };

    render(<ThinkingBudgetSelector />);

    expect(
      screen.getByText("Balanced thinking for most conversations."),
    ).toBeTruthy();
  });
});
