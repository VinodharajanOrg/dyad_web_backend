import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";

//useSettings hook
let settingsState: any = {
  autoApproveChanges: false,
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
import { AutoApproveSwitch } from "../AutoApproveSwitch";
import { showInfo } from "@/lib/toast";

//TESTS
describe("AutoApproveSwitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enables auto-approve and shows toast when previously disabled", () => {
    settingsState = { autoApproveChanges: false };

    const { getByRole } = render(<AutoApproveSwitch />);

    fireEvent.click(getByRole("checkbox"));

    expect(updateSettingsSpy).toHaveBeenCalledWith({
      autoApproveChanges: true,
    });
    expect(vi.mocked(showInfo)).toHaveBeenCalled();
  });

  it("disables auto-approve and does not show toast", () => {
    settingsState = { autoApproveChanges: true };

    const { getByRole } = render(<AutoApproveSwitch />);

    fireEvent.click(getByRole("checkbox"));

    expect(updateSettingsSpy).toHaveBeenCalledWith({
      autoApproveChanges: false,
    });
    expect(vi.mocked(showInfo)).not.toHaveBeenCalled();
  });

  it("does not show toast when showToast is false", () => {
    settingsState = { autoApproveChanges: false };

    const { getByRole } = render(
      <AutoApproveSwitch showToast={false} />,
    );

    fireEvent.click(getByRole("checkbox"));

    expect(updateSettingsSpy).toHaveBeenCalledWith({
      autoApproveChanges: true,
    });
    expect(vi.mocked(showInfo)).not.toHaveBeenCalled();
  });

  it("renders label correctly", () => {
    const { getByText } = render(<AutoApproveSwitch />);
    expect(getByText("Auto-approve")).toBeTruthy();
  });
});
