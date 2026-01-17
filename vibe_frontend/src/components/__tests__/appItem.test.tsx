import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";


vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn(() => "2 days ago"),
}));

//lucide-react
vi.mock("lucide-react", () => ({
  Star: ({ className }: any) => (
    <div data-testid="star-icon" className={className} />
  ),
}));

//Sidebar + Button
vi.mock("@/components/ui/sidebar", () => ({
  SidebarMenuItem: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, ...rest }: any) => (
    <button disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));


import { AppItem } from "../appItem";

//TEST DATA
const baseApp = {
  id: 1,
  name: "Test App",
  createdAt: new Date().toISOString(),
  isFavorite: false,
};

describe("AppItem", () => {
  const handleAppClick = vi.fn();
  const handleToggleFavorite = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders app name and relative time", () => {
    const { getByText } = render(
      <AppItem
        app={baseApp as any}
        handleAppClick={handleAppClick}
        selectedAppId={null}
        handleToggleFavorite={handleToggleFavorite}
        isFavoriteLoading={false}
      />
    );

    expect(getByText("Test App")).toBeTruthy();
    expect(getByText("2 days ago")).toBeTruthy();
  });

  it("calls handleAppClick when app button is clicked", () => {
    const { getByTestId } = render(
      <AppItem
        app={baseApp as any}
        handleAppClick={handleAppClick}
        selectedAppId={null}
        handleToggleFavorite={handleToggleFavorite}
        isFavoriteLoading={false}
      />
    );

    fireEvent.click(getByTestId("app-list-item-Test App"));
    expect(handleAppClick).toHaveBeenCalledWith(1);
  });

  it("marks item as selected when selectedAppId matches", () => {
    const { getByTestId } = render(
      <AppItem
        app={baseApp as any}
        handleAppClick={handleAppClick}
        selectedAppId={1}
        handleToggleFavorite={handleToggleFavorite}
        isFavoriteLoading={false}
      />
    );

    expect(getByTestId("app-list-item-Test App").className).toBeTruthy();
  });

  it("calls handleToggleFavorite when favorite button is clicked", () => {
    const { getByTestId } = render(
      <AppItem
        app={baseApp as any}
        handleAppClick={handleAppClick}
        selectedAppId={null}
        handleToggleFavorite={handleToggleFavorite}
        isFavoriteLoading={false}
      />
    );

    fireEvent.click(getByTestId("favorite-button"));
    expect(handleToggleFavorite).toHaveBeenCalled();
  });

  it("disables favorite button when loading", () => {
    const { getByTestId } = render(
      <AppItem
        app={baseApp as any}
        handleAppClick={handleAppClick}
        selectedAppId={null}
        handleToggleFavorite={handleToggleFavorite}
        isFavoriteLoading={true}
      />
    );

    expect(getByTestId("favorite-button").hasAttribute("disabled")).toBeTruthy();
  });

  it("renders filled star when app is favorite", () => {
    const { getByTestId } = render(
      <AppItem
        app={{ ...baseApp, isFavorite: true } as any}
        handleAppClick={handleAppClick}
        selectedAppId={null}
        handleToggleFavorite={handleToggleFavorite}
        isFavoriteLoading={false}
      />
    );

    expect(getByTestId("star-icon").className).toContain("fill");
  });

  it("renders hover style for selected non-favorite app", () => {
    const { getByTestId } = render(
      <AppItem
        app={{ ...baseApp, isFavorite: false } as any}
        handleAppClick={handleAppClick}
        selectedAppId={1}
        handleToggleFavorite={handleToggleFavorite}
        isFavoriteLoading={false}
      />
    );

    expect(getByTestId("star-icon").className).toBeTruthy();
  });
});
