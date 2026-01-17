import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// jotai (atom value mocking)
let appOutputState: any[] = [];
let selectedAppIdState: number | null = null;

vi.mock("jotai", () => ({
  atom: (v: any) => ({ __atom: v }),
  useAtomValue: (atom: any) => {
    if (atom.__atom === "appOutput") return appOutputState;
    if (atom.__atom === "selectedAppId") return selectedAppIdState;
    return null;
  },
  useAtom: () => [null, vi.fn()],
  useSetAtom: () => vi.fn(),
}));

// atoms
vi.mock("@/atoms/appAtoms", () => ({
  appOutputAtom: { __atom: "appOutput" },
  selectedAppIdAtom: { __atom: "selectedAppId" },
}));

// Import Component
import { Console } from "../Console";

// TESTS
describe("Console", () => {
  beforeEach(() => {
    appOutputState = [];
    selectedAppIdState = null;
    vi.clearAllMocks();
  });

  it("renders nothing when there is no output", () => {
    render(<Console />);

    expect(screen.queryByText(/.+/)).toBeFalsy();
  });

  it("renders only messages for the selected app", () => {
    selectedAppIdState = 2;
    appOutputState = [
      { appId: 1, message: "app1-log-1" },
      { appId: 2, message: "app2-log-1" },
      { appId: 2, message: "app2-log-2" },
      { appId: 3, message: "app3-log-1" },
    ];

    render(<Console />);

    expect(screen.getByText("app2-log-1")).toBeTruthy();
    expect(screen.getByText("app2-log-2")).toBeTruthy();
    expect(screen.queryByText("app1-log-1")).toBeFalsy();
    expect(screen.queryByText("app3-log-1")).toBeFalsy();
  });

  it("renders nothing when no output matches selected app", () => {
    selectedAppIdState = 5;
    appOutputState = [
      { appId: 1, message: "log-1" },
      { appId: 2, message: "log-2" },
    ];

    render(<Console />);

    expect(screen.queryByText("log-1")).toBeFalsy();
    expect(screen.queryByText("log-2")).toBeFalsy();
  });

  it("renders multiple messages in correct order for selected app", () => {
    selectedAppIdState = 10;
    appOutputState = [
      { appId: 10, message: "first" },
      { appId: 10, message: "second" },
      { appId: 10, message: "third" },
    ];

    render(<Console />);

    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.getByText("second")).toBeTruthy();
    expect(screen.getByText("third")).toBeTruthy();
  });
});
