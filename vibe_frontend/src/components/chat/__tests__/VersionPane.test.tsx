import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VersionPane } from "../VersionPane";

// SHARED STATE
let selectedVersionId: string | null = "v1";

const mockSetSelectedVersionId = vi.fn((val) => {
  selectedVersionId = val;
});

const mockCheckoutVersion = vi.fn().mockResolvedValue(undefined);
const mockRestartApp = vi.fn().mockResolvedValue(undefined);
const mockRefreshApp = vi.fn().mockResolvedValue(undefined);

//MODULE MOCKS
vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtomValue: () => 1, // appId
    useAtom: () => [selectedVersionId, mockSetSelectedVersionId],
  };
});

vi.mock("@/hooks/useLoadApp", () => ({
  useLoadApp: () => ({
    app: { neonProjectId: "neon-1" },
    refreshApp: mockRefreshApp,
  }),
}));

vi.mock("@/hooks/useCheckoutVersion", () => ({
  useCheckoutVersion: () => ({
    checkoutVersion: mockCheckoutVersion,
    isCheckingOutVersion: false,
  }),
}));

vi.mock("@/hooks/useRunApp", () => ({
  useRunApp: () => ({
    restartApp: mockRestartApp,
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

// TESTS
describe("VersionPane (max achievable coverage)", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    selectedVersionId = "v1";
  });

  it("does not render anything when isVisible is false", () => {
    const { container } = render(
      <VersionPane isVisible={false} onClose={onClose} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders header and empty state when visible", () => {
    render(<VersionPane isVisible={true} onClose={onClose} />);

    expect(screen.getByText("Version History")).toBeTruthy();
    expect(screen.getByText("No versions available")).toBeTruthy();
  });

  it("calls onClose when close button is clicked", () => {
    render(<VersionPane isVisible={true} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("Close version pane"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("resets selected version and checks out main when pane closes", async () => {
    const { rerender } = render(
      <VersionPane isVisible={true} onClose={onClose} />
    );

    rerender(<VersionPane isVisible={false} onClose={onClose} />);

    await waitFor(() => {
      expect(mockSetSelectedVersionId).toHaveBeenCalledWith(null);
      expect(mockCheckoutVersion).toHaveBeenCalledWith({
        appId: 1,
        versionId: "main",
      });
    });
  });

  it("restarts app on close when neonProjectId exists", async () => {
    const { rerender } = render(
      <VersionPane isVisible={true} onClose={onClose} />
    );

    rerender(<VersionPane isVisible={false} onClose={onClose} />);

    await waitFor(() => {
      expect(mockRestartApp).toHaveBeenCalled();
    });
  });
});
