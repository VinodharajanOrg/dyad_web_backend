import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "@testing-library/react";

//useSettings hook
let settingsState: any = null;

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: settingsState,
  }),
}));

//Child components (hard mocks)
vi.mock("../ChatModeSelector", () => ({
  ChatModeSelector: () => (
    <div data-testid="chat-mode-selector" />
  ),
}));

vi.mock("../ModelPicker", () => ({
  ModelPicker: () => (
    <div data-testid="model-picker" />
  ),
}));

vi.mock("../ContextFilesPicker", () => ({
  ContextFilesPicker: () => (
    <div data-testid="context-files-picker" />
  ),
}));

vi.mock("../ProModeSelector", () => ({
  ProModeSelector: () => (
    <div data-testid="pro-mode-selector" />
  ),
}));

vi.mock("@/components/McpToolsPicker", () => ({
  McpToolsPicker: () => (
    <div data-testid="mcp-tools-picker" />
  ),
}));

// IMPORT AFTER MOCKS
import { ChatInputControls } from "../ChatInputControls";

// TESTS
describe("ChatInputControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsState = null;
  });

  it("renders base controls when settings are undefined", () => {
    const { getByTestId, queryByTestId } = render(
      <ChatInputControls />,
    );

    expect(getByTestId("chat-mode-selector")).toBeTruthy();
    expect(getByTestId("model-picker")).toBeTruthy();

    expect(queryByTestId("mcp-tools-picker")).not.toBeTruthy();
    expect(queryByTestId("context-files-picker")).not.toBeTruthy();
  });

  it("does not render MCP tools when chat mode is not agent", () => {
    settingsState = { selectedChatMode: "chat" };

    const { queryByTestId } = render(
      <ChatInputControls />,
    );

    expect(queryByTestId("mcp-tools-picker")).not.toBeTruthy();
  });

  it("renders MCP tools when chat mode is agent", () => {
    settingsState = { selectedChatMode: "agent" };

    const { getByTestId } = render(
      <ChatInputControls />,
    );

    expect(getByTestId("mcp-tools-picker")).toBeTruthy();
  });

  it("renders ContextFilesPicker when showContextFilesPicker is true", () => {
    settingsState = { selectedChatMode: "chat" };

    const { getByTestId } = render(
      <ChatInputControls showContextFilesPicker />,
    );

    expect(getByTestId("context-files-picker")).toBeTruthy();
  });

  it("renders both MCP tools and ContextFilesPicker together when conditions match", () => {
    settingsState = { selectedChatMode: "agent" };

    const { getByTestId } = render(
      <ChatInputControls showContextFilesPicker />,
    );

    expect(getByTestId("mcp-tools-picker")).toBeTruthy();
    expect(getByTestId("context-files-picker")).toBeTruthy();
  });
});
