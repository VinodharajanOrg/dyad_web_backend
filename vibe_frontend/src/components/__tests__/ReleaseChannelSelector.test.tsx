import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReleaseChannelSelector } from "../ReleaseChannelSelector";

// SHARED STATE
let mockSettings: any = null;
const updateSettingsMock = vi.fn();
let selectOnValueChange: ((value: any) => void) | null = null;

// useSettings
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: mockSettings,
    updateSettings: updateSettingsMock,
  }),
}));

// sonner toast
const toastMock = vi.fn();

vi.mock("sonner", () => ({
  toast: (...args: any[]) => toastMock(...args),
}));

// openExternalUrl
const openExternalUrlMock = vi.fn();

vi.mock("@/utils/openExternalUrl", () => ({
  openExternalUrl: (url: string) => openExternalUrlMock(url),
}));

// Radix Select
vi.mock("@/components/ui/select", () => ({
  Select: ({ onValueChange, children }: any) => {
    selectOnValueChange = onValueChange;
    return <div>{children}</div>;
  },
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span>Select</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => (
    <button onClick={() => selectOnValueChange?.(value)}>
      {children}
    </button>
  ),
}));

// RESET 
beforeEach(() => {
  mockSettings = null;
  updateSettingsMock.mockClear();
  toastMock.mockClear();
  openExternalUrlMock.mockClear();
  selectOnValueChange = null;
});

// TESTS
describe("ReleaseChannelSelector", () => {
  it("returns null when settings are missing", () => {
    mockSettings = null;

    const { container } = render(<ReleaseChannelSelector />);

    expect(container.firstChild).toBeFalsy();
  });

  it("renders selector when settings exist", () => {
    mockSettings = { releaseChannel: "stable" };

    render(<ReleaseChannelSelector />);

    expect(screen.getByText("Release Channel")).toBeTruthy();
    expect(screen.getByText("Stable")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("switches to Stable and shows stable toast with download action", () => {
    mockSettings = { releaseChannel: "beta" };

    render(<ReleaseChannelSelector />);

    fireEvent.click(screen.getByText("Stable"));

    expect(updateSettingsMock).toHaveBeenCalledWith({
      releaseChannel: "stable",
    });

    expect(toastMock).toHaveBeenCalled();

    const toastArgs = toastMock.mock.calls[0][1];
    expect(toastArgs.action.label).toBe("Download Stable");

    toastArgs.action.onClick();

    expect(openExternalUrlMock).toHaveBeenCalledWith(
      "https://dyad.sh/download"
    );
  });

  it("switches to Beta and shows beta toast with restart action", () => {
    mockSettings = { releaseChannel: "stable" };

    render(<ReleaseChannelSelector />);

    fireEvent.click(screen.getByText("Beta"));

    expect(updateSettingsMock).toHaveBeenCalledWith({
      releaseChannel: "beta",
    });

    expect(toastMock).toHaveBeenCalled();

    const toastArgs = toastMock.mock.calls[0][1];
    expect(toastArgs.action.label).toBe("Restart Dyad");

    // no-op but must not crash
    toastArgs.action.onClick();
  });
});
