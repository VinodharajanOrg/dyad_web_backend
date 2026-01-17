import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatErrorBox } from "../ChatErrorBox";

// Mocks
const mockOpenExternalUrl = vi.fn();

vi.mock("@/api/ipc_client", () => ({
  IpcClient: {
    getInstance: vi.fn(() => ({
      openExternalUrl: mockOpenExternalUrl,
    })),
  },
}));

vi.mock("lucide-react", () => ({
  X: () => <div data-testid="icon-x" />,
  ExternalLink: () => <div data-testid="icon-external" />,
  CircleArrowUp: () => <div data-testid="icon-up" />,
}));

vi.mock("remark-gfm", () => ({
  default: vi.fn(),
}));


vi.mock("react-markdown", () => ({
  default: ({ children, components }: any) => (
    <div data-testid="markdown">
      {components?.a({
        href: "https://example.com",
        children: "link",
      })}
      <span>{children}</span>
    </div>
  ),
}));

// TESTS

describe("ChatErrorBox – MAXIMUM COVERAGE", () => {
  const onDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders free quota tier error (highest priority)", () => {
    const error = "Model doesn't have a free quota tier";

    render(
      <ChatErrorBox
        error={error}
        onDismiss={onDismiss}
        isDyadProEnabled={false}
      />
    );

    expect(screen.getByText(error)).toBeTruthy();
  });

  it("renders rate limit error variants", () => {
    const errors = [
      "Resource has been exhausted",
      "Provider returned error",
      "https://ai.google.dev/gemini-api/docs/rate-limits",
    ];

    errors.forEach((error) => {
      render(
        <ChatErrorBox
          error={error}
          onDismiss={onDismiss}
          isDyadProEnabled={false}
        />
      );

      expect(screen.getByText(error)).toBeTruthy();
    });
  });

  it("returns null for LiteLLM Virtual Key error", () => {
    const { container } = render(
      <ChatErrorBox
        error="LiteLLM Virtual Key expected"
        onDismiss={onDismiss}
        isDyadProEnabled={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("returns null for ExceededBudget when Pro is enabled", () => {
    const { container } = render(
      <ChatErrorBox
        error="ExceededBudget: limit reached"
        onDismiss={onDismiss}
        isDyadProEnabled={true}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders ExceededBudget when Pro is NOT enabled", () => {
    render(
      <ChatErrorBox
        error="ExceededBudget: limit reached"
        onDismiss={onDismiss}
        isDyadProEnabled={false}
      />
    );

    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("strips Fallbacks= section from error message", () => {
    render(
      <ChatErrorBox
        error="Main error Fallbacks=some models"
        onDismiss={onDismiss}
        isDyadProEnabled={false}
      />
    );

    expect(screen.getByText(/Main error/)).toBeTruthy();
  });

  it("renders markdown error and opens external link on click", () => {
    render(
      <ChatErrorBox
        error="Error with [link](https://example.com)"
        onDismiss={onDismiss}
        isDyadProEnabled={false}
      />
    );

    const link = screen.getByText("link");
    fireEvent.click(link);

    expect(mockOpenExternalUrl).toHaveBeenCalledWith(
      "https://example.com"
    );
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    render(
      <ChatErrorBox
        error="Some error"
        onDismiss={onDismiss}
        isDyadProEnabled={false}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("renders safely with empty error string", () => {
    render(
      <ChatErrorBox
        error=""
        onDismiss={onDismiss}
        isDyadProEnabled={false}
      />
    );

    expect(screen.getByRole("button")).toBeTruthy();
  });
});
