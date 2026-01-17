import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// MOCK CodeHighlight BEFORE importing component
vi.mock("../CodeHighlight", () => ({
  CodeHighlight: ({ children }: any) => (
    <pre data-testid="code-highlight">{children}</pre>
  ),
}));

// MOCK lucide-react icons
vi.mock("lucide-react", () => ({
  Database: () => <div data-testid="database-icon" />,
  ChevronsDownUp: () => <div />,
  ChevronsUpDown: () => <div />,
  Loader: () => <div />,
  CircleX: () => <div />,
}));

// IMPORT AFTER MOCKS
import { DyadExecuteSql } from "../DyadExecuteSql";

// TEST SUITE
describe("DyadExecuteSql Component", () => {
  it("should render without crashing", () => {
    render(<DyadExecuteSql />);
    expect(document.body).toBeTruthy();
  });

  it("should render SQL label and database icon", () => {
    render(<DyadExecuteSql description="Fetch users" />);

    const sqlLabel = screen.getByText(/sql/i);
    const icon = screen.queryByTestId("database-icon");

    expect(sqlLabel).toBeTruthy();
    expect(icon).toBeTruthy();
  });

  it("should render description text when provided", () => {
    render(<DyadExecuteSql description="Fetch users" />);

    const description = screen.getByText(/fetch users/i);
    expect(description).toBeTruthy();
  });

  it("should expand and render SQL content when clicked", () => {
    render(
      <DyadExecuteSql>
        SELECT * FROM users;
      </DyadExecuteSql>
    );

    // Click the clickable container (root div)
    const container = screen.getByText(/sql/i).closest("div");
    expect(container).toBeTruthy();

    fireEvent.click(container!);

    const code = screen.queryByTestId("code-highlight");
    expect(code).toBeTruthy();
  });

  it("should not crash when node is missing", () => {
    render(<DyadExecuteSql node={undefined} />);
    expect(document.body).toBeTruthy();
  });
});
