import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

// HOIST-SAFE MOCKS
const { mockUseSettings, updateSettingsMock } = vi.hoisted(() => ({
  updateSettingsMock: vi.fn(),
  mockUseSettings: vi.fn(),
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => mockUseSettings(),
}));

// SHADCN / RADIX SELECT — SIMPLIFIED MOCK
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <div>
      <select
        data-testid="select"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
}));

//IMPORT AFTER MOCKS
import { MaxChatTurnsSelector } from "../MaxChatTurnsSelector";

// TESTS
describe("MaxChatTurnsSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default value when setting is undefined", () => {
    mockUseSettings.mockReturnValue({
      settings: {},
      updateSettings: updateSettingsMock,
    });

    render(<MaxChatTurnsSelector />);

    const select = screen.getByTestId("select") as HTMLSelectElement;
    expect(select.value).toBe("default");
    expect(
      screen.getByText("Balanced context size for most conversations."),
    ).toBeTruthy();
  });

  it("renders with numeric value from settings", () => {
    mockUseSettings.mockReturnValue({
      settings: { maxChatTurnsInContext: 5 },
      updateSettings: updateSettingsMock,
    });

    render(<MaxChatTurnsSelector />);

    const select = screen.getByTestId("select") as HTMLSelectElement;
    expect(select.value).toBe("5");
    expect(
      screen.getByText(
        "Slightly higher context size for detailed conversations.",
      ),
    ).toBeTruthy();
  });

  it("calls updateSettings(undefined) when default is selected", () => {
    mockUseSettings.mockReturnValue({
      settings: { maxChatTurnsInContext: 5 },
      updateSettings: updateSettingsMock,
    });

    render(<MaxChatTurnsSelector />);

    fireEvent.change(screen.getByTestId("select"), {
      target: { value: "default" },
    });

    expect(updateSettingsMock).toHaveBeenCalledWith({
      maxChatTurnsInContext: undefined,
    });
  });

  it("calls updateSettings with numeric value when non-default option selected", () => {
    mockUseSettings.mockReturnValue({
      settings: {},
      updateSettings: updateSettingsMock,
    });

    render(<MaxChatTurnsSelector />);

    fireEvent.change(screen.getByTestId("select"), {
      target: { value: "10" },
    });

    expect(updateSettingsMock).toHaveBeenCalledWith({
      maxChatTurnsInContext: 10,
    });
  });

  it("falls back to default description when option is not found", () => {
    mockUseSettings.mockReturnValue({
      settings: { maxChatTurnsInContext: 999 },
      updateSettings: updateSettingsMock,
    });

    render(<MaxChatTurnsSelector />);

    expect(
      screen.getByText("Balanced context size for most conversations."),
    ).toBeTruthy();
  });
});
