import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// lucide-react
vi.mock("lucide-react", () => ({
  RefreshCw: () => <span data-testid="refresh-icon" />,
}));

// FileTree (MUST match relative path)
vi.mock("../FileTree", () => ({
  FileTree: ({ files }: any) => (
    <div data-testid="file-tree">{files.join(",")}</div>
  ),
}));

//FileEditor (MUST be mocked to avoid react-query)
vi.mock("../FileEditor", () => ({
  FileEditor: ({ appId, filePath }: any) => (
    <div data-testid="file-editor">
      {appId}:{filePath}
    </div>
  ),
}));

// useLoadApp
const refreshAppSpy = vi.fn();

vi.mock("@/hooks/useLoadApp", () => ({
  useLoadApp: () => ({
    refreshApp: refreshAppSpy,
  }),
}));

// jotai (atom-value only)
let selectedFileState: any = null;
let previewPanelKeyState = "panel-key";

vi.mock("jotai", async () => {
  return {
    atom: (v: any) => ({ __atom: v }),
    useAtomValue: (atom: any) => {
      if (atom.__atom === "selectedFile") return selectedFileState;
      if (atom.__atom === "previewPanelKey") return previewPanelKeyState;
      return null;
    },
    useAtom: () => [null, vi.fn()],
    useSetAtom: () => vi.fn(),
  };
});

// atoms
vi.mock("@/atoms/viewAtoms", () => ({
  selectedFileAtom: { __atom: "selectedFile" },
}));

vi.mock("@/atoms/appAtoms", () => ({
  previewPanelKeyAtom: { __atom: "previewPanelKey" },
}));

// Import Component
import { CodeView } from "../CodeView";

// TESTS
describe("CodeView", () => {
  beforeEach(() => {
    selectedFileState = null;
    previewPanelKeyState = "panel-key";
    refreshAppSpy.mockClear();
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    render(<CodeView loading={true} app={null} />);

    expect(screen.getByText("Loading files...")).toBeTruthy();
  });

  it("renders no app selected state", () => {
    render(<CodeView loading={false} app={null} />);

    expect(screen.getByText("No app selected")).toBeTruthy();
  });

  it("renders no files found state", () => {
    render(<CodeView loading={false} app={{ id: 1, files: [] }} />);

    expect(screen.getByText("No files found")).toBeTruthy();
  });

  it("renders file tree and empty editor prompt when no file selected", () => {
    render(
      <CodeView
        loading={false}
        app={{ id: 1, files: ["a.ts", "b.ts"] }}
      />
    );

    expect(screen.getByTestId("file-tree")).toBeTruthy();
    expect(screen.getByText("Select a file to view")).toBeTruthy();
    expect(screen.getByText("2 files")).toBeTruthy();
  });

  it("renders FileEditor when a file is selected", () => {
    selectedFileState = { path: "a.ts" };

    render(
      <CodeView
        loading={false}
        app={{ id: 10, files: ["a.ts"] }}
      />
    );

    expect(screen.getByTestId("file-editor")).toBeTruthy();
    expect(screen.getByText("10:a.ts")).toBeTruthy();
  });

  it("calls refreshApp when refresh button is clicked", () => {
    render(
      <CodeView
        loading={false}
        app={{ id: 5, files: ["a.ts"] }}
      />
    );

    fireEvent.click(screen.getByTitle("Refresh Files"));

    expect(refreshAppSpy).toHaveBeenCalled();
  });

  it("does not render toolbar when loading is true", () => {
    render(
      <CodeView
        loading={true}
        app={{ id: 5, files: ["a.ts"] }}
      />
    );

    expect(screen.queryByTitle("Refresh Files")).toBeFalsy();
  });
});
