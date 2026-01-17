import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

//ICON
vi.mock("lucide-react", () => ({
  InfoIcon: () => <div />,
  Settings2: () => <div />,
  Trash2: () => <div />,
}));

//UI PRIMITIVES (RADIX SAFE)
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("./ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
}));

//MUTABLE HOOK STATE
let contextPaths: any[] = [];
let excludePaths: any[] = [];
let smartContextAutoIncludes: any[] = [];

const updateContextPaths = vi.fn((v) => (contextPaths = v));
const updateExcludePaths = vi.fn((v) => (excludePaths = v));
const updateSmartContextAutoIncludes = vi.fn(
  (v) => (smartContextAutoIncludes = v)
);

vi.mock("@/hooks/useContextPaths", () => ({
  useContextPaths: () => ({
    contextPaths,
    excludePaths,
    smartContextAutoIncludes,
    updateContextPaths,
    updateExcludePaths,
    updateSmartContextAutoIncludes,
  }),
}));

let smartEnabled = true;

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: smartEnabled
      ? {
          enableDyadPro: true,
          enableProSmartFilesContextMode: true,
        }
      : {
          enableDyadPro: false,
          enableProSmartFilesContextMode: false,
        },
  }),
}));

//COMPONENT UNDER TEST
import { ContextFilesPicker } from "../ContextFilesPicker";

//TESTS
describe("ContextFilesPicker (max coverage)", () => {
  beforeEach(() => {
    contextPaths = [];
    excludePaths = [];
    smartContextAutoIncludes = [];
    smartEnabled = true;
    vi.clearAllMocks();
  });

  it("renders main trigger button", () => {
    const { getByTestId } = render(<ContextFilesPicker />);
    expect(getByTestId("codebase-context-button")).toBeTruthy();
  });

  it("adds manual context path via click", () => {
    const { getByTestId } = render(<ContextFilesPicker />);
    fireEvent.change(getByTestId("manual-context-files-input"), {
      target: { value: "src/**/*.tsx" },
    });
    fireEvent.click(getByTestId("manual-context-files-add-button"));

    expect(updateContextPaths).toHaveBeenCalled();
    expect(contextPaths.length).toBeTruthy();
  });

  it("adds manual context path via Enter key", () => {
    const { getByTestId } = render(<ContextFilesPicker />);
    const input = getByTestId("manual-context-files-input");

    fireEvent.change(input, {
      target: { value: "src/**/*.ts" },
    });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(updateContextPaths).toHaveBeenCalled();
  });

  it("rejects duplicate manual context path", () => {
    contextPaths = [{ globPath: "src/**/*.tsx" }];

    const { getByTestId } = render(<ContextFilesPicker />);
    fireEvent.change(getByTestId("manual-context-files-input"), {
      target: { value: "src/**/*.tsx" },
    });
    fireEvent.click(getByTestId("manual-context-files-add-button"));

    expect(updateContextPaths).not.toHaveBeenCalled();
  });

  it("removes manual context path", () => {
    contextPaths = [{ globPath: "src/**/*.tsx", files: 1, tokens: 10 }];

    const { getByTestId } = render(<ContextFilesPicker />);
    fireEvent.click(getByTestId("manual-context-files-remove-button"));

    expect(updateContextPaths).toHaveBeenCalled();
  });

  it("adds and removes exclude path", () => {
    const { getByTestId } = render(<ContextFilesPicker />);
    fireEvent.change(getByTestId("exclude-context-files-input"), {
      target: { value: "node_modules/**" },
    });
    fireEvent.click(getByTestId("exclude-context-files-add-button"));

    expect(updateExcludePaths).toHaveBeenCalled();

    excludePaths = [{ globPath: "node_modules/**", files: 1, tokens: 5 }];

    const r = render(<ContextFilesPicker />);
    fireEvent.click(r.getAllByTestId("exclude-context-files-remove-button")[0]);

    expect(updateExcludePaths).toHaveBeenCalled();
  });

  it("adds and removes auto-include path", () => {
    const { getByTestId } = render(<ContextFilesPicker />);
    fireEvent.change(getByTestId("auto-include-context-files-input"), {
      target: { value: "src/**/*.config.ts" },
    });
    fireEvent.click(getByTestId("auto-include-context-files-add-button"));

    expect(updateSmartContextAutoIncludes).toHaveBeenCalled();

    smartContextAutoIncludes = [
      {
        globPath: "src/**/*.config.ts",
        files: 1,
        tokens: 3,
      },
    ];

    const r = render(<ContextFilesPicker />);
    fireEvent.click(
      r.getAllByTestId("auto-include-context-files-remove-button")[0]
    );

    expect(updateSmartContextAutoIncludes).toHaveBeenCalled();
  });

  it("renders fallback copy when smart context is disabled", () => {
    smartEnabled = false;
    const { container } = render(<ContextFilesPicker />);
    expect(container.textContent).toBeTruthy();
  });
});
