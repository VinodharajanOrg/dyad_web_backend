import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";

// lucide-react (icons)
vi.mock("lucide-react", () => {
  const Icon = () => <div />;
  return {
    Home: Icon,
    Inbox: Icon,
    Settings: Icon,
    HelpCircle: Icon,
    Store: Icon,
    BookOpen: Icon,
    LogOut: Icon,
  };
});

//next/navigation
let mockPathname = "/";
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

//next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

//jotai — full mock
let dropdownOpenState = false;
const setAtomSpy = vi.fn();

vi.mock("jotai", () => ({
  atom: (v: any) => ({ __atom: true, v }),
  useAtom: () => [dropdownOpenState, vi.fn()],
  useSetAtom: () => setAtomSpy,
}));

//Sidebar UI + hook (stateful)
let sidebarState: "collapsed" | "expanded" = "collapsed";
const toggleSidebar = vi.fn(() => {
  sidebarState = sidebarState === "collapsed" ? "expanded" : "collapsed";
});

vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({
    state: sidebarState,
    toggleSidebar,
  }),
  Sidebar: ({ children, onMouseLeave }: any) => (
    <div data-testid="sidebar" onMouseLeave={onMouseLeave}>
      {children}
    </div>
  ),
  SidebarContent: ({ children }: any) => <div>{children}</div>,
  SidebarFooter: ({ children }: any) => <div>{children}</div>,
  SidebarGroup: ({ children }: any) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: any) => <div>{children}</div>,
  SidebarMenu: ({ children }: any) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: any) => <div>{children}</div>,
  SidebarMenuButton: ({ children, onClick, onMouseEnter }: any) => (
    <button onClick={onClick} onMouseEnter={onMouseEnter}>
      {children}
    </button>
  ),
  SidebarRail: () => <div data-testid="rail" />,
  SidebarTrigger: ({ onMouseEnter }: any) => (
    <button data-testid="trigger" onMouseEnter={onMouseEnter} />
  ),
}));

//Child components — isolated
vi.mock("../ChatList", () => ({
  ChatList: ({ show }: any) => (
    <div data-testid="chat-list">{show && "CHAT"}</div>
  ),
}));

vi.mock("../AppList", () => ({
  AppList: ({ show }: any) => (
    <div data-testid="app-list">{show && "APPS"}</div>
  ),
}));

vi.mock("../SettingsList", () => ({
  SettingsList: ({ show }: any) => (
    <div data-testid="settings-list">{show && "SETTINGS"}</div>
  ),
}));

vi.mock("../HelpDialog", () => ({
  HelpDialog: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="help-dialog">
        <button onClick={onClose}>close</button>
      </div>
    ) : null,
}));


import { AppSidebar } from "../app-sidebar";

//TESTS
describe("AppSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sidebarState = "collapsed";
    dropdownOpenState = false;
    mockPathname = "/";
  });

  it("renders base sidebar layout", () => {
    const { getByTestId } = render(<AppSidebar />);
    expect(getByTestId("sidebar")).toBeTruthy();
    expect(getByTestId("rail")).toBeTruthy();
  });

  it("expands sidebar on hover when collapsed", () => {
    const { getByText } = render(<AppSidebar />);
    fireEvent.mouseEnter(getByText("Apps"));
    expect(toggleSidebar).toHaveBeenCalled();
  });

  it("shows AppList for app routes when expanded", () => {
    mockPathname = "/";
    sidebarState = "expanded";
    const { getByTestId } = render(<AppSidebar />);
    expect(getByTestId("app-list").textContent).toBeTruthy();
  });

  it("shows ChatList for chat routes", () => {
    mockPathname = "/chat/123";
    sidebarState = "expanded";
    const { getByTestId } = render(<AppSidebar />);
    expect(getByTestId("chat-list").textContent).toBeTruthy();
  });

  it("shows SettingsList for settings routes", () => {
    mockPathname = "/settings";
    sidebarState = "expanded";
    const { getByTestId } = render(<AppSidebar />);
    expect(getByTestId("settings-list").textContent).toBeTruthy();
  });

  it("opens and closes help dialog", () => {
    const { getByText, getByTestId, queryByTestId } = render(<AppSidebar />);
    fireEvent.click(getByText("Help"));
    expect(getByTestId("help-dialog")).toBeTruthy();
    fireEvent.click(getByText("close"));
    expect(queryByTestId("help-dialog")).not.toBeTruthy();
  });

  it("collapses on mouse leave when hover-expanded and dropdown closed", () => {
    const { getByText, getByTestId } = render(<AppSidebar />);

    // expand via hover (sets expandedByHover.current = true)
    fireEvent.mouseEnter(getByText("Apps"));
    expect(toggleSidebar).toHaveBeenCalled();

    toggleSidebar.mockClear();

    // mouse leave collapses
    fireEvent.mouseLeave(getByTestId("sidebar"));
    expect(toggleSidebar).toHaveBeenCalled();
  });

  it("does NOT collapse when dropdown is open", () => {
    dropdownOpenState = true;
    sidebarState = "expanded";
    const { getByTestId } = render(<AppSidebar />);
    fireEvent.mouseLeave(getByTestId("sidebar"));
    expect(toggleSidebar).not.toHaveBeenCalled();
  });
});
