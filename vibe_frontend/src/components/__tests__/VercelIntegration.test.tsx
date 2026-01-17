import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Hoisted Mocks
const mocks = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

let mockSettings: any = null;

// useSettings
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: mockSettings,
    updateSettings: mocks.updateSettings,
  }),
}));

// toast
vi.mock("@/lib/toast", () => ({
  showSuccess: (...args: any[]) => mocks.showSuccess(...args),
  showError: (...args: any[]) => mocks.showError(...args),
}));

// Button
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

// IMPORT AFTER MOCKS
import { VercelIntegration } from "../VercelIntegration";

// TESTS
describe("VercelIntegration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = null;
  });

  it("returns null when Vercel is not connected", () => {
    mockSettings = {
      vercelAccessToken: undefined,
    };

    const { container } = render(<VercelIntegration />);

    expect(container.firstChild).toBeNull();
  });

  it("renders disconnect UI when Vercel is connected", () => {
    mockSettings = {
      vercelAccessToken: "token",
    };

    render(<VercelIntegration />);

    expect(screen.getByText("Vercel Integration")).toBeTruthy();
    expect(screen.getByText("Disconnect from Vercel")).toBeTruthy();
  });

  it("disconnects successfully and shows success toast", async () => {
    mockSettings = {
      vercelAccessToken: "token",
    };

    mocks.updateSettings.mockResolvedValueOnce(true);

    render(<VercelIntegration />);

    fireEvent.click(screen.getByText("Disconnect from Vercel"));

    await Promise.resolve(); // allow state + async update

    expect(mocks.updateSettings).toHaveBeenCalledWith({
      vercelAccessToken: undefined,
    });

    expect(mocks.showSuccess).toHaveBeenCalledWith(
      "Successfully disconnected from Vercel",
    );
  });

  it("shows error toast when updateSettings returns false", async () => {
    mockSettings = {
      vercelAccessToken: "token",
    };

    mocks.updateSettings.mockResolvedValueOnce(false);

    render(<VercelIntegration />);

    fireEvent.click(screen.getByText("Disconnect from Vercel"));

    await Promise.resolve();

    expect(mocks.showError).toHaveBeenCalledWith(
      "Failed to disconnect from Vercel",
    );
  });

  it("shows error toast when updateSettings throws", async () => {
    mockSettings = {
      vercelAccessToken: "token",
    };

    mocks.updateSettings.mockRejectedValueOnce(
      new Error("Network error"),
    );

    render(<VercelIntegration />);

    fireEvent.click(screen.getByText("Disconnect from Vercel"));

    await Promise.resolve();

    expect(mocks.showError).toHaveBeenCalledWith(
      "Network error",
    );
  });
});
