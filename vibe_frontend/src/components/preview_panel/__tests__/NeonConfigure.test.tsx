import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// lucide-react
vi.mock("lucide-react", () => ({
  Database: () => <span />,
  GitBranch: () => <span />,
}));

// UI components
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

// NeonDisconnectButton
vi.mock("@/components/NeonDisconnectButton", () => ({
  NeonDisconnectButton: () => <div data-testid="neon-disconnect" />,
}));

// jotai
let selectedAppIdState: number | null = 1;

vi.mock("jotai", () => ({
  atom: (v: any) => ({ __atom: v }),
  useAtomValue: () => selectedAppIdState,
}));

vi.mock("@/atoms/appAtoms", () => ({
  selectedAppIdAtom: { __atom: "selectedAppId" },
}));

// useLoadApp
let appState: any = { neonProjectId: "np_1" };

vi.mock("@/hooks/useLoadApp", () => ({
  useLoadApp: () => ({ app: appState }),
}));

// IPC
const getNeonProjectSpy = vi.fn();
vi.mock("@/api/ipc_client", () => ({
  IpcClient: {
    getInstance: () => ({
      getNeonProject: (...args: any[]) => getNeonProjectSpy(...args),
    }),
  },
}));

// react-query
let queryState: {
  data: any;
  isLoading: boolean;
  error: any;
} = {
  data: null,
  isLoading: false,
  error: null,
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => queryState,
}));

// Import Component
import { NeonConfigure } from "../NeonConfigure";

// TESTS
describe("NeonConfigure", () => {
  beforeEach(() => {
    selectedAppIdState = 1;
    appState = { neonProjectId: "np_1" };
    queryState = { data: null, isLoading: false, error: null };
    vi.clearAllMocks();
  });

  it("returns null when app has no Neon project", () => {
    appState = { neonProjectId: null };

    const { container } = render(<NeonConfigure />);

    expect(container.firstChild).toBeFalsy();
  });

  it("renders loading state", () => {
    queryState.isLoading = true;

    render(<NeonConfigure />);

    expect(
      screen.getByText("Loading Neon project information...")
    ).toBeTruthy();
  });

  it("renders error state", () => {
    queryState.error = { message: "boom" };

    render(<NeonConfigure />);

    expect(
      screen.getByText("Error loading Neon project: boom")
    ).toBeTruthy();
  });

  it("returns null when no neon project data", () => {
    queryState.data = null;

    const { container } = render(<NeonConfigure />);

    expect(container.firstChild).toBeFalsy();
  });

  it("renders neon project information and branches", () => {
    queryState.data = {
      projectName: "Test Project",
      projectId: "proj_1",
      orgId: "org_1",
      branches: [
        {
          branchId: "b1",
          branchName: "main",
          type: "production",
          parentBranchName: null,
          lastUpdated: new Date().toISOString(),
        },
        {
          branchId: "b2",
          branchName: "dev",
          type: "development",
          parentBranchName: "main",
          lastUpdated: new Date().toISOString(),
        },
      ],
    };

    render(<NeonConfigure />);

    expect(screen.getByText("Neon Database")).toBeTruthy();
    expect(screen.getByText("Test Project")).toBeTruthy();
    expect(screen.getByText("proj_1")).toBeTruthy();
    expect(screen.getByText("org_1")).toBeTruthy();
    expect(screen.getByText("main")).toBeTruthy();
    expect(screen.getByText("dev")).toBeTruthy();
    expect(screen.getByTestId("neon-disconnect")).toBeTruthy();
  });
});
