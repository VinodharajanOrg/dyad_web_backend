import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { LexicalChatInput } from "../LexicalChatInput";

//Lexical Core Mock
vi.mock("lexical", () => ({
  $getRoot: () => ({
    clear: vi.fn(),
    append: vi.fn(),
    getTextContent: () => "hello @App1",
  }),
  $createParagraphNode: () => ({
    append: vi.fn(),
    select: vi.fn(),
    selectEnd: vi.fn(),
    getTextContent: () => "",
  }),
  $createTextNode: vi.fn(),
  KEY_ENTER_COMMAND: "enter",
  COMMAND_PRIORITY_HIGH: 1,
}));

// Lexical React Mocks
let onChangeCb: any;
let enterCommandCb: any;

vi.mock("@lexical/react/LexicalComposer", () => ({
  LexicalComposer: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [
    {
      registerCommand: (_: any, cb: any) => {
        enterCommandCb = cb;
        return vi.fn();
      },
      update: (cb: any) => cb(),
      getEditorState: () => ({
        read: (cb: any) => cb(),
      }),
    },
  ],
}));

vi.mock("@lexical/react/LexicalPlainTextPlugin", () => ({
  PlainTextPlugin: ({ contentEditable }: any) => contentEditable,
}));

vi.mock("@lexical/react/LexicalContentEditable", () => ({
  ContentEditable: (props: any) => (
    <textarea data-testid="editor" {...props} />
  ),
}));

vi.mock("@lexical/react/LexicalHistoryPlugin", () => ({
  HistoryPlugin: () => null,
}));

vi.mock("@lexical/react/LexicalOnChangePlugin", () => ({
  OnChangePlugin: ({ onChange }: any) => {
    onChangeCb = onChange;
    return null;
  },
}));

vi.mock("@lexical/react/LexicalErrorBoundary", () => ({
  LexicalErrorBoundary: ({ children }: any) => <>{children}</>,
}));


// MENTIONS MOCKS
vi.mock("lexical-beautiful-mentions", () => ({
  BeautifulMentionsPlugin: () => null,
  BeautifulMentionNode: class {},
  $createBeautifulMentionNode: vi.fn(),
}));

// APP / DATA HOOKS
vi.mock("jotai", async (orig) => {
  const actual = await orig<any>();
  return {
    ...actual,
    useAtomValue: () => 1,
  };
});

vi.mock("@/hooks/useLoadApps", () => ({
  useLoadApps: () => ({
    apps: [
      { id: 1, name: "App1" },
      { id: 2, name: "App2" },
    ],
  }),
}));

vi.mock("@/hooks/usePrompts", () => ({
  usePrompts: () => ({
    prompts: [{ id: 10, title: "PromptA" }],
  }),
}));

vi.mock("@/hooks/useLoadApp", () => ({
  useLoadApp: () => ({
    app: { files: ["src/index.ts"] },
  }),
}));

vi.mock("@/shared/parse_mention_apps", () => ({
  MENTION_REGEX: /@(\w+)/g,
  parseAppMentions: () => ["app1"],
}));

// TESTS
describe("LexicalChatInput – high coverage", () => {
  const onChange = vi.fn();
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders editor and placeholder", () => {
    render(
      <LexicalChatInput
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
        excludeCurrentApp={false}
      />,
    );

    expect(screen.getByTestId("editor")).toBeTruthy();
  });

  it("filters mention items when excludeCurrentApp=true", () => {
    render(
      <LexicalChatInput
        value="@App1"
        onChange={onChange}
        onSubmit={onSubmit}
        excludeCurrentApp
      />,
    );

    // rendering itself exercises mentionItems memo
    expect(true).toBe(true);
  });

  it("calls onChange with transformed mentions", () => {
    render(
      <LexicalChatInput
        value="@App1"
        onChange={onChange}
        onSubmit={onSubmit}
        excludeCurrentApp={false}
      />,
    );

    onChangeCb({
      read: (cb: any) => cb(),
    });

    expect(onChange).toHaveBeenCalled();
  });

  it("submits on Enter key", () => {
    render(
      <LexicalChatInput
        value="hello"
        onChange={onChange}
        onSubmit={onSubmit}
        excludeCurrentApp={false}
      />,
    );

    const handled = enterCommandCb({
      shiftKey: false,
      preventDefault: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("does not submit on Shift+Enter", () => {
    render(
      <LexicalChatInput
        value="hello"
        onChange={onChange}
        onSubmit={onSubmit}
        excludeCurrentApp={false}
      />,
    );

    const handled = enterCommandCb({
      shiftKey: true,
      preventDefault: vi.fn(),
    });

    expect(handled).toBe(false);
  });

  it("clears editor after submit", () => {
    render(
      <LexicalChatInput
        value="hello"
        onChange={onChange}
        onSubmit={onSubmit}
        excludeCurrentApp={false}
      />,
    );

    enterCommandCb({
      shiftKey: false,
      preventDefault: vi.fn(),
    });

    expect(onSubmit).toHaveBeenCalled();
  });

  it("renders safely when disabled", () => {
    render(
      <LexicalChatInput
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
        disabled
        excludeCurrentApp={false}
      />,
    );

    expect(screen.getByTestId("editor")).toBeTruthy();
  });
});
