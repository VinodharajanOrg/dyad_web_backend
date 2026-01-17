import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";

// MOCK jotai
vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtomValue: () => 123, // fake selectedChatId
  };
});

// MOCK useStreamChat
vi.mock("@/hooks/useStreamChat", () => {
  return {
    useStreamChat: () => ({
      streamMessage: vi.fn(),
    }),
  };
});

// IMPORT AFTER MOCKS
import { DyadOutput } from "../DyadOutput";

// TEST SUITE
describe("DyadOutput Component", () => {
  it("should render without crashing", () => {
    render(
      <DyadOutput type="warning" message="Test warning">
        Extra details
      </DyadOutput>
    );
    expect(document.body).toBeTruthy();
  });

  it("should render warning label", () => {
    render(
      <DyadOutput type="warning" message="This is a warning">
        Warning details
      </DyadOutput>
    );

    const label = screen.queryByText("Warning");
    expect(label).toBeTruthy();
  });

  it("should render error label", () => {
    render(
      <DyadOutput type="error" message="Something failed">
        Error details
      </DyadOutput>
    );

    const label = screen.queryByText("Error");
    expect(label).toBeTruthy();
  });

  it("should show Fix with AI button for error with message", () => {
    render(
      <DyadOutput type="error" message="Critical error occurred">
        Error details
      </DyadOutput>
    );

    const fixButton = screen.queryByText(/fix with ai/i);
    expect(fixButton).toBeTruthy();
  });

  it("should render children content when expanded", () => {
    render(
      <DyadOutput type="warning" message="Expandable warning">
        Expanded content here
      </DyadOutput>
    );

    // click main container (toggles expand)
    const header = screen.getByText(/expandable warning/i);
    act(() => {
      header.closest("div")?.click();
    });

    expect(screen.queryByText("Expanded content here")).toBeTruthy();
  });
});
