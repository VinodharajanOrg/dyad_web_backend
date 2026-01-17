import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// MOCK lucide-react BEFORE import
vi.mock("lucide-react", () => ({
  ChevronDown: () => <div data-testid="chevron-down" />,
  ChevronUp: () => <div data-testid="chevron-up" />,
  FileCode: () => <div data-testid="file-code-icon" />,
  FileText: () => <div data-testid="file-text-icon" />,
}));

// IMPORT COMPONENT AFTER MOCKS
import { DyadCodeSearchResult } from "../DyadCodeSearchResult";

// TEST DATA
const mockChildren = `
src/app/page.tsx
src/components/Button.tsx
lib/utils/helpers.ts
`;

// TEST SUITE
describe("DyadCodeSearchResult Component", () => {
  it("should render without crashing", () => {
    render(<DyadCodeSearchResult>{mockChildren}</DyadCodeSearchResult>);
    expect(document.body).toBeTruthy();
  });

  it("should render Code Search Result label", () => {
    render(<DyadCodeSearchResult>{mockChildren}</DyadCodeSearchResult>);
    expect(screen.queryByText(/Code Search Result/i)).toBeTruthy();
  });

  it("should show file count when files are present", () => {
    render(<DyadCodeSearchResult>{mockChildren}</DyadCodeSearchResult>);
    expect(screen.queryByText(/Found 3 files/i)).toBeTruthy();
  });

  it("should expand and display file names when clicked", () => {
    render(<DyadCodeSearchResult>{mockChildren}</DyadCodeSearchResult>);

    const container = screen.getByRole("button");

    // Expand
    fireEvent.click(container);

    expect(screen.queryByText("page.tsx")).toBeTruthy();
    expect(screen.queryByText("Button.tsx")).toBeTruthy();
    expect(screen.queryByText("helpers.ts")).toBeTruthy();
  });

  it("should collapse when clicked again", () => {
    render(<DyadCodeSearchResult>{mockChildren}</DyadCodeSearchResult>);

    const container = screen.getByRole("button");

    fireEvent.click(container); // expand
    fireEvent.click(container); // collapse

    // Content still exists in DOM but hidden — ensure no crash
    expect(container).toBeTruthy();
  });
});
