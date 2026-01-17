import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DyadWebSearchResult } from "../DyadWebSearchResult";

describe("DyadWebSearchResult Component", () => {
  it("renders without crashing", () => {
    render(<DyadWebSearchResult />);
    expect(document.body).toBeTruthy();
  });

  it("renders Web Search Result label", () => {
    render(<DyadWebSearchResult />);
    expect(screen.getByText("Web Search Result")).toBeTruthy();
  });

  it("is collapsed by default when state is not pending", () => {
    render(<DyadWebSearchResult>Result content here</DyadWebSearchResult>);

    const container = screen.getByRole("button");

    expect(container.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Result content here")).toBeTruthy();
  });

  it("auto-expands when state is pending", () => {
    render(
      <DyadWebSearchResult
        node={{
          properties: {
            state: "pending",
          },
        }}
      >
        Loading search results...
      </DyadWebSearchResult>
    );

    const container = screen.getByRole("button");

    expect(container.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Loading search results...")).toBeTruthy();
  });

  it("collapses when state changes from pending to non-pending", () => {
    const { rerender } = render(
      <DyadWebSearchResult
        node={{
          properties: {
            state: "pending",
          },
        }}
      >
        Loading...
      </DyadWebSearchResult>
    );

    const container = screen.getByRole("button");

    // initially expanded
    expect(container.getAttribute("aria-expanded")).toBe("true");

    // transition to non-pending
    rerender(
      <DyadWebSearchResult
        node={{
          properties: {
            state: "done",
          },
        }}
      >
        Loading...
      </DyadWebSearchResult>
    );

    expect(container.getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles expansion on click", () => {
    render(
      <DyadWebSearchResult>
        Search result markdown content
      </DyadWebSearchResult>
    );

    const container = screen.getByRole("button");

    expect(container.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(container);
    expect(container.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(container);
    expect(container.getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles expansion using Enter and Space keys", () => {
    render(
      <DyadWebSearchResult>
        Keyboard interaction content
      </DyadWebSearchResult>
    );

    const container = screen.getByRole("button");

    // Enter key
    fireEvent.keyDown(container, { key: "Enter" });
    expect(container.getAttribute("aria-expanded")).toBe("true");

    // Space key
    fireEvent.keyDown(container, { key: " " });
    expect(container.getAttribute("aria-expanded")).toBe("false");
  });
});
