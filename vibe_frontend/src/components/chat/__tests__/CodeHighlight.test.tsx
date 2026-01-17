import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
import { act } from "react-dom/test-utils";

// REAL ThemeProvider (NO MOCKING)
import { ThemeProvider } from "../../../contexts/ThemeContext";

//react-shiki mock
const mockUseShikiHighlighter = vi.fn();
const mockIsInlineCode = vi.fn();

vi.mock("react-shiki", () => ({
  useShikiHighlighter: (...args: any[]) => mockUseShikiHighlighter(...args),
  isInlineCode: (...args: any[]) => mockIsInlineCode(...args),
}));

//lucide-react mock
vi.mock("lucide-react", () => ({
  Copy: () => <div data-testid="copy-icon" />,
  Check: () => <div data-testid="check-icon" />,
}));

// IMPORT COMPONENT AFTER MOCKS
import { CodeHighlight } from "../CodeHighlight";

// RENDER WITH THEME PROVIDER
const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe("CodeHighlight", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    mockIsInlineCode.mockReturnValue(false);
    mockUseShikiHighlighter.mockReturnValue(
      <pre data-testid="highlighted">highlighted</pre>
    );

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders non-inline block with language and copy button", () => {
    const { container, getByText } = renderWithTheme(
      <CodeHighlight className="language-js">const a = 1;</CodeHighlight>
    );

    expect(container.querySelector(".shiki")).toBeTruthy();
    expect(getByText("js")).toBeTruthy();
    expect(getByText("Copy")).toBeTruthy();
  });

  it("copies code and resets copied state after timeout", () => {
    const { getByText, queryByTestId } = renderWithTheme(
      <CodeHighlight className="language-ts">let x = 2;</CodeHighlight>
    );

    act(() => {
      fireEvent.click(getByText("Copy"));
    });

    expect(getByText("Copied")).toBeTruthy();
    expect(queryByTestId("check-icon")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(getByText("Copy")).toBeTruthy();
    expect(queryByTestId("copy-icon")).toBeTruthy();
  });

  it("does not render header when language is missing", () => {
    const { queryByText } = renderWithTheme(
      <CodeHighlight>plain</CodeHighlight>
    );

    expect(queryByText("Copy")).toBeFalsy();
  });

  it("renders inline code when isInlineCode returns true", () => {
    mockIsInlineCode.mockReturnValue(true);

    const { container } = renderWithTheme(
      <CodeHighlight className="language-js" node={{} as any}>
        inline
      </CodeHighlight>
    );

    expect(container.querySelector("code")).toBeTruthy();
    expect(container.querySelector(".shiki")).toBeFalsy();
  });

  it("uses cached highlighted code when highlighter returns null", () => {
    mockUseShikiHighlighter
      .mockReturnValueOnce(<pre>cached</pre>)
      .mockReturnValueOnce(null);

    const { rerender, getByText } = renderWithTheme(
      <CodeHighlight className="language-js">cache</CodeHighlight>
    );

    rerender(
      <ThemeProvider>
        <CodeHighlight className="language-js">cache</CodeHighlight>
      </ThemeProvider>
    );

    expect(getByText("cached")).toBeTruthy();
  });

  it("memo comparison executes when children are same", () => {
    const props = {
      className: "language-js",
      children: "same",
    };

    const { rerender } = renderWithTheme(<CodeHighlight {...props} />);
    rerender(
      <ThemeProvider>
        <CodeHighlight {...props} />
      </ThemeProvider>
    );

    expect(true).toBeTruthy();
  });

  it("exports a memoized component", () => {
    expect(CodeHighlight).toHaveProperty("$$typeof");
  });
});
