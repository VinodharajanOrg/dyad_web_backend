import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProviderSettingsGrid } from "../ProviderSettings";

// Router mock
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

// Hook state
let mockProviders: any[] | null = null;
let mockLoading = false;
let mockError: Error | null = null;
const isProviderSetupMock = vi.fn();

// useLanguageModelProviders
vi.mock("@/hooks/useLanguageModelProviders", () => ({
  useLanguageModelProviders: () => ({
    data: mockProviders,
    isLoading: mockLoading,
    error: mockError,
    isProviderSetup: isProviderSetupMock,
  }),
}));

// useCustomLanguageModelProvider
const deleteProviderMock = vi.fn();

vi.mock("@/hooks/useCustomLanguageModelProvider", () => ({
  useCustomLanguageModelProvider: () => ({
    deleteProvider: deleteProviderMock,
    isDeleting: false,
  }),
}));

// CreateCustomProviderDialog mock
vi.mock("../CreateCustomProviderDialog", () => ({
  CreateCustomProviderDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? (
      <div role="dialog">
        <h2>Add Custom Provider</h2>
      </div>
    ) : null,
}));

// Icons
vi.mock("lucide-react", () => ({
  GiftIcon: () => <span />,
  PlusIcon: () => <span />,
  Trash2: () => <span />,
  Edit: () => <span />,
  AlertTriangle: () => <span />,
}));

// Reset state
beforeEach(() => {
  mockProviders = null;
  mockLoading = false;
  mockError = null;
  pushMock.mockClear();
  deleteProviderMock.mockClear();
  isProviderSetupMock.mockClear();
});

// TESTS
describe("ProviderSettingsGrid", () => {
  it("renders loading skeletons", () => {
    mockLoading = true;

    render(<ProviderSettingsGrid />);

    expect(screen.getByText("AI Providers")).toBeTruthy();
  });

  it("renders error state", () => {
    mockError = new Error("boom");

    render(<ProviderSettingsGrid />);

    expect(
      screen.getByText((c) => c.includes("Failed to load AI providers"))
    ).toBeTruthy();
  });

  it("renders providers and setup badges", () => {
    mockProviders = [
      { id: "1", name: "OpenAI", type: "custom", hasFreeTier: true },
    ];
    isProviderSetupMock.mockReturnValue(true);

    render(<ProviderSettingsGrid />);

    expect(screen.getByText("OpenAI")).toBeTruthy();
    expect(screen.getByText("Ready")).toBeTruthy();
  });

  it("navigates when provider card is clicked", () => {
    mockProviders = [
      { id: "1", name: "OpenAI", type: "custom", hasFreeTier: false },
    ];
    isProviderSetupMock.mockReturnValue(true);

    render(<ProviderSettingsGrid />);

    fireEvent.click(screen.getByText("OpenAI"));

    expect(pushMock).toHaveBeenCalledWith("/settings/providers/OpenAI");
  });

  it("opens edit provider dialog", async () => {
    mockProviders = [
      { id: "1", name: "OpenAI", type: "custom", hasFreeTier: false },
    ];
    isProviderSetupMock.mockReturnValue(true);

    render(<ProviderSettingsGrid />);

    const dialogsBefore = screen.queryAllByRole("dialog").length;

    fireEvent.click(screen.getByTestId("edit-provider"));
    await Promise.resolve();

    const dialogsAfter = screen.getAllByRole("dialog").length;

    expect(dialogsAfter).toBeTruthy();
    expect(dialogsAfter > dialogsBefore).toBeTruthy();
  });

  it("opens delete confirmation and deletes provider", async () => {
    mockProviders = [
      { id: "1", name: "OpenAI", type: "custom", hasFreeTier: false },
    ];
    isProviderSetupMock.mockReturnValue(true);

    render(<ProviderSettingsGrid />);

    fireEvent.click(screen.getByTestId("delete-provider"));
    fireEvent.click(screen.getByText("Delete Provider"));

    await Promise.resolve();

    expect(deleteProviderMock).toHaveBeenCalledWith("1");
  });

  it("opens create provider dialog when add card clicked", async () => {
    mockProviders = [];
    isProviderSetupMock.mockReturnValue(false);

    render(<ProviderSettingsGrid />);

    const dialogsBefore = screen.queryAllByRole("dialog").length;

    fireEvent.click(screen.getByText("Add custom provider"));
    await Promise.resolve();

    const dialogsAfter = screen.getAllByRole("dialog").length;

    expect(dialogsAfter).toBeTruthy();
    expect(dialogsAfter > dialogsBefore).toBeTruthy();
  });
});
