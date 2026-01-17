import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// MOCK lucide-react
vi.mock("lucide-react", () => ({
  AlertTriangle: () => <span data-testid="alert-icon" />,
}));

// IMPORT AFTER MOCKS
import { NodePathSelector } from "../NodePathSelector";

// TESTS
describe("NodePathSelector", () => {
  it("renders warning message and icon", () => {
    render(<NodePathSelector />);

    expect(
      screen.getByText(
        "Node.js path configuration is not available in web mode.",
      ),
    ).toBeTruthy();

    expect(
      screen.getByTestId("alert-icon"),
    ).toBeTruthy();
  });
});
