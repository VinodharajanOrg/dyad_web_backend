import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// SHARED STATE
let previewModeState: string = "preview";
let selectedAppIdState: number | null = 1;
let appOutputState: any[] = [];

// HOISTED ATOMS
const atoms = vi.hoisted(() => ({
  previewModeAtom: { __atom: "previewMode" },
  selectedAppIdAtom: { __atom: "selectedAppId" },
  previewPanelKeyAtom: { __atom: "previewPanelKey" },
  appOutputAtom: { __atom: "appOutput" },
}));

//MOCK atoms — BOTH PATHS
vi.mock("../../atoms/appAtoms", () => atoms);
vi.mock("@/atoms/appAtoms", () => atoms);

//MOCK jotai (robust + null-safe)
vi.mock("jotai", async () => {
  const React = await import("react");

  return {
    atom: (v: any) => ({ __atom: v }),

    useAtom: (atom: any) => {
      if (atom.__atom === "previewMode") {
        return [previewModeState, vi.fn()];
      }
      return React.useState(null);
    },

    useAtomValue: (atom: any) => {
      if (atom.__atom === "previewMode") return previewModeState;
      if (atom.__atom === "selectedAppId") return selectedAppIdState;
      if (atom.__atom === "previewPanelKey") return "panel-key";
      if (atom.__atom === "appOutput") return appOutputState; // NEVER null
      return null;
    },

    useSetAtom: () => vi.fn(),
  };
});

// next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/chat/123",
}));

// Mocked Child Components
vi.mock("../PreviewIframe", () => ({
  PreviewIframe: () => <div data-testid="preview-iframe" />,
}));
vi.mock("../CodeView", () => ({
  CodeView: () => <div data-testid="code-view" />,
}));
vi.mock("../ConfigurePanel", () => ({
  ConfigurePanel: () => <div data-testid="configure-panel" />,
}));
vi.mock("../PublishPanel", () => ({
  PublishPanel: () => <div data-testid="publish-panel" />,
}));
vi.mock("../SecurityPanel", () => ({
  SecurityPanel: () => <div data-testid="security-panel" />,
}));
vi.mock("../Problems", () => ({
  Problems: () => <div data-testid="problems-panel" />,
}));
vi.mock("../Console", () => ({
  Console: () => <div data-testid="console-panel" />,
}));

// MOCK SIDE EFFECT HOOKS
vi.mock("@/hooks/useRunApp", () => ({
  useRunApp: () => ({
    runApp: vi.fn(),
    stopApp: vi.fn(),
    loading: false,
    app: null,
  }),
}));

vi.mock("@/hooks/useContainerLogStream", () => ({
  useContainerLogStream: vi.fn(),
}));


import { PreviewPanel } from "../PreviewPanel";

// TESTS
describe("PreviewPanel", () => {
  beforeEach(() => {
    previewModeState = "preview";
    selectedAppIdState = 1;
    appOutputState = [];
  });

  it("renders preview iframe by default", () => {
    render(<PreviewPanel />);
    expect(screen.getByTestId("preview-iframe")).toBeTruthy();
  });

  it("renders code view when previewMode is code", () => {
    previewModeState = "code";
    render(<PreviewPanel />);
    expect(screen.getByTestId("code-view")).toBeTruthy();
  });

  it("renders configure panel when previewMode is configure", () => {
    previewModeState = "configure";
    render(<PreviewPanel />);
    expect(screen.getByTestId("configure-panel")).toBeTruthy();
  });

  it("renders publish panel when previewMode is publish", () => {
    previewModeState = "publish";
    render(<PreviewPanel />);
    expect(screen.getByTestId("publish-panel")).toBeTruthy();
  });

  it("renders security panel when previewMode is security", () => {
    previewModeState = "security";
    render(<PreviewPanel />);
    expect(screen.getByTestId("security-panel")).toBeTruthy();
  });

  it("renders problems panel for unknown mode", () => {
    previewModeState = "unknown";
    render(<PreviewPanel />);
    expect(screen.getByTestId("problems-panel")).toBeTruthy();
  });

  it("toggles console open and close", () => {
    appOutputState = [{ message: "hello" }];

    render(<PreviewPanel />);

    fireEvent.click(screen.getByText("System Messages"));
    expect(screen.getByTestId("console-panel")).toBeTruthy();

    fireEvent.click(screen.getByText("System Messages"));
    expect(screen.queryByTestId("console-panel")).toBeNull();
  });
});
