import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DyadThink } from "../DyadThink";

describe("DyadThink Component", () => {
  it("renders without crashing", () => {
    render(<DyadThink />);
    expect(document.body).toBeTruthy();
  });

  it("renders Thinking label", () => {
    render(<DyadThink />);
    expect(screen.getByText("Thinking")).toBeTruthy();
  });

  it("renders children content when expanded via click", () => {
    render(<DyadThink>Some thought content</DyadThink>);

    const container = screen.getByRole("button");
    fireEvent.click(container);

    expect(screen.getByText("Some thought content")).toBeTruthy();
  });

  it("auto-expands when state is pending", () => {
    render(
      <DyadThink
        node={{
          properties: {
            state: "pending",
          },
        }}
      >
        Pending thought
      </DyadThink>
    );

    const container = screen.getByRole("button");

    expect(container.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Pending thought")).toBeTruthy();
  });

  it("collapses when state changes from pending to non-pending", () => {
    const { rerender } = render(
      <DyadThink
        node={{
          properties: {
            state: "pending",
          },
        }}
      >
        Transitioning thought
      </DyadThink>
    );

    const container = screen.getByRole("button");

    // initially expanded
    expect(container.getAttribute("aria-expanded")).toBe("true");

    // transition to non-pending
    rerender(
      <DyadThink
        node={{
          properties: {
            state: "done",
          },
        }}
      >
        Transitioning thought
      </DyadThink>
    );

    expect(container.getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles expansion using Enter and Space keys", () => {
    render(<DyadThink>Keyboard toggle content</DyadThink>);

    const container = screen.getByRole("button");

    // Enter key expands
    fireEvent.keyDown(container, { key: "Enter" });
    expect(container.getAttribute("aria-expanded")).toBe("true");

    // Space key collapses
    fireEvent.keyDown(container, { key: " " });
    expect(container.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders ReactNode children when provided", () => {
    render(
      <DyadThink>
        <div data-testid="custom-node">Custom Node</div>
      </DyadThink>
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByTestId("custom-node")).toBeTruthy();
  });

  it("renders token savings summary and skips Thinking UI", () => {
    render(
      <DyadThink>
        dyad-token-savings?original-tokens=1000&smart-context-tokens=400
      </DyadThink>
    );

    expect(screen.queryByText(/saved/i)).toBeTruthy();
    expect(screen.queryByText(/smart context/i)).toBeTruthy();

    // Thinking UI should NOT render
    expect(screen.queryByText("Thinking")).toBeNull();
  });
});
