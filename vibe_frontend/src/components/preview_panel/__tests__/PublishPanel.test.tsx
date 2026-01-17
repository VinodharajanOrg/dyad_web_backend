import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// IMPORT COMPONENT
import { PublishPanel } from "../PublishPanel";

// TESTS
describe("PublishPanel", () => {
  it("renders publish panel container", () => {
    render(<PublishPanel />);
    expect(
      screen.getByText("Publish Feature")
    ).toBeTruthy();
  });

  it("renders description text", () => {
    render(<PublishPanel />);
    expect(
      screen.getByText(
        "Click the Publish button in the header to open your running application in a new tab."
      )
    ).toBeTruthy();
  });

  it("renders icon svg", () => {
    const { container } = render(<PublishPanel />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("renders heading with correct semantic level", () => {
    render(<PublishPanel />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toBe("Publish Feature");
  });
});
