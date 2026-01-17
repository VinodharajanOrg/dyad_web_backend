import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// MOCK CodeHighlight 
vi.mock("../CodeHighlight", () => ({
  CodeHighlight: ({ children }: any) => (
    <div data-testid="code-highlight">{children}</div>
  ),
}));

// MOCK lucide-react Icon
vi.mock("lucide-react", () => ({
  ChevronsDownUp: () => <div />,
  ChevronsUpDown: () => <div />,
  Loader: () => <div />,
  CircleX: () => <div />,
  Rabbit: () => <div />,
}));

// IMPORT COMPONENT AFTER MOCKS
import { DyadEdit } from "../DyadEdit";

describe("DyadEdit Component", () => {
  it("should render without crashing", () => {
    render(<DyadEdit />);
    expect(document.body).toBeTruthy();
  });

  it("should render Turbo Edit label", () => {
    render(<DyadEdit />);
    const label = screen.queryByText(/turbo edit/i);
    expect(label).toBeTruthy();
  });

  it("should render file name when path is provided", () => {
    render(<DyadEdit path="/src/app/file.ts" />);
    expect(screen.queryByText("file.ts")).toBeTruthy();
  });

  it("should render description when provided", () => {
    render(<DyadEdit description="Refactor logic" />);
    expect(screen.queryByText(/refactor logic/i)).toBeTruthy();
  });

  it("should render code content when expanded", () => {
    const { container } = render(
      <DyadEdit path="/a.ts">const x = 1;</DyadEdit>
    );

    // Proper RTL event (auto wrapped in act)
    fireEvent.click(container.firstChild as HTMLElement);

    expect(screen.queryByTestId("code-highlight")).toBeTruthy();
  });
});
