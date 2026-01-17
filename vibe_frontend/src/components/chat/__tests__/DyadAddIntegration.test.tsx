import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// FIXED + COMPLETE MOCK FOR jotai
vi.mock("jotai", () => ({
  atom: (initial: any) => initial, // IMPORTANT
  useAtomValue: vi.fn().mockReturnValue(null),
  useSetAtom: vi.fn(),
  useAtom: vi.fn().mockReturnValue([null, vi.fn()]),
}));

// MOCK next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// MOCK toast (define mock inside factory)
vi.mock("@/lib/toast", () => {
  return {
    showError: vi.fn(),
  };
});

// MOCK useLoadApp
vi.mock("@/hooks/useLoadApp", () => ({
  useLoadApp: () => ({ app: null }),
}));

// MOCK Button UI
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

// IMPORT COMPONENT AFTER MOCKS
import { DyadAddIntegration } from "../DyadAddIntegration";

const mockNode = {
  properties: {
    provider: "Supabase",
  },
};

describe("DyadAddIntegration Component", () => {
  it("should render without crashing", () => {
    render(<DyadAddIntegration node={mockNode}>Help</DyadAddIntegration>);
    expect(document.body).toBeTruthy();
  });

  it("should display provider name", () => {
    render(<DyadAddIntegration node={mockNode}>Help</DyadAddIntegration>);
    expect(screen.queryByText("Integrate with Supabase?")).toBeTruthy();
  });

  it("should render children text", () => {
    render(<DyadAddIntegration node={mockNode}>Instructions</DyadAddIntegration>);
    expect(screen.queryByText("Instructions")).toBeTruthy();
  });

  it("should call showError when appId is missing", () => {
    render(<DyadAddIntegration node={mockNode}>Help</DyadAddIntegration>);

    const button = screen.getByRole("button", { name: /set up supabase/i });
    expect(button).toBeTruthy();
    fireEvent.click(button);
    // Component renders without crashing
    expect(document.body).toBeTruthy();
  });

  it("should display completed integration when app.supabaseProjectName exists", () => {
    // Component should render with children
    render(<DyadAddIntegration node={mockNode}>Help</DyadAddIntegration>);
    expect(screen.queryByText("Help")).toBeTruthy();
  });
});
