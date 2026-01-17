import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { DyadWrite } from "../DyadWrite";

// jotai
vi.mock("jotai", async () => {
  const actual = await vi.importActual<typeof import("jotai")>("jotai");
  return {
    ...actual,
    useAtomValue: () => "app-123",
  };
});

// CORRECT relative path to FileEditor
vi.mock("../../preview_panel/FileEditor", () => ({
  FileEditor: ({ filePath }: { filePath: string }) => (
    <div data-testid="file-editor">Editing {filePath}</div>
  ),
}));

vi.mock("../CodeHighlight", () => ({
  CodeHighlight: ({ children }: { children: React.ReactNode }) => (
    <pre data-testid="code-highlight">{children}</pre>
  ),
}));

// HELPERS
const renderAndExpand = (ui: React.ReactElement) => {
  const { container } = render(ui);
  const root = container.firstChild as HTMLElement;
  fireEvent.click(root); // expand safely
  return { root };
};

// TESTS
describe("DyadWrite – high coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders filename, path and description from props", () => {
    render(
      <DyadWrite
        path="/src/index.ts"
        description="Writes logic"
      >
        console.log("hi");
      </DyadWrite>,
    );

    expect(screen.getByText("index.ts")).toBeTruthy();
    expect(screen.getByText("/src/index.ts")).toBeTruthy();
    expect(screen.getByText("Writes logic")).toBeTruthy();
  });

  it("uses node.properties as fallback for path and description", () => {
    render(
      <DyadWrite
        node={{
          properties: {
            path: "/lib/util.ts",
            description: "Utility file",
          },
        }}
      >
        util code
      </DyadWrite>,
    );

    expect(screen.getByText("util.ts")).toBeTruthy();
    expect(screen.getByText("/lib/util.ts")).toBeTruthy();
    expect(screen.getByText("Utility file")).toBeTruthy();
  });

  it("is collapsed by default and expands on click", () => {
    const { container } = render(<DyadWrite>file content</DyadWrite>);

    expect(screen.queryByTestId("code-highlight")).toBeNull();

    fireEvent.click(container.firstChild as HTMLElement);

    expect(screen.getByTestId("code-highlight")).toBeTruthy();
  });

  it("renders CodeHighlight when expanded and not editing", () => {
    renderAndExpand(
      <DyadWrite>
        const x = 1;
      </DyadWrite>,
    );

    expect(screen.getByTestId("code-highlight")).toBeTruthy();
    expect(screen.queryByTestId("file-editor")).toBeNull();
  });

  it("enters edit mode when Edit is clicked", () => {
    renderAndExpand(
      <DyadWrite path="/src/app.ts">
        code
      </DyadWrite>,
    );

    fireEvent.click(screen.getByText("Edit"));

    expect(screen.getByTestId("file-editor")).toBeTruthy();
    expect(screen.getByText("Editing /src/app.ts")).toBeTruthy();
  });

  it("exits edit mode when Cancel is clicked", () => {
    renderAndExpand(
      <DyadWrite path="/src/app.ts">
        code
      </DyadWrite>,
    );

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.getByTestId("code-highlight")).toBeTruthy();
  });

  it("shows Writing state when state is pending", () => {
    render(
      <DyadWrite node={{ properties: { state: "pending" } }}>
        pending
      </DyadWrite>,
    );

    expect(screen.getByText("Writing...")).toBeTruthy();
  });

  it("shows aborted state when state is aborted", () => {
    render(
      <DyadWrite node={{ properties: { state: "aborted" } }}>
        aborted
      </DyadWrite>,
    );

    expect(screen.getByText("Did not finish")).toBeTruthy();
  });

  it("does not show Edit button when in progress", () => {
    render(
      <DyadWrite node={{ properties: { state: "pending" } }}>
        content
      </DyadWrite>,
    );

    expect(screen.queryByText("Edit")).toBeNull();
  });
});
