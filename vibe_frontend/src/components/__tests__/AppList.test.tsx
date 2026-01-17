import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";

//next/navigation
const pushSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushSpy,
  }),
}));

//lucide-react
vi.mock("lucide-react", () => ({
  PlusCircle: () => <div />,
  Search: () => <div />,
}));

//jotai — robust mock
let selectedAppIdState: number | null = null;
const setSelectedAppId = vi.fn((v) => {
  selectedAppIdState = v;
});
const setSelectedChatId = vi.fn();

vi.mock("jotai", () => ({
  atom: (v: any) => ({ __atom: true, v }),
  useAtom: () => [selectedAppIdState, setSelectedAppId],
  useSetAtom: () => setSelectedChatId,
}));

//sidebar components
vi.mock("@/components/ui/sidebar", () => ({
  SidebarGroup: ({ children, ...rest }: any) => (
    <div {...rest}>{children}</div>
  ),
  SidebarGroupContent: ({ children }: any) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: any) => <div>{children}</div>,
  SidebarMenu: ({ children, ...rest }: any) => (
    <div {...rest}>{children}</div>
  ),
}));


vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));


// hooks
let appsMock: any[] = [];
let loadingMock = false;
let errorMock: any = null;

vi.mock("@/hooks/useLoadApps", () => ({
  useLoadApps: () => ({
    apps: appsMock,
    loading: loadingMock,
    error: errorMock,
  }),
}));

const toggleFavoriteSpy = vi.fn();

vi.mock("@/hooks/useAddAppToFavorite", () => ({
  useAddAppToFavorite: () => ({
    toggleFavorite: toggleFavoriteSpy,
    isLoading: false,
  }),
}));

//AppItem
vi.mock("../appItem", () => ({
  AppItem: ({ app, handleAppClick, handleToggleFavorite }: any) => (
    <div
      data-testid={`app-item-${app.id}`}
      onClick={() => handleAppClick(app.id)}
    >
      <button
        data-testid={`fav-${app.id}`}
        onClick={(e) => handleToggleFavorite(app.id, e)}
      >
        fav
      </button>
    </div>
  ),
}));

//AppSearchDialog
vi.mock("../AppSearchDialog", () => ({
  AppSearchDialog: ({ open, onOpenChange, onSelectApp }: any) =>
    open ? (
      <div data-testid="search-dialog">
        <button onClick={() => onOpenChange(false)}>close</button>
        <button onClick={() => onSelectApp(99)}>select</button>
      </div>
    ) : null,
}));

//IMPORT AFTER MOCKS
import { AppList } from "../AppList";

//TESTS
describe("AppList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectedAppIdState = null;
    appsMock = [];
    loadingMock = false;
    errorMock = null;
  });

  it("returns null when show is false", () => {
    const { container } = render(<AppList show={false} />);
    expect(container.innerHTML === "").toBeTruthy();
  });

  it("renders loading state", () => {
    loadingMock = true;
    const { getByText } = render(<AppList show />);
    expect(getByText("Loading apps...")).toBeTruthy();
  });

  it("renders error state", () => {
    errorMock = new Error("fail");
    const { getByText } = render(<AppList show />);
    expect(getByText("Error loading apps")).toBeTruthy();
  });

  it("renders empty state when no apps exist", () => {
    appsMock = [];
    const { getByText } = render(<AppList show />);
    expect(getByText("No apps found")).toBeTruthy();
  });

  it("renders favorite and non-favorite apps", () => {
    appsMock = [
      { id: 1, isFavorite: true },
      { id: 2, isFavorite: false },
    ];

    const { getByTestId } = render(<AppList show />);
    expect(getByTestId("app-item-1")).toBeTruthy();
    expect(getByTestId("app-item-2")).toBeTruthy();
  });

  it("handles app click correctly", () => {
    appsMock = [{ id: 5, isFavorite: false }];

    const { getByTestId } = render(<AppList show />);
    fireEvent.click(getByTestId("app-item-5"));

    expect(setSelectedAppId).toHaveBeenCalledWith(5);
    expect(setSelectedChatId).toHaveBeenCalledWith(null);
    expect(pushSpy).toHaveBeenCalledWith("/app-details?appId=5");
  });

  it("handles favorite toggle and stops propagation", () => {
    appsMock = [{ id: 7, isFavorite: false }];

    const { getByTestId } = render(<AppList show />);
    fireEvent.click(getByTestId("fav-7"));

    expect(toggleFavoriteSpy).toHaveBeenCalledWith(7);
  });

  it("opens and closes search dialog and selects app", () => {
    appsMock = [{ id: 1, isFavorite: false }];

    const { getByTestId, queryByTestId } = render(<AppList show />);
    fireEvent.click(getByTestId("search-apps-button"));

    expect(getByTestId("search-dialog")).toBeTruthy();

    fireEvent.click(getByTextFrom(queryByTestId("search-dialog")!, "close"));
    expect(queryByTestId("search-dialog")).not.toBeTruthy();
  });
});

//Helper
function getByTextFrom(el: HTMLElement, text: string) {
  return Array.from(el.querySelectorAll("*")).find(
    (n) => n.textContent === text,
  ) as HTMLElement;
}
