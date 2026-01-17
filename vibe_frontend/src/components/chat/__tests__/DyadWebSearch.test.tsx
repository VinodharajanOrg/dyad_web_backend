import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DyadWebSearch } from "../DyadWebSearch";

describe("DyadWebSearch Component", () => {
  it("should render without crashing", () => {
    render(<DyadWebSearch />);
    expect(document.body).toBeTruthy();
  });

  it("should render Web Search label", () => {
    render(<DyadWebSearch />);
    expect(screen.getByText("Web Search")).toBeTruthy();
  });

  it("should render query from query prop", () => {
    render(<DyadWebSearch query="react testing library" />);
    expect(screen.getByText("react testing library")).toBeTruthy();
  });

  it("should render query from children when query prop is not provided", () => {
    render(<DyadWebSearch>nextjs vitest setup</DyadWebSearch>);
    expect(screen.getByText("nextjs vitest setup")).toBeTruthy();
  });

  it("should not crash when both query and children are empty", () => {
    render(<DyadWebSearch />);
    expect(document.body).toBeTruthy();
  });
});
