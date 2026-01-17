import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// jotai
vi.mock("jotai", () => ({
  atom: (v: any) => v,
  useAtomValue: () => new Map([[1, false]]),
}));

// react-markdown
vi.mock("react-markdown", () => ({
  default: ({ children }: any) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

// code highlight
vi.mock("../CodeHighlight", () => ({
  CodeHighlight: ({ children }: any) => (
    <pre data-testid="code-highlight">{children}</pre>
  ),
}));

// Dyad components — INLINE mocks (hoist-safe)
vi.mock("../DyadWrite", () => ({
  DyadWrite: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadRename", () => ({
  DyadRename: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadDelete", () => ({
  DyadDelete: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadAddDependency", () => ({
  DyadAddDependency: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadExecuteSql", () => ({
  DyadExecuteSql: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadAddIntegration", () => ({
  DyadAddIntegration: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadEdit", () => ({
  DyadEdit: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadSearchReplace", () => ({
  DyadSearchReplace: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadCodebaseContext", () => ({
  DyadCodebaseContext: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadThink", () => ({
  DyadThink: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadOutput", () => ({
  DyadOutput: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadProblemSummary", () => ({
  DyadProblemSummary: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadMcpToolCall", () => ({
  DyadMcpToolCall: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadMcpToolResult", () => ({
  DyadMcpToolResult: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadWebSearchResult", () => ({
  DyadWebSearchResult: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadWebSearch", () => ({
  DyadWebSearch: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadWebCrawl", () => ({
  DyadWebCrawl: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadCodeSearchResult", () => ({
  DyadCodeSearchResult: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadCodeSearch", () => ({
  DyadCodeSearch: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../DyadRead", () => ({
  DyadRead: ({ children }: any) => <div>{children}</div>,
}));

// openExternalUrl
vi.mock("@/utils/openExternalUrl", () => ({
  openExternalUrl: vi.fn(),
}));

// IMPORT AFTER MOCKS
import {
  DyadMarkdownParser,
  VanillaMarkdownParser,
} from "../DyadMarkdownParser";

// TESTS
describe("DyadMarkdownParser – near 100% coverage", () => {
  it("renders vanilla markdown", () => {
    render(<VanillaMarkdownParser content="Hello **World**" />);
    expect(document.body.textContent).toContain("Hello");
  });

  it("renders markdown + dyad-write", () => {
    const content = `
Hello
<dyad-write path="a.ts">CODE</dyad-write>
World
    `;
    render(<DyadMarkdownParser content={content} chatId={1} />);
    expect(document.body.textContent).toContain("CODE");
  });

  it("handles unclosed dyad-write (in progress)", () => {
    const content = `<dyad-write path="x.ts">PARTIAL`;
    render(<DyadMarkdownParser content={content} chatId={1} />);
    expect(document.body.textContent).toContain("PARTIAL");
  });

  it("covers all dyad switch cases", () => {
    const content = `
<dyad-read>R</dyad-read>
<dyad-rename>RN</dyad-rename>
<dyad-delete>D</dyad-delete>
<dyad-add-dependency>DEP</dyad-add-dependency>
<dyad-execute-sql>SQL</dyad-execute-sql>
<dyad-add-integration>INT</dyad-add-integration>
<dyad-edit>ED</dyad-edit>
<dyad-search-replace>SR</dyad-search-replace>
<dyad-codebase-context>CTX</dyad-codebase-context>
<dyad-web-search>WS</dyad-web-search>
<dyad-web-crawl>WC</dyad-web-crawl>
<dyad-code-search>CS</dyad-code-search>
<dyad-code-search-result>CSR</dyad-code-search-result>
<dyad-web-search-result>WSR</dyad-web-search-result>
<think>THINK</think>
<dyad-mcp-tool-call>CALL</dyad-mcp-tool-call>
<dyad-mcp-tool-result>RESULT</dyad-mcp-tool-result>
<dyad-output>OUT</dyad-output>
<dyad-problem-report>PROB</dyad-problem-report>
    `;
    render(<DyadMarkdownParser content={content} chatId={1} />);
    expect(document.body.textContent).toContain("OUT");
  });

  it("returns null for dyad-chat-summary", () => {
    render(
      <DyadMarkdownParser
        content="<dyad-chat-summary>IGNORE</dyad-chat-summary>"
        chatId={1}
      />
    );
    expect(document.body.textContent).not.toContain("IGNORE");
  });

  it("handles unknown tags safely", () => {
    render(
      <DyadMarkdownParser content="<unknown>OK</unknown>" chatId={1} />
    );
    expect(document.body.textContent).toContain("OK");
  });
});
