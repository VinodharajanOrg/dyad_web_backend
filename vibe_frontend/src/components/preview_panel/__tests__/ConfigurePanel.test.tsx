import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

//next/navigation
const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
}));

//lucide-react
vi.mock("lucide-react", () => ({
  Trash2: () => <span />,
  Edit2: () => <span />,
  Plus: () => <span />,
  Save: () => <span />,
  X: () => <span />,
  HelpCircle: () => <span />,
  ArrowRight: () => <span />,
}));

// UI components
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}));
vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

//NeonConfigure
vi.mock("../NeonConfigure", () => ({
  NeonConfigure: () => <div data-testid="neon-configure" />,
}));

// toast 
const showErrorSpy = vi.fn();
const showSuccessSpy = vi.fn();

vi.mock("@/lib/toast", () => ({
  showError: (msg: any) => showErrorSpy(msg),
  showSuccess: (msg: any) => showSuccessSpy(msg),
}));

// jotai (FULL mock: atom + useAtom + useAtomValue)
let selectedAppIdState: number | null = 1;

vi.mock("jotai", () => ({
  atom: (v: any) => ({ __atom: v }),

  useAtomValue: (atom: any) => {
    if (atom.__atom === "selectedAppId") return selectedAppIdState;
    return null;
  },

  useAtom: () => [null, vi.fn()],
  useSetAtom: () => vi.fn(),
}));

// atoms
vi.mock("@/atoms/appAtoms", () => ({
  selectedAppIdAtom: { __atom: "selectedAppId" },
}));

//react-query
let envVarsState: any[] = [];
let isLoadingState = false;
let errorState: any = null;
const mutateSpy = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
  useQuery: () => ({
    data: envVarsState,
    isLoading: isLoadingState,
    error: errorState,
  }),
  useMutation: () => ({
    mutate: (v: any) => mutateSpy(v),
    isPending: false,
  }),
}));

import { ConfigurePanel } from "../ConfigurePanel";

// TESTS
describe("ConfigurePanel", () => {
  beforeEach(() => {
    selectedAppIdState = 1;
    envVarsState = [];
    isLoadingState = false;
    errorState = null;
    vi.clearAllMocks();
  });

  it("renders loading state", () => {
    isLoadingState = true;

    render(<ConfigurePanel />);

    expect(
      screen.getByText("Loading environment variables...")
    ).toBeTruthy();
  });

  it("renders error state", () => {
    errorState = { message: "boom" };

    render(<ConfigurePanel />);

    expect(
      screen.getByText("Error loading environment variables: boom")
    ).toBeTruthy();
  });

  it("renders no app selected state", () => {
    selectedAppIdState = null;

    render(<ConfigurePanel />);

    expect(
      screen.getByText("Select an app to manage environment variables")
    ).toBeTruthy();
  });

  it("renders empty env vars state", () => {
    render(<ConfigurePanel />);

    expect(
      screen.getByText("No environment variables configured")
    ).toBeTruthy();
  });

  it("enters add mode and validates empty input", () => {
    render(<ConfigurePanel />);

    fireEvent.click(screen.getByText("Add Environment Variable"));
    fireEvent.click(screen.getByText("Save"));

    expect(showErrorSpy).toHaveBeenCalled();
  });

  it("adds a new environment variable", () => {
    render(<ConfigurePanel />);

    fireEvent.click(screen.getByText("Add Environment Variable"));

    fireEvent.change(screen.getByPlaceholderText("e.g., API_URL"), {
      target: { value: "KEY1" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("e.g., https://api.example.com"),
      { target: { value: "VAL1" } }
    );

    fireEvent.click(screen.getByText("Save"));

    expect(mutateSpy).toHaveBeenCalled();
  });

  it("renders env vars and allows edit + delete", () => {
    envVarsState = [{ key: "A", value: "1" }];

    render(<ConfigurePanel />);

    fireEvent.click(screen.getByTestId("edit-env-var-A"));
    fireEvent.click(screen.getByTestId("cancel-edit-env-var"));
    fireEvent.click(screen.getByTestId("delete-env-var-A"));

    expect(mutateSpy).toHaveBeenCalled();
  });

  it("navigates to more app settings", () => {
    render(<ConfigurePanel />);

    fireEvent.click(screen.getByText("More app settings"));

    expect(pushSpy).toHaveBeenCalledWith("/app-details?appId=1");
  });

  it("renders Neon configuration section", () => {
    render(<ConfigurePanel />);

    expect(screen.getByTestId("neon-configure")).toBeTruthy();
  });
});
