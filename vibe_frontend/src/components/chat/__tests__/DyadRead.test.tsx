import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DyadRead } from "../DyadRead";

describe("DyadRead Component", () => {
  it("should render without crashing", () => {
    render(<DyadRead />);
    expect(document.body).toBeTruthy();
  });

  it("should render Read label", () => {
    render(<DyadRead />);
    expect(screen.queryByText("Read")).toBeTruthy();
  });

  it("should display file name when path is provided", () => {
    render(<DyadRead path="/src/utils/file.ts" />);
    expect(screen.queryByText("file.ts")).toBeTruthy();
  });

  it("should display full file path when provided", () => {
    render(<DyadRead path="/src/utils/file.ts" />);
    expect(screen.queryByText("/src/utils/file.ts")).toBeTruthy();
  });

  it("should render file content when children are provided", () => {
    render(
      <DyadRead path="/src/utils/file.ts">
        File content goes here
      </DyadRead>
    );

    expect(screen.queryByText("File content goes here")).toBeTruthy();
  });

  it("should not crash when node is used instead of path prop", () => {
    render(
      <DyadRead
        node={{
          properties: {
            path: "/src/index.ts",
          },
        }}
      >
        Index file content
      </DyadRead>
    );

    expect(screen.queryByText("index.ts")).toBeTruthy();
    expect(screen.queryByText("Index file content")).toBeTruthy();
  });
});
