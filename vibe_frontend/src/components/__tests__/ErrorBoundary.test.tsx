import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import React from "react";

// spies
const captureExceptionSpy = vi.fn();
const openExternalUrlSpy = vi.fn();
const getSystemDebugInfoSpy = vi.fn();

// posthog
vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({
    captureException: captureExceptionSpy,
  }),
}));

// IPC client
vi.mock("@/api/ipc_client", () => ({
  IpcClient: {
    getInstance: vi.fn(() => ({
      getSystemDebugInfo: getSystemDebugInfoSpy,
    })),
  },
}));

// ExternalUrl 
vi.mock("@/utils/openExternalUrl", () => ({
  openExternalUrl: (url: string) => openExternalUrlSpy(url),
}));

// UI mocks
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("lucide-react", () => ({
  LightbulbIcon: () => <span data-icon="lightbulb" />,
}));

// component
import { ErrorBoundary } from "../ErrorBoundary";

// helper
const mockDebugInfo = {
  dyadVersion: "1.0.0",
  platform: "win32",
  architecture: "x64",
  nodeVersion: "18",
  pnpmVersion: "8",
  nodePath: "/node",
  telemetryId: "abc",
  logs: "log1\nlog2\nlog3",
};

// tests
describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders error details and tip", () => {
    const error = new Error("Boom");

    const { getByText, container } = render(
      <ErrorBoundary error={error} />
    );

    expect(
      getByText("Sorry, that shouldn't have happened!")
    ).toBeTruthy();
    expect(getByText("Error name:")).toBeTruthy();
    expect(getByText("Error message:")).toBeTruthy();
    expect(getByText("Boom")).toBeTruthy();
    expect(container.querySelector('[data-icon="lightbulb"]')).toBeTruthy();
  });

  it("captures exception on mount", () => {
    const error = new Error("Capture me");

    render(<ErrorBoundary error={error} />);

    expect(captureExceptionSpy).toHaveBeenCalledWith(error);
  });

  it("successfully prepares and opens bug report", async () => {
    const error = new Error("Bug error");

    getSystemDebugInfoSpy.mockResolvedValueOnce(mockDebugInfo);

    const { getByText } = render(
      <ErrorBoundary error={error} />
    );

    await act(async () => {
      fireEvent.click(getByText("Report Bug"));
      await Promise.resolve();
    });

    expect(getSystemDebugInfoSpy).toHaveBeenCalled();
    expect(openExternalUrlSpy).toHaveBeenCalled();
  });

  it("falls back to generic GitHub issue page on failure", async () => {
    const error = new Error("Fail path");

    getSystemDebugInfoSpy.mockRejectedValueOnce(
      new Error("IPC failed")
    );

    const { getByText } = render(
      <ErrorBoundary error={error} />
    );

    await act(async () => {
      fireEvent.click(getByText("Report Bug"));
      await Promise.resolve();
    });

    expect(openExternalUrlSpy).toHaveBeenCalledWith(
      "https://github.com/dyad-sh/dyad/issues/new"
    );
  });

  it("disables button while loading", async () => {
    const error = new Error("Loading");

    let resolveFn: any;
    getSystemDebugInfoSpy.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        })
    );

    const { getByText } = render(
      <ErrorBoundary error={error} />
    );

    await act(async () => {
      fireEvent.click(getByText("Report Bug"));
    });

    expect(getByText("Preparing report...")).toBeTruthy();

    await act(async () => {
      resolveFn(mockDebugInfo);
      await Promise.resolve();
    });
  });
});
