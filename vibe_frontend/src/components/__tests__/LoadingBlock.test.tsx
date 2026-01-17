import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";

//HOIST-SAFE MOCKS (CRITICAL)
const { openExternalUrlMock } = vi.hoisted(() => ({
  openExternalUrlMock: vi.fn(),
}));

vi.mock("@/utils/openExternalUrl", () => ({
  openExternalUrl: openExternalUrlMock,
}));

vi.mock("react-markdown", () => ({
  default: ({ components, children }: any) => {
    const Link = components?.a;
    return (
      <div>
        <Link href="https://example.com">Example Link</Link>
        <div>{children}</div>
      </div>
    );
  },
}));

// IMPORT AFTER MOCKS
import {
  VanillaMarkdownParser,
  LoadingBlock,
} from "../LoadingBlock";

// TESTS
describe("VanillaMarkdownParser", () => {
  beforeEach(() => {
    openExternalUrlMock.mockClear();
  });

  it("renders markdown content", () => {
    const { getByText } = render(
      <VanillaMarkdownParser content="Hello **world**" />,
    );

    expect(getByText("Hello **world**")).toBeTruthy();
  });

  it("opens external links via openExternalUrl", () => {
    const { getByText } = render(
      <VanillaMarkdownParser content="[link](https://example.com)" />,
    );

    fireEvent.click(getByText("Example Link"));

    expect(openExternalUrlMock).toHaveBeenCalledWith(
      "https://example.com",
    );
  });
});

describe("LoadingBlock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("returns null when isStreaming is false", () => {
    const { container } = render(<LoadingBlock isStreaming={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders loader when isStreaming is true", () => {
    const { container } = render(<LoadingBlock isStreaming />);
    expect(container.firstChild).toBeTruthy();
  });

  it("advances typing animation safely", () => {
    const { container } = render(<LoadingBlock isStreaming />);

    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(5000);

    expect(container.firstChild).toBeTruthy();
  });
});
