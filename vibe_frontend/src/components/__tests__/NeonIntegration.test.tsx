import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// HOISTED MOCKS
const mocks = vi.hoisted(() => ({
  useSettings: vi.fn(),
}));

/* ---------- useSettings ---------- */
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => mocks.useSettings(),
}));

/* ---------- NeonDisconnectButton ---------- */
vi.mock("@/components/NeonDisconnectButton", () => ({
  NeonDisconnectButton: () => (
    <div data-testid="neon-disconnect-button">disconnect</div>
  ),
}));

// IMPORT AFTER ALL MOCKS
import { NeonIntegration } from "../NeonIntegration";

// TESTS
describe("NeonIntegration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when Neon is not connected", () => {
    mocks.useSettings.mockReturnValue({
      settings: {},
    });

    const { container } = render(<NeonIntegration />);

    expect(container.firstChild).toBeNull();
  });

  it("renders integration info and disconnect button when Neon is connected", () => {
    mocks.useSettings.mockReturnValue({
      settings: {
        neon: { accessToken: "token-123" },
      },
    });

    render(<NeonIntegration />);

    expect(
      screen.getByText("Neon Integration"),
    ).toBeTruthy();

    expect(
      screen.getByText("Your account is connected to Neon."),
    ).toBeTruthy();

    expect(
      screen.getByTestId("neon-disconnect-button"),
    ).toBeTruthy();
  });
});
