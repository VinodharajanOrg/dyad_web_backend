import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

//HOISTED MOCKS (CRITICAL – DO NOT INLINE)
const mocks = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));


/* ---------- sonner ---------- */
vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

/* ---------- useSettings ---------- */
let settingsMock: any = {};

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: settingsMock,
    updateSettings: mocks.updateSettings,
  }),
}));

// IMPORT AFTER MOCKS
import { NeonDisconnectButton } from "../NeonDisconnectButton";

// TESTS
describe("NeonDisconnectButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsMock = {};
  });

  it("returns null when Neon is not connected", () => {
    settingsMock = {};

    const { container } = render(<NeonDisconnectButton />);

    expect(container.firstChild).toBeNull();
  });

  it("renders disconnect button when Neon access token exists", () => {
    settingsMock = {
      neon: { accessToken: "token-123" },
    };

    render(<NeonDisconnectButton />);

    expect(
      screen.getByText("Disconnect from Neon"),
    ).toBeTruthy();
  });

  it("disconnects successfully and shows success toast", async () => {
    settingsMock = {
      neon: { accessToken: "token-123" },
    };

    mocks.updateSettings.mockResolvedValueOnce(undefined);

    render(<NeonDisconnectButton />);

    fireEvent.click(screen.getByText("Disconnect from Neon"));

    await waitFor(() =>
      expect(mocks.updateSettings).toHaveBeenCalledWith({
        neon: undefined,
      }),
    );

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Disconnected from Neon successfully",
    );
  });

  it("shows error toast when disconnect fails", async () => {
    settingsMock = {
      neon: { accessToken: "token-123" },
    };

    mocks.updateSettings.mockRejectedValueOnce(
      new Error("disconnect failed"),
    );

    render(<NeonDisconnectButton />);

    fireEvent.click(screen.getByText("Disconnect from Neon"));

    await waitFor(() =>
      expect(mocks.updateSettings).toHaveBeenCalled(),
    );

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Failed to disconnect from Neon",
    );
  });
});
