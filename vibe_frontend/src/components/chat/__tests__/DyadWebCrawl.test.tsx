import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DyadWebCrawl } from "../DyadWebCrawl";

describe("DyadWebCrawl Component", () => {
  it("should render without crashing", () => {
    render(<DyadWebCrawl />);
    expect(document.body).toBeTruthy();
  });

  it("should render Web Crawl label", () => {
    render(<DyadWebCrawl />);
    expect(screen.getByText("Web Crawl")).toBeTruthy();
  });

  it("should render children content when provided", () => {
    render(<DyadWebCrawl>Crawling example.com</DyadWebCrawl>);
    expect(screen.getByText("Crawling example.com")).toBeTruthy();
  });

  it("should render icon", () => {
    const { container } = render(<DyadWebCrawl />);
    // lucide icons render as svg
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("should not crash when children is empty", () => {
    render(<DyadWebCrawl>{""}</DyadWebCrawl>);
    expect(document.body).toBeTruthy();
  });
});
