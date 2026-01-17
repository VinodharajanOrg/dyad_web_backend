import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// PREVENT iframe network fetch
HTMLIFrameElement.prototype.setAttribute = vi.fn();
Object.defineProperty(HTMLIFrameElement.prototype, "src", {
  set: vi.fn(),
});

//  browser globals
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })),
});

// lucide-react
vi.mock("lucide-react", () => ({
  ArrowLeft: () => <span />,
  ArrowRight: () => <span />,
  RefreshCw: () => <span />,
  ExternalLink: () => <span />,
  Loader2: () => <span />,
  X: () => <span />,
  Sparkles: () => <span />,
  ChevronDown: () => <span />,
  Lightbulb: () => <span />,
  ChevronRight: () => <span />,
  MousePointerClick: () => <span />,
  Power: () => <span />,
  MonitorSmartphone: () => <span />,
  Monitor: () => <span />,
  Tablet: () => <span />,
  Smartphone: () => <span />,
}));

// openExternalUrl
const openExternalUrlSpy = vi.fn();

vi.mock("@/utils/openExternalUrl", () => ({
  openExternalUrl: (...args: any[]) => openExternalUrlSpy(...args),
}));

// jotai (state + spies)
let appUrlState: any = { appUrl: null, originalUrl: null };
let previewErrorState: any = undefined;

const setPreviewErrorSpy = vi.fn();
const setAppOutputSpy = vi.fn();

vi.mock("jotai", async () => {
  const React = await import("react");
  return {
    atom: (v: any) => ({ __atom: v }),
    useAtomValue: (atom: any) => {
      if (atom.__atom === "selectedAppId") return 1;
      if (atom.__atom === "appUrl") return appUrlState;
      if (atom.__atom === "selectedChatId") return "chat-1";
      return null;
    },
    useSetAtom: (atom: any) => {
      if (atom.__atom === "appOutput") return setAppOutputSpy;
      return vi.fn();
    },
    useAtom: (atom: any) => {
      if (atom.__atom === "previewError") {
        return [previewErrorState, setPreviewErrorSpy];
      }
      return React.useState(null);
    },
  };
});

// atoms
vi.mock("@/atoms/appAtoms", () => ({
  selectedAppIdAtom: { __atom: "selectedAppId" },
  appUrlAtom: { __atom: "appUrl" },
  appOutputAtom: { __atom: "appOutput" },
  previewErrorMessageAtom: { __atom: "previewError" },
}));

vi.mock("@/atoms/chatAtoms", () => ({
  selectedChatIdAtom: { __atom: "selectedChatId" },
}));

vi.mock("@/atoms/previewAtoms", () => ({
  selectedComponentPreviewAtom: { __atom: "selectedComponentPreview" },
}));

// hooks
vi.mock("@/hooks/useParseRouter", () => ({
  useParseRouter: () => ({
    routes: [{ label: "Home", path: "/" }],
  }),
}));

vi.mock("@/hooks/useStreamChat", () => ({
  useStreamChat: () => ({
    isStreaming: false,
    streamMessage: vi.fn(),
  }),
}));

vi.mock("@/hooks/useDockerStatus", () => ({
  useDockerStatus: () => ({
    isPublishEnabled: true,
  }),
}));

vi.mock("@/hooks/useRunApp", () => ({
  useRunApp: () => ({
    restartApp: vi.fn(),
  }),
}));

vi.mock("@/hooks/useShortcut", () => ({
  useShortcut: () => {},
}));

// UI components
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/toggle-group", () => ({
  ToggleGroup: ({ children }: any) => <div>{children}</div>,
  ToggleGroupItem: ({ children }: any) => <div>{children}</div>,
}));

// Import Component
import { PreviewIframe } from "../PreviewIframe";

// TESTS
describe("PreviewIframe", () => {
  beforeEach(() => {
    appUrlState = { appUrl: null, originalUrl: null };
    previewErrorState = undefined;
    vi.clearAllMocks();
  });

  it("renders loading overlay", () => {
    render(<PreviewIframe loading={true} />);
    expect(screen.getByText("Preparing app preview...")).toBeTruthy();
  });

  it("renders message when app URL is missing", () => {
    render(<PreviewIframe loading={false} />);
    expect(screen.getByText("Starting your app server...")).toBeTruthy();
  });

  it("renders iframe when app URL exists", () => {
    appUrlState = {
      appUrl: "http://localhost:3000",
      originalUrl: "http://localhost:3000",
    };

    render(<PreviewIframe loading={false} />);
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeTruthy();
  });

  it("opens external browser when button clicked", () => {
    appUrlState = {
      appUrl: "http://localhost:3000",
      originalUrl: "http://localhost:3000",
    };

    render(<PreviewIframe loading={false} />);
    fireEvent.click(screen.getByTestId("preview-open-browser-button"));

    expect(openExternalUrlSpy).toHaveBeenCalled();
  });

  it("renders error banner when preview error exists", () => {
    previewErrorState = {
      message: "Preview failed",
      source: "preview-app",
    };

    render(<PreviewIframe loading={false} />);
    expect(screen.getByTestId("preview-error-banner")).toBeTruthy();
  });
});
