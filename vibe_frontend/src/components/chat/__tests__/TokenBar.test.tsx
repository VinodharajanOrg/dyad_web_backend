import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { TokenBar } from "../TokenBar";

//PARTIAL JOTAI MOCK
vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtom: () => ["test input"], // mock atom value only
  };
});


// settings
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: {
      enableDyadPro: false,
      enableProSmartFilesContextMode: false,
      selectedModel: { name: "gpt-4" },
    },
  }),
}));

// token counter
const countTokensMock = vi.fn(() => Promise.resolve());

vi.mock("@/hooks/useCountTokens", () => ({
  useCountTokens: () => ({
    countTokens: countTokensMock,
    result: {
      totalTokens: 500,
      messageHistoryTokens: 200,
      codebaseTokens: 100,
      mentionedAppsTokens: 50,
      systemPromptTokens: 50,
      inputTokens: 100,
      contextWindow: 1000,
    },
  }),
}));

// external URL
vi.mock("@/utils/openExternalUrl", () => ({
  openExternalUrl: vi.fn(),
}));

// TESTS
describe("TokenBar Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when chatId is missing", () => {
    const { container } = render(<TokenBar />);
    expect(container.firstChild).toBeNull();
  });

  it("should render token bar when chatId is provided", async () => {
    await act(async () => {
      render(<TokenBar chatId={1} />);
    });

    expect(screen.getByTestId("token-bar")).toBeTruthy();
  });

  it("should trigger token counting after debounce", async () => {
    vi.useFakeTimers();

    render(<TokenBar chatId={42} />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(countTokensMock).toHaveBeenCalledWith(42, "test input");

    vi.useRealTimers();
  });

  it("should display total token count", async () => {
    await act(async () => {
      render(<TokenBar chatId={1} />);
    });

    const tokenElement = screen.getByText(/Tokens:/);
    expect(tokenElement.textContent).toContain("500");
  });

  it("should show Smart Context upsell when Pro is disabled", async () => {
    await act(async () => {
      render(<TokenBar chatId={1} />);
    });

    expect(
      screen.getByText(/Dyad Pro's Smart Context/i)
    ).toBeTruthy();
  });
});
