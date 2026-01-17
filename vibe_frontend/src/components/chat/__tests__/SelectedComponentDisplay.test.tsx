import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SelectedComponentDisplay } from "../SelectedComponentDisplay";

//JOTAI MOCK
const mockSetAtom = vi.fn();

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtom: () => [
      {
        name: "TestComponent",
        relativePath: "src/components/TestComponent.tsx",
        lineNumber: 42,
      },
      mockSetAtom,
    ],
  };
});

describe("SelectedComponentDisplay Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render when a component is selected", () => {
    render(<SelectedComponentDisplay />);

    expect(
      screen.getByTestId("selected-component-display")
    ).toBeTruthy();
  });

  it("should display component name", () => {
    render(<SelectedComponentDisplay />);

    expect(screen.getByText("TestComponent")).toBeTruthy();
  });

  it("should display component path and line number", () => {
    render(<SelectedComponentDisplay />);

    expect(
      screen.getByText("src/components/TestComponent.tsx:42")
    ).toBeTruthy();
  });

  it("should render deselect button", () => {
    render(<SelectedComponentDisplay />);

    expect(
      screen.getByTitle("Deselect component")
    ).toBeTruthy();
  });

  it("should clear selected component when deselect button is clicked", () => {
    render(<SelectedComponentDisplay />);

    fireEvent.click(screen.getByTitle("Deselect component"));

    expect(mockSetAtom).toHaveBeenCalledWith(null);
  });
});
