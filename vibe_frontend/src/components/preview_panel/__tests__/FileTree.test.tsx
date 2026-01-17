import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// lucide-react
vi.mock("lucide-react", () => ({
  Folder: () => <span data-testid="folder-icon" />,
  FolderOpen: () => <span data-testid="folder-open-icon" />,
}));

// jotai
const setSelectedFileSpy = vi.fn();

vi.mock("jotai", () => ({
  atom: (v: any) => ({ __atom: v }),
  useSetAtom: () => setSelectedFileSpy,
}));

// atoms
vi.mock("@/atoms/viewAtoms", () => ({
  selectedFileAtom: { __atom: "selectedFile" },
}));

// Import Component
import { FileTree } from "../FileTree";

// TESTS
describe("FileTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders file tree structure", () => {
    render(
      <FileTree
        files={[
          "src/index.ts",
          "src/app.ts",
          "README.md",
        ]}
      />
    );

    expect(screen.getByText("src")).toBeTruthy();
    expect(screen.getByText("index.ts")).toBeTruthy();
    expect(screen.getByText("app.ts")).toBeTruthy();
    expect(screen.getByText("README.md")).toBeTruthy();
  });

  it("renders directories before files (sorted)", () => {
    render(
      <FileTree
        files={[
          "b.ts",
          "a/index.ts",
        ]}
      />
    );

    const texts = screen.getAllByText(/.+/).map(n => n.textContent);

    expect(texts).toContain("a");
    expect(texts).toContain("b.ts");
  });

  it("toggles directory expansion on click", () => {
    render(
      <FileTree
        files={[
          "src/a.ts",
          "src/nested/b.ts",
        ]}
      />
    );

    const srcNode = screen.getByText("src");

    fireEvent.click(srcNode); // collapse
    fireEvent.click(srcNode); // expand

    expect(screen.getByText("a.ts")).toBeTruthy();
  });

  it("selects file when clicking file node", () => {
    render(
      <FileTree
        files={[
          "src/a.ts",
        ]}
      />
    );

    fireEvent.click(screen.getByText("a.ts"));

    expect(setSelectedFileSpy).toHaveBeenCalledWith({
      path: "src/a.ts",
    });
  });

  it("does not set selected file when clicking directory", () => {
    render(
      <FileTree
        files={[
          "src/a.ts",
        ]}
      />
    );

    fireEvent.click(screen.getByText("src"));

    expect(setSelectedFileSpy).not.toHaveBeenCalled();
  });

  it("renders nested directories recursively", () => {
    render(
      <FileTree
        files={[
          "a/b/c/d.ts",
        ]}
      />
    );

    // expand deeper levels explicitly
    fireEvent.click(screen.getByText("c"));

    expect(screen.getByText("a")).toBeTruthy();
    expect(screen.getByText("b")).toBeTruthy();
    expect(screen.getByText("c")).toBeTruthy();
    expect(screen.getByText("d.ts")).toBeTruthy();
  });
});
