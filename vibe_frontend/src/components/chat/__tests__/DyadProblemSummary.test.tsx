import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// TYPE DECLARATIONS FOR CUSTOM JSX ELEMENTS
declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      problem: {
        children?: any;
        file?: string;
        line?: number | string;
        column?: number | string;
        code?: string | number;
      };
    }
  }
}

// IMPORT AFTER ALL SETUPS
import { DyadProblemSummary } from "../DyadProblemSummary";

describe("DyadProblemSummary Component (Option A)", () => {
  it("renders safely", () => {
    render(<DyadProblemSummary />);
    expect(document.body).toBeTruthy();
  });

  it("renders custom summary text", () => {
    render(
      <DyadProblemSummary summary="Custom summary text">
        Raw text
      </DyadProblemSummary>
    );

    expect(screen.getByText(/custom summary text/i)).toBeTruthy();
  });

  it("uses default summary when none is provided", () => {
    render(
      <DyadProblemSummary>
        {/* no string children → 0 problems */}
        <div>JSX child</div>
      </DyadProblemSummary>
    );

    expect(
      screen.getByText(/0 problems found \(TypeScript errors\)/i)
    ).toBeTruthy();
  });

  it("expands and collapses content on click", () => {
    render(
      <DyadProblemSummary summary="Expandable">
        Raw error output
      </DyadProblemSummary>
    );

    const container = screen.getByTestId("problem-summary");

    // expand
    fireEvent.click(container);
    expect(screen.getByText(/raw error output/i)).toBeTruthy();

    // collapse
    fireEvent.click(container);
    expect(screen.queryByText(/raw error output/i)).toBeNull();
  });

  it("renders parsed problems and covers ProblemItem", () => {
    const input = `
<problem file="src/test.ts" line="10" column="5" code="1234">
Test error message
</problem>
    `.trim();

    render(<DyadProblemSummary>{input}</DyadProblemSummary>);

    fireEvent.click(screen.getByTestId("problem-summary"));

    // ProblemItem internals
    expect(screen.getByText("src/test.ts")).toBeTruthy();
    expect(screen.getByText("10:5")).toBeTruthy();
    expect(screen.getByText("TS1234")).toBeTruthy();
    expect(screen.getByText(/test error message/i)).toBeTruthy();
  });

  it("falls back to raw <pre> content when no <problem> tags exist", () => {
    render(
      <DyadProblemSummary summary="Fallback test">
        Raw error output text
      </DyadProblemSummary>
    );

    fireEvent.click(screen.getByTestId("problem-summary"));

    expect(
      screen.getByText(/raw error output text/i)
    ).toBeTruthy();
  });

  it("handles non-string children by returning empty problems list", () => {
    render(
      <DyadProblemSummary summary="Non-string">
        <div>JSX child</div>
      </DyadProblemSummary>
    );

    fireEvent.click(screen.getByTestId("problem-summary"));

    // Summary remains custom
    expect(screen.getByText("Non-string")).toBeTruthy();

    // Raw fallback rendered
    expect(screen.getByText("JSX child")).toBeTruthy();
  });
});
