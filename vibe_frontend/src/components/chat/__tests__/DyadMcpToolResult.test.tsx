import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

//MOCK CodeHighlight
vi.mock("../CodeHighlight", () => ({
  CodeHighlight: ({ children }: any) => (
    <pre data-testid="code-highlight">{children}</pre>
  ),
}));

// MOCK lucide-react icons
vi.mock("lucide-react", () => ({
  CheckCircle: () => <div />,
  ChevronsUpDown: () => <div />,
  ChevronsDownUp: () => <div />,
}));

// IMPORT AFTER MOCKS
import { DyadMcpToolResult } from "../DyadMcpToolResult";

// TESTS
describe("DyadMcpToolResult Component", () => {
  const mockNode = {
    properties: {
      serverName: "test-server",
      toolName: "test-tool",
    },
  };

  const mockResultJson = JSON.stringify(
    {
      success: true,
      message: "Tool execution result",
    },
    null,
    2
  );

  it("should render without crashing", () => {
    render(
      <DyadMcpToolResult node={mockNode}>
        {mockResultJson}
      </DyadMcpToolResult>
    );

    expect(document.body).toBeTruthy();
  });

  it("should display Tool Result label", () => {
    render(
      <DyadMcpToolResult node={mockNode}>
        {mockResultJson}
      </DyadMcpToolResult>
    );

    expect(document.body.textContent).toContain("Tool Result");
  });

  it("should display server and tool name badges", () => {
    render(
      <DyadMcpToolResult node={mockNode}>
        {mockResultJson}
      </DyadMcpToolResult>
    );

    expect(document.body.textContent).toContain("test-server");
    expect(document.body.textContent).toContain("test-tool");
  });

  it("should NOT render JSON content when collapsed", () => {
    render(
      <DyadMcpToolResult node={mockNode}>
        {mockResultJson}
      </DyadMcpToolResult>
    );

    const code = screen.queryByTestId("code-highlight");
    expect(code).toBeFalsy();
  });

  it("should expand and render formatted JSON when clicked", () => {
    const { container } = render(
      <DyadMcpToolResult node={mockNode}>
        {mockResultJson}
      </DyadMcpToolResult>
    );

    fireEvent.click(container.firstChild as HTMLElement);

    const code = screen.queryByTestId("code-highlight");
    expect(code).toBeTruthy();
    expect(code?.textContent).toContain("Tool execution result");
  });
});
