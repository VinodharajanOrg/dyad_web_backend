import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";

//useSettings hook (stateful mock)
let settingsState: any = {
  enableAutoFixProblems: false,
};

const updateSettingsSpy = vi.fn();

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: settingsState,
    updateSettings: updateSettingsSpy,
  }),
}));

// toast (HOIST-SAFE)
vi.mock("@/lib/toast", () => ({
  showInfo: vi.fn(),
}));

//UI components
vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...rest }: any) => <label {...rest}>{children}</label>,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, ...rest }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={onCheckedChange}
      {...rest}
    />
  ),
}));

//IMPORT AFTER MOCKS
import { AutoFixProblemsSwitch } from "../AutoFixProblemsSwitch";
import { showInfo } from "@/lib/toast";

//TESTS
describe("AutoFixProblemsSwitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enables auto-fix and does NOT show toast by default", () => {
    settingsState = { enableAutoFixProblems: false };

    const { getByRole } = render(<AutoFixProblemsSwitch />);

    fireEvent.click(getByRole("checkbox"));

    expect(updateSettingsSpy).toHaveBeenCalledWith({
      enableAutoFixProblems: true,
    });
    expect(vi.mocked(showInfo)).not.toHaveBeenCalled();
  });

  it("enables auto-fix and shows toast when showToast is true", () => {
    settingsState = { enableAutoFixProblems: false };

    const { getByRole } = render(
      <AutoFixProblemsSwitch showToast />,
    );

    fireEvent.click(getByRole("checkbox"));

    expect(updateSettingsSpy).toHaveBeenCalledWith({
      enableAutoFixProblems: true,
    });
    expect(vi.mocked(showInfo)).toHaveBeenCalled();
  });

  it("disables auto-fix and does not show toast", () => {
    settingsState = { enableAutoFixProblems: true };

    const { getByRole } = render(<AutoFixProblemsSwitch showToast />);

    fireEvent.click(getByRole("checkbox"));

    expect(updateSettingsSpy).toHaveBeenCalledWith({
      enableAutoFixProblems: false,
    });
    expect(vi.mocked(showInfo)).not.toHaveBeenCalled();
  });

  it("renders label correctly", () => {
    const { getByText } = render(<AutoFixProblemsSwitch />);
    expect(getByText("Auto-fix problems")).toBeTruthy();
  });
});
