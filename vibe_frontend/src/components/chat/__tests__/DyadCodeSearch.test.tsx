import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// MOCK lucide-react BEFORE importing component
vi.mock("lucide-react", () => ({
  FileCode: () => <div data-testid="file-code-icon" />,
}));

// IMPORT COMPONENT AFTER MOCKS
import { DyadCodeSearch } from "../DyadCodeSearch";

// TEST SUITE
describe("DyadCodeSearch Component", () => {
  it("should render without crashing", () => {
    render(<DyadCodeSearch />);
    expect(document.body).toBeTruthy();
  });

  it("should render Code Search label", () => {
    render(<DyadCodeSearch />);
    expect(screen.queryByText("Code Search")).toBeTruthy();
  });

  it("should render FileCode icon", () => {
    render(<DyadCodeSearch />);
    expect(screen.queryByTestId("file-code-icon")).toBeTruthy();
  });

  it("should display query from query prop", () => {
    render(<DyadCodeSearch query="search auth logic" />);
    expect(screen.queryByText("search auth logic")).toBeTruthy();
  });

  it("should fallback to children when query prop is not provided", () => {
    render(<DyadCodeSearch>search from children</DyadCodeSearch>);
    expect(screen.queryByText("search from children")).toBeTruthy();
  });

  it("should not crash when both query and children are missing", () => {
    render(<DyadCodeSearch />);
    expect(document.body).toBeTruthy();
  });
});
