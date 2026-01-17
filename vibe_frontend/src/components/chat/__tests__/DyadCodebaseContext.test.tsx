import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// MOCK lucide-react BEFORE importing component
vi.mock("lucide-react", () => ({
  ChevronUp: () => <div data-testid="chevron-up" />,
  ChevronDown: () => <div data-testid="chevron-down" />,
  Code2: () => <div data-testid="code-icon" />,
  FileText: () => <div data-testid="file-icon" />,
}));

// IMPORT COMPONENT AFTER MOCKS
import { DyadCodebaseContext } from "../DyadCodebaseContext";

// TEST SUITE
describe("DyadCodebaseContext Component", () => {
  it("renders safely", () => {
    render(<DyadCodebaseContext>{null}</DyadCodebaseContext>);
    expect(document.body).toBeTruthy();
  });

  it("renders Codebase Context label", () => {
    render(<DyadCodebaseContext>{null}</DyadCodebaseContext>);
    expect(screen.getByText("Codebase Context")).toBeTruthy();
  });

  it("renders files when provided via node properties", () => {
    render(
      <DyadCodebaseContext
        node={{ properties: { files: "src/app.ts,src/utils.ts" } }}
      >
        {null}
      </DyadCodebaseContext>
    );

    expect(screen.getByText("app.ts")).toBeTruthy();
    expect(screen.getByText("utils.ts")).toBeTruthy();
  });

  it("auto-expands when state is pending", () => {
    render(
      <DyadCodebaseContext
        node={{
          properties: {
            state: "pending",
            files: "src/index.ts",
          },
        }}
      >
        {null}
      </DyadCodebaseContext>
    );

    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("toggles expanded state on click", () => {
    const { container } = render(
      <DyadCodebaseContext
        node={{ properties: { files: "src/index.ts" } }}
      >
        {null}
      </DyadCodebaseContext>
    );

    const wrapper = container.firstChild as HTMLElement;

    expect(wrapper.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(wrapper);
    expect(wrapper.getAttribute("aria-expanded")).toBe("true");
  });

  it("toggles expanded state using keyboard (Enter & Space)", () => {
    const { container } = render(
      <DyadCodebaseContext
        node={{ properties: { files: "src/index.ts" } }}
      >
        {null}
      </DyadCodebaseContext>
    );

    const wrapper = container.firstChild as HTMLElement;

    fireEvent.keyDown(wrapper, { key: "Enter" });
    expect(wrapper.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(wrapper, { key: " " });
    expect(wrapper.getAttribute("aria-expanded")).toBe("false");
  });

  it("does not crash when node is missing", () => {
    render(<DyadCodebaseContext>{null}</DyadCodebaseContext>);
    expect(document.body).toBeTruthy();
  });
});
