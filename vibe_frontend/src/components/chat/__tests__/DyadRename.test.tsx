import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DyadRename } from "../DyadRename";

describe("DyadRename Component", () => {
  it("should render without crashing", () => {
    render(<DyadRename />);
    expect(document.body).toBeTruthy();
  });

  it("should render Rename label", () => {
    render(<DyadRename />);
    expect(screen.queryByText("Rename")).toBeTruthy();
  });

  it("should display file names when from and to props are provided", () => {
    render(
      <DyadRename
        from="/src/oldFile.ts"
        to="/src/newFile.ts"
      />
    );

    expect(screen.queryByText("oldFile.ts → newFile.ts")).toBeTruthy();
  });

  it("should display full from and to paths", () => {
    render(
      <DyadRename
        from="/src/oldFile.ts"
        to="/src/newFile.ts"
      />
    );

    expect(screen.queryByText(/From:/)).toBeTruthy();
    expect(screen.queryByText("/src/oldFile.ts")).toBeTruthy();
    expect(screen.queryByText(/To:/)).toBeTruthy();
    expect(screen.queryByText("/src/newFile.ts")).toBeTruthy();
  });

  it("should render children content when provided", () => {
    render(
      <DyadRename from="/a.ts" to="/b.ts">
        Rename explanation text
      </DyadRename>
    );

    expect(screen.queryByText("Rename explanation text")).toBeTruthy();
  });
});
