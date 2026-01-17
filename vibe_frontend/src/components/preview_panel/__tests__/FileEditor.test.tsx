import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// SHARED STATE
let loadState = {
  content: "initial content",
  loading: false,
  error: null as any,
};

// monaco editor
vi.mock("@monaco-editor/react", () => ({
  default: ({ onChange, onMount }: any) => {
    React.useEffect(() => {
      if (onMount) {
        onMount(
          {
            onDidBlurEditorText: (cb: any) => cb(),
          },
          {}
        );
      }
    }, []);
    return (
      <textarea
        data-testid="monaco-editor"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  },
}));

//lucide-react
vi.mock("lucide-react", () => ({
  ChevronRight: () => <span />,
  Circle: () => <span data-testid="unsaved-indicator" />,
  Save: () => <span />,
}));

// ui components
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

// hooks
vi.mock("@/hooks/useLoadAppFile", () => ({
  useLoadAppFile: () => loadState,
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({ settings: { enableAutoFixProblems: true } }),
}));

const checkProblemsSpy = vi.fn();
vi.mock("@/hooks/useCheckProblems", () => ({
  useCheckProblems: () => ({
    checkProblems: checkProblemsSpy,
  }),
}));

vi.mock("@/components/chat/monaco", () => ({
  initializeMonaco: vi.fn(),
}));

// api + toast
const writeFileSpy = vi.fn();
vi.mock("@/api/endpoints/files", () => ({
  filesApi: {
    writeFile: (...args: any[]) => writeFileSpy(...args),
  },
}));

const showErrorSpy = vi.fn();
const showSuccessSpy = vi.fn();
const showWarningSpy = vi.fn();

vi.mock("@/lib/toast", () => ({
  showError: (e: any) => showErrorSpy(e),
  showSuccess: (m: any) => showSuccessSpy(m),
  showWarning: (m: any) => showWarningSpy(m),
}));

// react-query
const invalidateSpy = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateSpy,
  }),
}));

// language utils
vi.mock("@/utils/get_language", () => ({
  getLanguage: () => "typescript",
}));

// IMPORT COMPONENT
import { FileEditor } from "../FileEditor";

// TESTS
describe("FileEditor", () => {
  beforeEach(() => {
    loadState = {
      content: "initial content",
      loading: false,
      error: null,
    };
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    loadState = { content: "", loading: true, error: null };

    render(<FileEditor appId={1} filePath="a.ts" />);

    expect(
      screen.getByText("Loading file content...")
    ).toBeTruthy();
  });

  it("renders error state", () => {
    loadState = {
      content: "",
      loading: false,
      error: { message: "boom" },
    };

    render(<FileEditor appId={1} filePath="a.ts" />);

    expect(screen.getByText("Error: boom")).toBeTruthy();
  });

  it("renders no content state", () => {
    loadState = {
      content: "",
      loading: false,
      error: null,
    };

    render(<FileEditor appId={1} filePath="a.ts" />);

    expect(
      screen.getByText("No content available")
    ).toBeTruthy();
  });

  it("shows unsaved changes when editor content changes", () => {
    render(<FileEditor appId={1} filePath="a.ts" />);

    fireEvent.change(screen.getByTestId("monaco-editor"), {
      target: { value: "changed" },
    });

    expect(
      screen.getByTestId("unsaved-indicator")
    ).toBeTruthy();
  });

  it("saves file and shows success message", async () => {
    writeFileSpy.mockResolvedValueOnce({});

    render(<FileEditor appId={1} filePath="a.ts" />);

    fireEvent.change(screen.getByTestId("monaco-editor"), {
      target: { value: "changed" },
    });

    fireEvent.click(screen.getByTestId("save-file-button"));

    await act(async () => {});

    expect(writeFileSpy).toHaveBeenCalled();
    expect(showSuccessSpy).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();
    expect(checkProblemsSpy).toHaveBeenCalled();
  });

  it("shows warning when backend returns warning", async () => {
    writeFileSpy.mockResolvedValueOnce({ warning: "lint issue" });

    render(<FileEditor appId={1} filePath="a.ts" />);

    fireEvent.change(screen.getByTestId("monaco-editor"), {
      target: { value: "changed" },
    });

    fireEvent.click(screen.getByTestId("save-file-button"));

    await act(async () => {});

    expect(showWarningSpy).toHaveBeenCalledWith("lint issue");
  });

  it("handles save error", async () => {
    writeFileSpy.mockRejectedValueOnce("fail");

    render(<FileEditor appId={1} filePath="a.ts" />);

    fireEvent.change(screen.getByTestId("monaco-editor"), {
      target: { value: "changed" },
    });

    fireEvent.click(screen.getByTestId("save-file-button"));

    await act(async () => {});

    expect(showErrorSpy).toHaveBeenCalled();
  });
});
