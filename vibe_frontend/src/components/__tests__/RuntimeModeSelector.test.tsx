import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RuntimeModeSelector } from "../RuntimeModeSelector";

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

// showError
const showErrorMock = vi.fn();

vi.mock("@/lib/toast", () => ({
  showError: (msg: string) => showErrorMock(msg),
}));

// openExternalUrl
const openExternalUrlMock = vi.fn();

vi.mock("@/utils/openExternalUrl", () => ({
  openExternalUrl: (url: string) => openExternalUrlMock(url),
}));

//Radix Select
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

// RESET MOCKS
beforeEach(() => {
  mockSettings = null;
  updateSettingsMock.mockReset();
  showErrorMock.mockReset();
  openExternalUrlMock.mockReset();
  selectOnValueChange = null;
});

// TESTS
describe("RuntimeModeSelector", () => {
  it("returns null when settings are missing", () => {
    mockSettings = null;

    const { container } = render(<RuntimeModeSelector />);

    expect(container.firstChild).toBeFalsy();
  });

  it("renders selector when settings exist", () => {
    mockSettings = { runtimeMode2: "host" };

    render(<RuntimeModeSelector />);

    expect(screen.getByText("Runtime Mode")).toBeTruthy();
    expect(screen.getByText("Local (default)")).toBeTruthy();
    expect(screen.getByText("Docker (experimental)")).toBeTruthy();
  });

  it("switches to docker mode and updates settings", async () => {
    mockSettings = { runtimeMode2: "host" };
    updateSettingsMock.mockResolvedValueOnce(undefined);

    render(<RuntimeModeSelector />);

    fireEvent.click(screen.getByText("Docker (experimental)"));

    expect(updateSettingsMock).toHaveBeenCalledWith({
      runtimeMode2: "docker",
    });
  });

  it("shows docker warning when docker mode is active", () => {
    mockSettings = { runtimeMode2: "docker" };

    render(<RuntimeModeSelector />);

    expect(
      screen.getByText((content) =>
        content.includes("Docker mode is")
      )
    ).toBeTruthy();

    expect(screen.getByText("Docker Desktop")).toBeTruthy();
  });

  it("opens Docker Desktop link when clicked", () => {
    mockSettings = { runtimeMode2: "docker" };

    render(<RuntimeModeSelector />);

    fireEvent.click(screen.getByText("Docker Desktop"));

    expect(openExternalUrlMock).toHaveBeenCalledWith(
      "https://www.docker.com/products/docker-desktop/"
    );
  });

  it("shows error toast when updateSettings fails", async () => {
    mockSettings = { runtimeMode2: "host" };
    updateSettingsMock.mockRejectedValueOnce(
      new Error("permission denied")
    );

    render(<RuntimeModeSelector />);

    fireEvent.click(screen.getByText("Docker (experimental)"));

    // allow promise rejection to flush
    await Promise.resolve();

    expect(showErrorMock).toHaveBeenCalledWith(
      "Failed to update runtime mode: permission denied"
    );
  });
});
