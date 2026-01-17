import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DyadTokenSavings } from "../DyadTokenSavings";

describe("DyadTokenSavings Component", () => {
  it("should render without crashing", () => {
    render(
      <DyadTokenSavings originalTokens={1000} smartContextTokens={400} />
    );
    expect(document.body).toBeTruthy();
  });

  it("should display savings summary text", () => {
    render(
      <DyadTokenSavings originalTokens={1000} smartContextTokens={400} />
    );

    expect(screen.getByText(/saved/i)).toBeTruthy();
    expect(screen.getByText(/smart context/i)).toBeTruthy();
  });

  it("should calculate and display correct percentage", () => {
    render(
      <DyadTokenSavings originalTokens={1000} smartContextTokens={400} />
    );

    // 600 / 1000 = 60%
    expect(screen.getByText(/60%/i)).toBeTruthy();
  });

  it("should render a tooltip trigger element", () => {
    render(
      <DyadTokenSavings originalTokens={1000} smartContextTokens={400} />
    );

    // Radix exposes this attribute on the trigger
    const trigger = document.querySelector("[data-slot='tooltip-trigger']");
    expect(trigger).toBeTruthy();
  });

  it("should handle zero smart-context tokens gracefully", () => {
    render(
      <DyadTokenSavings originalTokens={1000} smartContextTokens={0} />
    );

    expect(screen.getByText(/100%/i)).toBeTruthy();
  });
});
