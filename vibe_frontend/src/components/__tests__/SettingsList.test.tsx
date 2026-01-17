import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsList } from "../SettingsList";

// JOTAI — FULL hoist-safe mock
let atomValue = "general-settings";
const setAtomMock = vi.fn();

vi.mock("jotai", () => ({
  atom: (initial: any) => ({ __atom: true, initial }),
  useAtom: () => [atomValue, setAtomMock],
  useAtomValue: () => atomValue,
  useSetAtom: () => setAtomMock,
}));

// Scroll navigation hook
const scrollAndNavigateMock = vi.fn();

vi.mock("@/hooks/useScrollAndNavigateTo", () => ({
  useScrollAndNavigateTo: () => scrollAndNavigateMock,
}));

// ScrollArea 
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));

// cn utility
vi.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

// intersectionObserver — MUST be a constructor
let observeMock: any;
let disconnectMock: any;
let intersectionCallback: any;

beforeEach(() => {
  observeMock = vi.fn();
  disconnectMock = vi.fn();
  setAtomMock.mockReset();
  scrollAndNavigateMock.mockReset();

  class MockIntersectionObserver {
    constructor(cb: any) {
      intersectionCallback = cb;
    }
    observe = observeMock;
    disconnect = disconnectMock;
  }

  (global as any).IntersectionObserver = MockIntersectionObserver;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// TESTS
describe("SettingsList", () => {
  it("returns null when show is false", () => {
    const { container } = render(<SettingsList show={false} />);
    expect(container.firstChild).toBeFalsy();
  });

  it("renders settings sections when show is true", () => {
    render(<SettingsList show={true} />);

    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("General")).toBeTruthy();
    expect(screen.getByText("AI")).toBeTruthy();
    expect(screen.getByText("Model Providers")).toBeTruthy();
  });

  it("calls scrollAndNavigateTo when clicking section", () => {
    render(<SettingsList show={true} />);

    fireEvent.click(screen.getByText("AI"));

    expect(scrollAndNavigateMock).toHaveBeenCalledWith("ai-settings");
  });

  it("applies active styles for active section", () => {
    atomValue = "ai-settings";

    render(<SettingsList show={true} />);

    const btn = screen.getByText("AI");
    expect(btn.className.includes("font-semibold")).toBeTruthy();
  });

  it("registers IntersectionObserver for sections", () => {
    ["general-settings", "workflow-settings", "ai-settings"].forEach((id) => {
      const el = document.createElement("div");
      el.id = id;
      document.body.appendChild(el);
    });

    render(<SettingsList show={true} />);

    expect(observeMock).toHaveBeenCalled();
  });

  it("updates active section when intersection occurs", () => {
    render(<SettingsList show={true} />);

    intersectionCallback([
      { isIntersecting: true, target: { id: "provider-settings" } },
    ]);

    expect(setAtomMock).toHaveBeenCalledWith("provider-settings");
  });

  it("disconnects observer on unmount", () => {
    const { unmount } = render(<SettingsList show={true} />);

    unmount();

    expect(disconnectMock).toHaveBeenCalled();
  });
});
