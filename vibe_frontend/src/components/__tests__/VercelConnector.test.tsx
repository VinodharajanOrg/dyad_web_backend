import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// hoisted mocks
const mocks = vi.hoisted(() => ({
  refreshApp: vi.fn(),
  refreshSettings: vi.fn(),
  openExternalUrl: vi.fn(),
  getDeployments: vi.fn(),
  disconnectProject: vi.fn(),
}));

let mockApp: any = null;
let mockSettings: any = null;

// useLoadApp
vi.mock("@/hooks/useLoadApp", () => ({
  useLoadApp: () => ({
    app: mockApp,
    refreshApp: mocks.refreshApp,
  }),
}));

// useSettings
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: mockSettings,
    refreshSettings: mocks.refreshSettings,
  }),
}));

// openExternalUrl
vi.mock("@/utils/openExternalUrl", () => ({
  openExternalUrl: (url: string) => mocks.openExternalUrl(url),
}));

// useVercelDeployments
vi.mock("@/hooks/useVercelDeployments", () => ({
  useVercelDeployments: () => ({
    deployments: [
      {
        uid: "dep1",
        readyState: "READY",
        createdAt: Date.now(),
        url: "test.vercel.app",
      },
    ],
    isLoadingDeployments: false,
    error: null,
    getDeployments: mocks.getDeployments,
    disconnectProject: mocks.disconnectProject,
    isDisconnecting: false,
    disconnectError: null,
  }),
}));

// Radix Select
let onSelectChange: ((v: string) => void) | null = null;

vi.mock("@/components/ui/select", () => ({
  Select: ({ onValueChange, children }: any) => {
    onSelectChange = onValueChange;
    return <div>{children}</div>;
  },
  SelectTrigger: ({ children }: any) => <button>{children}</button>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => (
    <button onClick={() => onSelectChange?.(value)}>{children}</button>
  ),
}));

// UI components
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

// import after mocks
import { VercelConnector } from "../VercelConnector";

// tests
describe("VercelConnector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApp = null;
    mockSettings = null;
    onSelectChange = null;
  });

  it("renders unconnected state when no token exists", () => {
    mockSettings = {};

    render(<VercelConnector appId={1} folderName="my-app" />);

    expect(screen.getByTestId("vercel-unconnected-project")).toBeTruthy();
    expect(screen.getByText("Connect to Vercel")).toBeTruthy();
  });

  it("opens signup and settings links", () => {
    mockSettings = {};

    render(<VercelConnector appId={1} folderName="my-app" />);

    fireEvent.click(screen.getByText("Sign Up for Vercel"));
    fireEvent.click(screen.getByText("Open Vercel Settings"));

    expect(mocks.openExternalUrl).toHaveBeenCalledWith(
      "https://vercel.com/signup",
    );
    expect(mocks.openExternalUrl).toHaveBeenCalledWith(
      "https://vercel.com/account/settings/tokens",
    );
  });

  it("saves access token successfully", async () => {
    mockSettings = {};

    render(<VercelConnector appId={1} folderName="my-app" />);

    fireEvent.change(
      screen.getByPlaceholderText("Enter your Vercel access token"),
      { target: { value: "token123" } },
    );

    fireEvent.click(screen.getByText("Save Access Token"));

    await Promise.resolve();

    expect(mocks.refreshSettings).toHaveBeenCalled();
  });

  it("renders setup project view when token exists", () => {
    mockSettings = { vercelAccessToken: "token" };

    render(<VercelConnector appId={1} folderName="my-app" />);

    expect(screen.getByTestId("vercel-setup-project")).toBeTruthy();
    expect(screen.getByText("Set up your Vercel project")).toBeTruthy();
  });

  it("switches to existing project mode", () => {
    mockSettings = { vercelAccessToken: "token" };

    render(<VercelConnector appId={1} folderName="my-app" />);

    fireEvent.click(screen.getByText("Connect to existing project"));

    expect(screen.getByText("Select Project")).toBeTruthy();
  });

  it("allows selecting an existing project", () => {
    mockSettings = { vercelAccessToken: "token" };

    render(<VercelConnector appId={1} folderName="my-app" />);

    fireEvent.click(screen.getByText("Connect to existing project"));

    onSelectChange?.("project_123");

    const submit = screen.getByText("Connect to Project");

    expect(submit).toBeTruthy();
  });

  it("creates a new project", () => {
    mockSettings = { vercelAccessToken: "token" };

    render(<VercelConnector appId={1} folderName="my-app" />);

    const input = screen.getByTestId("vercel-create-project-name-input");
    fireEvent.change(input, { target: { value: "new-project" } });

    fireEvent.click(screen.getByText("Create Project"));

    expect(mocks.refreshApp).toHaveBeenCalled();
  });

  it("renders connected project view", () => {
    mockSettings = { vercelAccessToken: "token" };
    mockApp = {
      vercelProjectId: "p1",
      vercelProjectName: "my-vercel-app",
      vercelTeamSlug: "team",
      vercelDeploymentUrl: "https://my.vercel.app",
    };

    render(<VercelConnector appId={1} folderName="my-app" />);

    expect(screen.getByTestId("vercel-connected-project")).toBeTruthy();
    expect(screen.getByText("my-vercel-app")).toBeTruthy();
  });

  it("opens project and deployment URLs", () => {
    mockSettings = { vercelAccessToken: "token" };
    mockApp = {
      vercelProjectId: "p1",
      vercelProjectName: "my-vercel-app",
      vercelTeamSlug: "team",
      vercelDeploymentUrl: "https://my.vercel.app",
    };

    render(<VercelConnector appId={1} folderName="my-app" />);

    fireEvent.click(screen.getByText("my-vercel-app"));
    fireEvent.click(screen.getByText("View"));

    expect(mocks.openExternalUrl).toHaveBeenCalledWith(
      "https://vercel.com/team/my-vercel-app",
    );
    expect(mocks.openExternalUrl).toHaveBeenCalledWith(
      "https://test.vercel.app",
    );
  });

  it("refreshes deployments and disconnects project", () => {
    mockSettings = { vercelAccessToken: "token" };
    mockApp = {
      vercelProjectId: "p1",
      vercelProjectName: "my-vercel-app",
      vercelTeamSlug: "team",
    };

    render(<VercelConnector appId={1} folderName="my-app" />);

    fireEvent.click(screen.getByText("Refresh Deployments"));
    fireEvent.click(screen.getByText("Disconnect from project"));

    expect(mocks.getDeployments).toHaveBeenCalled();
    expect(mocks.disconnectProject).toHaveBeenCalled();
  });
});
