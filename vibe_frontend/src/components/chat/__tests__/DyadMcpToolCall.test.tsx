import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// MOCK CodeHighlight BEFORE import
vi.mock("../CodeHighlight", () => ({
  CodeHighlight: ({ children }: any) => (
    <pre data-testid="code-highlight">{children}</pre>
  ),
}));

// MOCK lucide-react icons
vi.mock("lucide-react", () => ({
  Wrench: () => <div />,
  ChevronsUpDown: () => <div />,
  ChevronsDownUp: () => <div />,
}));

// IMPORT AFTER MOCKS
import { DyadMcpToolCall } from "../DyadMcpToolCall";

// TESTS
describe("DyadMcpToolCall Component", () => {
  const mockNode = {
    properties: {
      serverName: "test-server",
      toolName: "test-tool",
    },
  };

  const mockJson = JSON.stringify({ param: "value" });

  it("should render without crashing", () => {
    render(
      <DyadMcpToolCall node={mockNode}>{mockJson}</DyadMcpToolCall>
    );
    expect(document.body).toBeTruthy();
  });

  it("should display server name and tool name", () => {
    render(
      <DyadMcpToolCall node={mockNode}>{mockJson}</DyadMcpToolCall>
    );
    expect(screen.queryByText("test-server")).toBeTruthy();
    expect(screen.queryByText("test-tool")).toBeTruthy();
  });

  it("should NOT render JSON content when collapsed", () => {
    render(
      <DyadMcpToolCall node={mockNode}>{mockJson}</DyadMcpToolCall>
    );
    expect(screen.queryByTestId("code-highlight")).toBeFalsy();
  });

  it("should expand and render JSON content when clicked", () => {
    const { container } = render(
      <DyadMcpToolCall node={mockNode}>{mockJson}</DyadMcpToolCall>
    );

    fireEvent.click(container.firstChild as HTMLElement);

    const code = screen.queryByTestId("code-highlight");
    expect(code).toBeTruthy();
  });

  it("should not crash when node is missing", () => {
    render(<DyadMcpToolCall>{mockJson}</DyadMcpToolCall>);
    expect(document.body).toBeTruthy();
  });
});
