import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ROUTER
const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

// POSTHOG
const captureMock = vi.hoisted(() => vi.fn());
vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: captureMock }),
}));

// EXTERNAL URL
const openExternalMock = vi.hoisted(() => vi.fn());
vi.mock("@/utils/openExternalUrl", () => ({
  openExternalUrl: openExternalMock,
}));

// SCROLL
const scrollMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useScrollAndNavigateTo", () => ({
  useScrollAndNavigateTo: () => scrollMock,
}));

// PROVIDERS
let providerSetup = false;
vi.mock("@/hooks/useLanguageModelProviders", () => ({
  useLanguageModelProviders: () => ({
    isAnyProviderSetup: () => providerSetup,
    isLoading: false,
  }),
}));

// SETTINGS
const updateSettingsMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({ updateSettings: updateSettingsMock }),
}));

// IPC
let nodeInstalled = false;
let ipcPresent = true;
let selectPathResult: any = { path: "/node" };

vi.mock("@/api/ipc_client", () => ({
  IpcClient: {
    getInstance: vi.fn(() =>
      ipcPresent
        ? {
            getNodejsStatus: vi.fn().mockResolvedValue({
              nodeVersion: nodeInstalled ? "v20" : null,
              pnpmVersion: nodeInstalled ? "8" : undefined,
              nodeDownloadUrl: "https://nodejs.org",
            }),

            openExternalUrl: vi.fn(),
            reloadEnvPath: vi.fn(),
            selectNodeFolder: vi.fn().mockResolvedValue(selectPathResult),
          }
        : null),
  },
}));

// UI
vi.mock("@/components/SetupProviderCard", () => ({
  default: ({ title, onClick }: any) => (
    <button onClick={onClick}>{title}</button>
  ),
}));

vi.mock("./home/OnboardingBanner", () => ({
  OnboardingBanner: () => null,
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: any) => <div>{children}</div>,
  AccordionItem: ({ children }: any) => <div>{children}</div>,
  AccordionTrigger: ({ children, ...p }: any) => (
    <button {...p}>{children}</button>
  ),
  AccordionContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

// IMPORT
import { SetupBanner, OpenRouterSetupBanner } from "../SetupBanner";

// TESTS
describe("SetupBanner (max coverage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerSetup = false;
    nodeInstalled = false;
    ipcPresent = true;
    selectPathResult = { path: "/node" };
  });

  it("renders success headline when all setup complete", async () => {
    nodeInstalled = true;
    providerSetup = true;

    render(<SetupBanner />);
    await Promise.resolve();

    expect(screen.getByText("Build your dream app")).toBeTruthy();
  });

  it("shows installed node info when node present", async () => {
    nodeInstalled = true;

    render(<SetupBanner />);
    await Promise.resolve();

    fireEvent.click(screen.getByText("1. Install Node.js (App Runtime)"));

    expect(screen.getByText((t) => t.includes("installed"))).toBeTruthy();
  });

  it("shows install flow when node missing", async () => {
    render(<SetupBanner />);
    await Promise.resolve();

    fireEvent.click(screen.getByText("1. Install Node.js (App Runtime)"));

    expect(screen.getByText("Install Node.js Runtime")).toBeTruthy();
  });

  it("starts node install and continues", async () => {
    render(<SetupBanner />);
    
    // Wait for node status to be fetched
    await waitFor(() => {
      fireEvent.click(screen.getByText("1. Install Node.js (App Runtime)"));
    });

    await waitFor(() => {
      fireEvent.click(screen.getByText("Install Node.js Runtime"));
    });

    fireEvent.click(screen.getByText("Continue | I installed Node.js"));

    expect(captureMock).toHaveBeenCalled();
  });

  it("handles web mode (no IPC)", async () => {
    ipcPresent = false;

    render(<SetupBanner />);
    await Promise.resolve();

    fireEvent.click(screen.getByText("1. Install Node.js (App Runtime)"));

    expect(
      screen.getAllByText((t) => t.includes("Node.js")).length
    ).toBeTruthy();
  });

  it("manual node config success", async () => {
    render(<SetupBanner />);
    await Promise.resolve();

    fireEvent.click(screen.getByText("1. Install Node.js (App Runtime)"));

    fireEvent.click(
      screen.getByText("Node.js already installed? Configure path manually →")
    );

    fireEvent.click(screen.getByText("Browse for Node.js folder"));

    await Promise.resolve();

    expect(updateSettingsMock).toHaveBeenCalled();
  });

  it("manual node config failure path", async () => {
    selectPathResult = {
      path: null,
      canceled: false,
      selectedPath: "/bad",
    };

    render(<SetupBanner />);
    await Promise.resolve();

    fireEvent.click(screen.getByText("1. Install Node.js (App Runtime)"));

    fireEvent.click(
      screen.getByText("Node.js already installed? Configure path manually →")
    );

    fireEvent.click(screen.getByText("Browse for Node.js folder"));

    await Promise.resolve();

    expect(updateSettingsMock).not.toHaveBeenCalled();
  });

  it("navigates to Google provider setup", async () => {
    render(<SetupBanner />);
    await Promise.resolve();

    fireEvent.click(screen.getByText("Setup Google Gemini API Key"));

    expect(captureMock).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/settings");
  });

  it("scrolls to other provider setup", async () => {
    render(<SetupBanner />);
    await Promise.resolve();

    fireEvent.click(screen.getByText("Setup other AI providers"));

    expect(scrollMock).toHaveBeenCalledWith("provider-settings");
  });

  it("renders and clicks OpenRouterSetupBanner", () => {
    render(<OpenRouterSetupBanner />);

    fireEvent.click(screen.getByText("Setup OpenRouter API Key"));

    expect(captureMock).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/settings");
  });
});
