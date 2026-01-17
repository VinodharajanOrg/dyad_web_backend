import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

//next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/chat/123",
}));

//lucide-react
vi.mock("lucide-react", () => ({
  Eye: () => <span />,
  Code: () => <span />,
  MoreVertical: () => <span />,
  Cog: () => <span />,
  Trash2: () => <span />,
  AlertTriangle: () => <span />,
  Wrench: () => <span />,
  Globe: () => <span />,
  Shield: () => <span />,
}));

//framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children }: any) => <div>{children}</div>,
  },
}));

// UI components
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div onClick={onClick}>{children}</div>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

// chat activity
vi.mock("@/components/chat/ChatActivity", () => ({
  ChatActivityButton: () => <div data-testid="chat-activity" />,
}));

// docker utils
const setupDockerUrlFromStatus = vi.fn();
const extractValidPort = vi.fn();

vi.mock("@/lib/docker-utils", () => ({
  setupDockerUrlFromStatus: (...args: any[]) =>
    setupDockerUrlFromStatus(...args),
  extractValidPort: (...args: any[]) => extractValidPort(...args),
}));

// toast
vi.mock("@/lib/toast", () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

// hooks
vi.mock("@/hooks/useRunApp", () => ({
  useRunApp: () => ({
    restartApp: vi.fn(),
    refreshAppIframe: vi.fn(),
  }),
}));

vi.mock("@/hooks/useDockerStatus", () => ({
  useDockerStatus: () => ({
    dockerStatus: { port: "3005" },
    isPublishEnabled: true,
  }),
}));

vi.mock("@/hooks/useCheckProblems", () => ({
  useCheckProblems: () => ({
    problemReport: { problems: Array.from({ length: 5 }) },
  }),
}));

// IpcClient
vi.mock("@/api/ipc_client", () => ({
  IpcClient: {
    getInstance: () => ({
      clearSessionData: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// react-query
vi.mock("@tanstack/react-query", () => ({
  useMutation: ({ onSuccess }: any) => ({
    mutate: async () => {
      await onSuccess();
    },
  }),
}));

//  jotai (with state tracking and spies)
let previewModeState = "preview";
let isPreviewOpenState = false;

// Global spy reference object that will be updated in beforeEach
const spyRefs = {
  setPreviewMode: vi.fn(),
  setIsPreviewOpen: vi.fn(),
};

vi.mock("jotai", async () => {
  const React = await import("react");

  return {
    atom: (v: any) => ({ __atom: v }),

    useAtom: (atom: any) => {
      // Check if this is our mock preview mode atom
      if (atom.__atom === "preview") {
        const setter = (newMode: any) => {
          previewModeState = newMode;
          spyRefs.setPreviewMode(newMode); // Call spy
        };
        return [previewModeState, setter];
      }
      // Check if this is our mock isPreviewOpen atom
      if (atom.__atom === "isPreviewOpen") {
        const setter = (newValue: any) => {
          const resolved =
            typeof newValue === "function"
              ? newValue(isPreviewOpenState)
              : newValue;
          isPreviewOpenState = resolved;
          spyRefs.setIsPreviewOpen(resolved); // Call spy
        };
        return [isPreviewOpenState, setter];
      }
      return React.useState(null);
    },

    useAtomValue: () => 1,
    useSetAtom: () => vi.fn(),
  };
});

beforeEach(() => {
  previewModeState = "preview";
  isPreviewOpenState = false;
  spyRefs.setPreviewMode = vi.fn();
  spyRefs.setIsPreviewOpen = vi.fn();
  vi.clearAllMocks();
});

// atoms
vi.mock("../../atoms/appAtoms", () => ({
  previewModeAtom: { __atom: "previewMode" },
  selectedAppIdAtom: "selectedAppIdAtom",
  appUrlAtom: "appUrlAtom",
}));

vi.mock("@/atoms/viewAtoms", () => ({
  isPreviewOpenAtom: { __atom: "isPreviewOpen" },
}));

// Import Component
import { ActionHeader } from "../ActionHeader";

// TESTS
describe("ActionHeader", () => {
  it("renders buttons on chat route", () => {
    render(<ActionHeader />);

    expect(screen.getByTestId("preview-mode-button")).toBeTruthy();
    expect(screen.getByTestId("code-mode-button")).toBeTruthy();
    expect(screen.getByTestId("publish-mode-button")).toBeTruthy();
  });

  it("toggles preview when clicking same mode", () => {
    render(<ActionHeader />);

    fireEvent.click(screen.getByTestId("preview-mode-button"));

    expect(spyRefs.setIsPreviewOpen).toHaveBeenCalledWith(true);
  });

  it("switches mode when clicking different panel", () => {
    render(<ActionHeader />);

    fireEvent.click(screen.getByTestId("code-mode-button"));

    expect(spyRefs.setPreviewMode).toHaveBeenCalledWith("code");
    expect(spyRefs.setIsPreviewOpen).toHaveBeenCalledWith(true);
  });

  it("renders problems button with badge", () => {
    render(<ActionHeader />);

    expect(screen.getByTestId("problems-mode-button")).toBeTruthy();
  });

  it("sets docker preview URL when status is ready", async () => {
    extractValidPort.mockReturnValue(3005);

    await act(async () => {
      render(<ActionHeader />);
    });

    expect(setupDockerUrlFromStatus).toHaveBeenCalled();
  });

  it("opens window on publish click", () => {
    const spy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<ActionHeader />);
    fireEvent.click(screen.getByTestId("publish-mode-button"));

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("renders disabled chat activity area", () => {
    render(<ActionHeader />);

    expect(screen.getByTestId("chat-activity")).toBeTruthy();
    expect(
      screen.getByTestId("preview-more-options-button")
    ).toBeTruthy();
  });
});
