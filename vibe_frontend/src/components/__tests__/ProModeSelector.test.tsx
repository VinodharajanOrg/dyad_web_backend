import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { openExternalUrl } from "@/utils/openExternalUrl";

//SHARED STATE (mutable per test)
let mockSettings: any = null;
const updateSettingsMock = vi.fn();

//useSettings MOCK
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: mockSettings,
    updateSettings: updateSettingsMock,
  }),
}));

//hasDyadProKey MOCK
vi.mock("@/lib/schemas", () => ({
  hasDyadProKey: (settings: any) => Boolean(settings?.dyadProKey),
}));

//openExternalUrl MOCK
vi.mock("@/utils/openExternalUrl", () => ({
  openExternalUrl: vi.fn(),
}));

// MOCK lucide-react
vi.mock("lucide-react", () => ({
  Sparkles: () => <span data-testid="sparkles-icon" />,
  Info: () => <span data-testid="info-icon" />,
}));

// RADIX / UI COMPONENT MOCKS ,these MUST call handlers directly
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({ onCheckedChange }: any) => (
    <button
      data-testid="switch"
      onClick={() => onCheckedChange?.(true)}
    >
      switch
    </button>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

// IMPORT AFTER MOCKS
import { ProModeSelector } from "../ProModeSelector";

// TESTS SUITE
describe("ProModeSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = null;
  });

  it("renders Pro button", () => {
    render(<ProModeSelector />);
    expect(screen.getByText("Pro")).toBeTruthy();
  });

  it("shows unlock pro link when no pro key", () => {
    mockSettings = {};
    render(<ProModeSelector />);
    expect(screen.getByText("Unlock Pro modes")).toBeTruthy();
  });

  it("clicking unlock pro opens external link", () => {
    mockSettings = {};

    render(<ProModeSelector />);
    fireEvent.click(screen.getByText("Unlock Pro modes"));

    expect(openExternalUrl).toBeTruthy();
  });

  it("toggles Dyad Pro when pro key exists", () => {
    mockSettings = {
      dyadProKey: "key",
      enableDyadPro: false,
    };

    render(<ProModeSelector />);
    fireEvent.click(screen.getAllByTestId("switch")[0]);

    expect(updateSettingsMock).toHaveBeenCalledWith({
      enableDyadPro: true,
    });
  });

  it("toggles web search when pro mode is active", () => {
    mockSettings = {
      dyadProKey: "key",
      enableDyadPro: true,
      enableProWebSearch: false,
    };

    render(<ProModeSelector />);
    fireEvent.click(screen.getAllByTestId("switch")[1]);

    expect(updateSettingsMock).toHaveBeenCalledWith({
      enableProWebSearch: true,
    });
  });

  it("changes Turbo Edits mode to v1", () => {
    mockSettings = {
      dyadProKey: "key",
      enableDyadPro: true,
    };

    render(<ProModeSelector />);
    const turbo = screen.getByTestId("turbo-edits-selector");

    fireEvent.click(within(turbo).getByText("Classic"));

    expect(updateSettingsMock).toHaveBeenCalledWith({
      enableProLazyEditsMode: true,
      proLazyEditsMode: "v1",
    });
  });

  it("disables Turbo Edits", () => {
    mockSettings = {
      dyadProKey: "key",
      enableDyadPro: true,
      enableProLazyEditsMode: true,
      proLazyEditsMode: "v2",
    };

    render(<ProModeSelector />);
    const turbo = screen.getByTestId("turbo-edits-selector");

    fireEvent.click(within(turbo).getByText("Off"));

    expect(updateSettingsMock).toHaveBeenCalledWith({
      enableProLazyEditsMode: false,
      proLazyEditsMode: "off",
    });
  });

  it("sets Smart Context to balanced", () => {
    mockSettings = {
      dyadProKey: "key",
      enableDyadPro: true,
    };

    render(<ProModeSelector />);
    const smart = screen.getByTestId("smart-context-selector");

    fireEvent.click(within(smart).getByText("Balanced"));

    expect(updateSettingsMock).toHaveBeenCalledWith({
      enableProSmartFilesContextMode: true,
      proSmartContextOption: "balanced",
    });
  });

  it("disables Smart Context", () => {
    mockSettings = {
      dyadProKey: "key",
      enableDyadPro: true,
      enableProSmartFilesContextMode: true,
      proSmartContextOption: "deep",
    };

    render(<ProModeSelector />);
    const smart = screen.getByTestId("smart-context-selector");

    fireEvent.click(within(smart).getByText("Off"));

    expect(updateSettingsMock).toHaveBeenCalledWith({
      enableProSmartFilesContextMode: false,
      proSmartContextOption: undefined,
    });
  });
});
