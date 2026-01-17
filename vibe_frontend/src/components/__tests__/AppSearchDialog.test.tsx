import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, fireEvent, act } from "@testing-library/react";
import type { App } from "@/api/endpoints/apps";

//   Fake timers for debounce
vi.useFakeTimers();

// Typed App factory
const makeApp = (overrides?: Partial<App>): App =>
  ({
    id: 1,
    name: "Test App",
    path: "/test",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    githubOrg: null,
    githubRepo: null,
    githubBranch: null,
    description: null,
    isFavorite: false,
    isArchived: false,
    visibility: "private",
    ownerId: 1,
    ...overrides,
  } as App);

//Command UI (hard mock)
vi.mock("../ui/command", () => ({
  CommandDialog: ({ children, open, filter, ...rest }: any) =>
    open ? (
      <div data-filter={!!filter} {...rest}>
        {children}
      </div>
    ) : null,
  CommandInput: ({ value, onValueChange, ...rest }: any) => (
    <input
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      {...rest}
    />
  ),
  CommandList: ({ children, ...rest }: any) => (
    <div {...rest}>{children}</div>
  ),
  CommandEmpty: ({ children, ...rest }: any) => (
    <div {...rest}>{children}</div>
  ),
  CommandGroup: ({ children, ...rest }: any) => (
    <div {...rest}>{children}</div>
  ),
  CommandItem: ({ children, onSelect, ...rest }: any) => (
    <div onClick={onSelect} {...rest}>
      {children}
    </div>
  ),
}));

//useSearchApps Hook
let searchResultsMock: App[] = [];

vi.mock("@/hooks/useSearchApps", () => ({
  useSearchApps: () => ({
    apps: searchResultsMock,
  }),
}));


import { AppSearchDialog } from "../AppSearchDialog";

//TEST DATA
const allApps: App[] = [
  makeApp({ id: 1, name: "Alpha", path: "/alpha" }),
  makeApp({ id: 2, name: "Beta", path: "/beta" }),
];

describe("AppSearchDialog", () => {
  const onOpenChange = vi.fn();
  const onSelectApp = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    searchResultsMock = [];
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("renders nothing when closed", () => {
    const { queryByTestId } = render(
      <AppSearchDialog
        open={false}
        onOpenChange={onOpenChange}
        onSelectApp={onSelectApp}
        allApps={allApps}
      />,
    );

    expect(queryByTestId("app-search-dialog")).not.toBeTruthy();
  });

  it("renders all apps when search is empty", () => {
    const { getByTestId } = render(
      <AppSearchDialog
        open
        onOpenChange={onOpenChange}
        onSelectApp={onSelectApp}
        allApps={allApps}
      />,
    );

    expect(getByTestId("app-search-item-1")).toBeTruthy();
    expect(getByTestId("app-search-item-2")).toBeTruthy();
  });

  it("updates search query and shows search results after debounce", async () => {
    searchResultsMock = [makeApp({ id: 99, name: "Gamma", path: "/gamma" })];

    const { getByTestId, queryByTestId } = render(
      <AppSearchDialog
        open
        onOpenChange={onOpenChange}
        onSelectApp={onSelectApp}
        allApps={allApps}
      />,
    );

    fireEvent.change(getByTestId("app-search-input"), {
      target: { value: "ga" },
    });

    expect(queryByTestId("app-search-item-99")).not.toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(getByTestId("app-search-item-99")).toBeTruthy();
  });

  it("calls onSelectApp when an item is selected", () => {
    const { getByTestId } = render(
      <AppSearchDialog
        open
        onOpenChange={onOpenChange}
        onSelectApp={onSelectApp}
        allApps={allApps}
      />,
    );

    fireEvent.click(getByTestId("app-search-item-1"));
    expect(onSelectApp).toHaveBeenCalledWith(1);
  });

  it("toggles dialog using Ctrl+K / Cmd+K", () => {
    render(
      <AppSearchDialog
        open={false}
        onOpenChange={onOpenChange}
        onSelectApp={onSelectApp}
        allApps={allApps}
      />,
    );

    fireEvent.keyDown(document, {
      key: "k",
      ctrlKey: true,
    });

    expect(onOpenChange).toHaveBeenCalled();
  });

  it("renders empty state when no apps exist", async () => {
    const { getByTestId } = render(
      <AppSearchDialog
        open
        onOpenChange={onOpenChange}
        onSelectApp={onSelectApp}
        allApps={[]}
      />,
    );

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(getByTestId("app-search-empty")).toBeTruthy();
  });

  it("passes custom filter function to CommandDialog", () => {
    const { getByTestId } = render(
      <AppSearchDialog
        open
        onOpenChange={onOpenChange}
        onSelectApp={onSelectApp}
        allApps={allApps}
      />,
    );

    expect(
      getByTestId("app-search-dialog").getAttribute("data-filter"),
    ).toBeTruthy();
  });
});
