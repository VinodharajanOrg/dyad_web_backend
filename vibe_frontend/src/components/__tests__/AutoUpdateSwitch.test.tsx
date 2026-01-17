import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";

//useSettings hook
let settingsState: any = null;
const updateSettingsSpy = vi.fn();

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: settingsState,
    updateSettings: updateSettingsSpy,
  }),
}));

//sonner toast (HOIST-SAFE)
vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

//IPC Cient
const restartDyadSpy = vi.fn();

vi.mock("@/api/ipc_client", () => ({
  IpcClient: {
    getInstance: vi.fn(() => ({
      restartDyad: restartDyadSpy,
    })),
  },
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
      onChange={(e) => onCheckedChange(e.target.checked)}
      {...rest}
    />
  ),
}));

//IMPORT AFTER MOCKS
import { AutoUpdateSwitch } from "../AutoUpdateSwitch";
import { toast } from "sonner";

//TESTS
describe("AutoUpdateSwitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when settings are not loaded", () => {
    settingsState = null;
    const { container } = render(<AutoUpdateSwitch />);
    expect(container.innerHTML === "").toBeTruthy();
  });

  it("renders switch and label when settings exist", () => {
    settingsState = { enableAutoUpdate: false };
    const { getByRole, getByText } = render(<AutoUpdateSwitch />);
    expect(getByRole("checkbox")).toBeTruthy();
    expect(getByText("Auto-update")).toBeTruthy();
  });

  it("updates settings and shows toast on toggle", () => {
    settingsState = { enableAutoUpdate: false };
    const { getByRole } = render(<AutoUpdateSwitch />);

    fireEvent.click(getByRole("checkbox"));

    expect(updateSettingsSpy).toHaveBeenCalledWith({
      enableAutoUpdate: true,
    });
    expect(vi.mocked(toast)).toHaveBeenCalled();
  });

  it("invokes restartDyad when toast action is clicked", () => {
    settingsState = { enableAutoUpdate: false };

    render(<AutoUpdateSwitch />);
    fireEvent.click(document.querySelector('input[type="checkbox"]')!);

    const [, toastOptions] = vi.mocked(toast).mock.calls[0];

    //  SAFE type narrowing
    if (
      toastOptions &&
      typeof toastOptions === "object" &&
      "action" in toastOptions &&
      toastOptions.action &&
      typeof toastOptions.action === "object" &&
      "onClick" in toastOptions.action
    ) {
      toastOptions.action.onClick({} as any);
    }

    expect(restartDyadSpy).toHaveBeenCalled();
  });

  it("does not crash when IPC client is missing", async () => {
    // Override the mock to return null for this test
    const { IpcClient } = await import("@/api/ipc_client");
    vi.mocked(IpcClient.getInstance).mockReturnValueOnce(null);

    settingsState = { enableAutoUpdate: true };
    render(<AutoUpdateSwitch />);
    fireEvent.click(document.querySelector('input[type="checkbox"]')!);

    const [, toastOptions] = vi.mocked(toast).mock.calls[0];

    if (
      toastOptions &&
      typeof toastOptions === "object" &&
      "action" in toastOptions &&
      toastOptions.action &&
      typeof toastOptions.action === "object" &&
      "onClick" in toastOptions.action
    ) {
      toastOptions.action.onClick({} as any);
    }

    expect(restartDyadSpy).not.toHaveBeenCalled();
  });
});
