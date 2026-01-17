import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

//JOTAI — hoist-safe mock
let atomValues: Record<string, any> = {};

vi.mock("jotai", () => ({
  useAtomValue: (atom: any) => atomValues[atom],
  useAtom: (atom: any) => [atomValues[atom], vi.fn()],
}));

// ATOMS
vi.mock("@/atoms/appAtoms", () => ({
  selectedAppIdAtom: "__selectedAppIdAtom__",
}));

vi.mock("@/atoms/chatAtoms", () => ({
  selectedChatIdAtom: "__selectedChatIdAtom__",
}));

// useCheckProblems
const mockCheckProblems = vi.fn();

vi.mock("@/hooks/useCheckProblems", () => ({
  useCheckProblems: () => ({
    problemReport: atomValues.__problemReport__,
    checkProblems: mockCheckProblems,
    isChecking: false,
  }),
}));

// useStreamChat
const mockStreamMessage = vi.fn();

vi.mock("@/hooks/useStreamChat", () => ({
  useStreamChat: () => ({
    streamMessage: mockStreamMessage,
    isStreaming: false,
  }),
}));

// toast
vi.mock("@/lib/toast", () => ({
  showError: vi.fn(),
}));

// UI COMPONENTS
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={onCheckedChange}
    />
  ),
}));

import { Problems } from "../Problems";

// TEST DATA
const problem = {
  file: "index.ts",
  line: 10,
  column: 5,
  code: "TS100",
  message: "Something is wrong",
};

// TESTS
describe("Problems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    atomValues = {
      "__selectedAppIdAtom__": 1,
      "__selectedChatIdAtom__": "chat-1",
      "__problemReport__": {
        problems: [problem],
      },
    };
  });

  it("renders problems pane", () => {
    render(<Problems />);
    expect(screen.getByTestId("problems-pane")).toBeTruthy();
  });

  it("renders problem rows", () => {
    render(<Problems />);
    expect(screen.getAllByTestId("problem-row").length).toBe(1);
  });

  it("selects and deselects problem row", () => {
    render(<Problems />);

    const row = screen.getByTestId("problem-row");

    // initially selected via useEffect
    expect(row.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(row);
    expect(row.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(row);
    expect(row.getAttribute("aria-checked")).toBe("true");
  });

  it("fix button sends AI prompt", () => {
    render(<Problems />);

    fireEvent.click(screen.getByTestId("fix-all-button"));

    expect(mockStreamMessage).toHaveBeenCalled();
  });

  it("renders no-app-selected state", () => {
    atomValues.__selectedAppIdAtom__ = null;

    render(<Problems />);

    expect(screen.getByText("No App Selected")).toBeTruthy();
  });

  it("renders no problems report state", () => {
    atomValues.__problemReport__ = null;

    render(<Problems />);

    expect(screen.getByText("No Problems Report")).toBeTruthy();
  });

  it("recheck button triggers checkProblems", async () => {
    mockCheckProblems.mockResolvedValueOnce({});

    render(<Problems />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("recheck-button"));
    });

    expect(mockCheckProblems).toHaveBeenCalled();
  });
});
