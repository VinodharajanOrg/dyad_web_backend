import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

//HOISTED MOCK REFERENCES
const mocks = vi.hoisted(() => ({
  openExternalUrl: vi.fn(),
  toastSuccess: vi.fn(),
  fakeHandleNeonConnect: vi.fn(),
  refreshSettings: vi.fn(),
  clearLastDeepLink: vi.fn(),
}));


/* ---------- openExternalUrl ---------- */
vi.mock("@/utils/openExternalUrl", () => ({
  openExternalUrl: mocks.openExternalUrl,
}));

/* ---------- toast ---------- */
vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    dismiss: vi.fn(),
  },
}));

/* ---------- IpcClient ---------- */
vi.mock("@/api/ipc_client", () => {
  return {
    IpcClient: {
      getInstance: vi.fn(() => ({
        fakeHandleNeonConnect: mocks.fakeHandleNeonConnect,
      })),
    },
  };
});

/* ---------- useSettings ---------- */
let settingsMock: any = {};

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: settingsMock,
    refreshSettings: mocks.refreshSettings,
  }),
}));

/* ---------- DeepLinkContext ---------- */
let lastDeepLinkMock: any = null;

vi.mock("@/contexts/DeepLinkContext", () => ({
  useDeepLink: () => ({
    lastDeepLink: lastDeepLinkMock,
    clearLastDeepLink: mocks.clearLastDeepLink,
  }),
}));

/* ---------- ThemeContext ---------- */
vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    isDarkMode: false,
  }),
}));

/* ---------- NeonDisconnectButton ---------- */
vi.mock("@/components/NeonDisconnectButton", () => ({
  NeonDisconnectButton: () => (
    <div data-testid="neon-disconnect">Disconnect</div>
  ),
}));

// IMPORT AFTER ALL MOCKS
import { NeonConnector } from "../NeonConnector";

// TESTS
describe("NeonConnector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsMock = {};
    lastDeepLinkMock = null;
  });

  it("renders connect state when not connected", () => {
    render(<NeonConnector />);

    expect(screen.getByText("Neon Database")).toBeTruthy();
    expect(screen.getByTestId("connect-neon-button")).toBeTruthy();
  });

  it("opens Neon OAuth when connect is clicked (non-test mode)", async () => {
    settingsMock = { isTestMode: false };

    render(<NeonConnector />);

    fireEvent.click(screen.getByTestId("connect-neon-button"));

    await waitFor(() =>
      expect(mocks.openExternalUrl).toHaveBeenCalledWith(
        "https://oauth.dyad.sh/api/integrations/neon/login",
      ),
    );
  });

  it("uses fake IPC handler when in test mode", async () => {
    settingsMock = { isTestMode: true };

    render(<NeonConnector />);

    fireEvent.click(screen.getByTestId("connect-neon-button"));

    await waitFor(() =>
      expect(mocks.fakeHandleNeonConnect).toHaveBeenCalled(),
    );
  });

  it("renders connected state when access token exists", () => {
    settingsMock = {
      neon: { accessToken: "token-123" },
    };

    render(<NeonConnector />);

    expect(
      screen.getByText("You are connected to Neon Database"),
    ).toBeTruthy();

    expect(screen.getByTestId("neon-disconnect")).toBeTruthy();
  });

  it("handles neon oauth deep link success", async () => {
    lastDeepLinkMock = {
      type: "neon-oauth-return",
      timestamp: Date.now(),
    };

    render(<NeonConnector />);

    await waitFor(() =>
      expect(mocks.refreshSettings).toHaveBeenCalled(),
    );

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Successfully connected to Neon!",
    );

    expect(mocks.clearLastDeepLink).toHaveBeenCalled();
  });

  it("opens Neon console link when connected", () => {
    settingsMock = {
      neon: { accessToken: "token-123" },
    };

    render(<NeonConnector />);

    fireEvent.click(screen.getByText("Neon"));

    expect(mocks.openExternalUrl).toHaveBeenCalledWith(
      "https://console.neon.tech/",
    );
  });
});
