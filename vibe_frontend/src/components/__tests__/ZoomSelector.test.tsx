import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Hoisted Mocks
const mocks = vi.hoisted(() => ({
  updateSettings: vi.fn(),
}));

let mockSettings: any = null;

// useSettings
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: mockSettings,
    updateSettings: mocks.updateSettings,
  }),
}));

// Radix Select
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div>
      <div data-testid="select-value">{value}</div>
      {React.Children.map(children, (child) =>
        React.cloneElement(child as any, { onValueChange }),
      )}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children, onValueChange }: any) => (
    <div>
      {React.Children.map(children, (child) =>
        React.cloneElement(child as any, { onValueChange }),
      )}
    </div>
  ),
  SelectItem: ({ value, children, onValueChange }: any) => (
    <button onClick={() => onValueChange(value)}>{children}</button>
  ),
}));

// Label
vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

// IMPORT AFTER MOCKS
import { ZoomSelector } from "../ZoomSelector";

// TESTS
describe("ZoomSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = null;
  });

  it("renders with default zoom level when settings are missing", () => {
    mockSettings = {};

    render(<ZoomSelector />);

    expect(screen.getByText("Zoom level")).toBeTruthy();
    expect(screen.getByTestId("select-value").textContent).toBe("100");
  });

  it("renders zoom level from settings when valid", () => {
    mockSettings = {
      zoomLevel: "125",
    };

    render(<ZoomSelector />);

    expect(screen.getByTestId("select-value").textContent).toBe("125");
    expect(screen.getByText("Large zoom for improved readability.")).toBeTruthy();
  });

  it("falls back to default zoom level when schema validation fails", () => {
    mockSettings = {
      zoomLevel: "999", // invalid
    };

    render(<ZoomSelector />);

    expect(screen.getByTestId("select-value").textContent).toBe("100");
    expect(screen.getByText("Default zoom level.")).toBeTruthy();
  });

  it("updates settings when a new zoom level is selected", async () => {
    mockSettings = {
      zoomLevel: "100",
    };

    render(<ZoomSelector />);

    fireEvent.click(screen.getByText("150%"));

    await Promise.resolve();

    expect(mocks.updateSettings).toHaveBeenCalledWith({
      zoomLevel: "150",
    });
  });

  it("renders all zoom level labels", () => {
    mockSettings = {};

    render(<ZoomSelector />);

    expect(screen.getByText("90%")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("110%")).toBeTruthy();
    expect(screen.getByText("125%")).toBeTruthy();
    expect(screen.getByText("150%")).toBeTruthy();
  });
});
