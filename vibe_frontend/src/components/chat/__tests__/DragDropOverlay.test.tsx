import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock Paperclip icon BEFORE import
vi.mock("lucide-react", () => ({
  Paperclip: () => <div data-testid="paperclip-icon" />,
}));

import { DragDropOverlay } from "../DragDropOverlay";

describe("DragDropOverlay Component", () => {
  it("renders without crashing", () => {
    render(<DragDropOverlay isDraggingOver={false} />);
    expect(document.body).toBeTruthy();
  });

  it("renders overlay when dragging over", () => {
    const { container } = render(
      <DragDropOverlay isDraggingOver={true} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders nothing when not dragging", () => {
    const { container } = render(
      <DragDropOverlay isDraggingOver={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("displays Paperclip icon when active", () => {
    render(<DragDropOverlay isDraggingOver={true} />);

    const icon = screen.queryByTestId("paperclip-icon");
    expect(icon).toBeTruthy();
  });

  it("displays drop message text", () => {
    render(<DragDropOverlay isDraggingOver={true} />);

    const msg = screen.queryByText("Drop files to attach");
    expect(msg).toBeTruthy();
  });
});
