import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatError } from "../ChatError";

describe("ChatError Component", () => {
  it("should render null when error is null", () => {
    const { container } = render(
      <ChatError error={null} onDismiss={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should display error message when provided", () => {
    const errorMessage = "Test error message";

    render(<ChatError error={errorMessage} onDismiss={() => {}} />);

    expect(screen.getByText(errorMessage)).toBeTruthy();
  });

  it("should call onDismiss when dismiss button is clicked", () => {
    const mockDismiss = vi.fn();
    const errorMessage = "Some error";

    render(<ChatError error={errorMessage} onDismiss={mockDismiss} />);

    const btn = screen.getByLabelText("Dismiss error");
    fireEvent.click(btn);

    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it("should render error container style elements", () => {
    const { container } = render(<ChatError error="Error occurred" onDismiss={() => {}} />);

    // icon present (SVG with lucide-triangle-alert class)
    const icon = container.querySelector(".lucide-triangle-alert");
    expect(icon).toBeTruthy();

    // error text present
    expect(screen.getByText("Error occurred")).toBeTruthy();
  });
});
