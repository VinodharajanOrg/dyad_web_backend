import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";

// HOISTED ATOMS
const atoms = vi.hoisted(() => ({
  selectedAppIdAtom: { __atom: "selectedAppId" },
}));

// MUTABLE MOCKS
const createAppMock = vi.fn();
const useCheckNameMock = vi.fn();
const routerPushMock = vi.fn();
const setSelectedAppIdMock = vi.fn();
const showErrorMock = vi.fn();

// NEXT
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

// JOTAI
vi.mock("jotai", () => ({
  atom: (v: any) => ({ __atom: v }),
  useSetAtom: (atom: any) => {
    if (atom === atoms.selectedAppIdAtom) return setSelectedAppIdMock;
    return vi.fn();
  },
}));

vi.mock("@/atoms/appAtoms", () => ({
  selectedAppIdAtom: atoms.selectedAppIdAtom,
}));

// HOOKS
vi.mock("@/hooks/useCreateApp", () => ({
  useCreateApp: () => ({ createApp: createAppMock }),
}));

vi.mock("@/hooks/useCheckName", () => ({
  useCheckName: (...args: any[]) => useCheckNameMock(...args),
}));

// TOAST
vi.mock("@/lib/toast", () => ({
  showError: (...args: any[]) => showErrorMock(...args),
}));

// UI
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, type }: any) => (
    <button disabled={disabled} onClick={onClick} type={type}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, disabled }: any) => (
    <input value={value} onChange={onChange} disabled={disabled} />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

vi.mock("lucide-react", () => ({
  Loader2: () => <div />,
}));

// IMPORT
import { CreateAppDialog } from "../CreateAppDialog";

// TESTS
describe("CreateAppDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useCheckNameMock.mockReturnValue({ data: { exists: false } });

    createAppMock.mockResolvedValue({
      app: { id: 10, name: "Test App" },
      appId: 10,
      chatId: 20,
    });
  });

  it("renders dialog when open", () => {
    const { queryByText } = render(
      <CreateAppDialog
        open
        onOpenChange={vi.fn()}
        template={{ title: "Demo" } as any}
      />
    );

    expect(queryByText("Create New App")).toBeTruthy();
  });

  it("does not submit when name is empty", () => {
    const { queryByText } = render(
      <CreateAppDialog
        open
        onOpenChange={vi.fn()}
        template={{ title: "Demo" } as any}
      />
    );

    fireEvent.click(queryByText("Create App")!);
    expect(createAppMock).not.toHaveBeenCalled();
  });

  it("blocks submission when name already exists", async () => {
    useCheckNameMock.mockReturnValue({ data: { exists: true } });

    const { container } = render(
      <CreateAppDialog
        open
        onOpenChange={vi.fn()}
        template={{ title: "Demo" } as any}
      />
    );

    fireEvent.change(container.querySelector("input")!, {
      target: { value: "Existing App" },
    });

    // Allow React to process state updates
    await new Promise(resolve => setTimeout(resolve, 0));

    const submitBtn = container.querySelector("button[type='submit']") as HTMLButtonElement;
    expect(submitBtn?.disabled).toBeTruthy();
    expect(createAppMock).not.toHaveBeenCalled();
  });

  it("creates app successfully and navigates", async () => {
    const onOpenChange = vi.fn();

    const { container } = render(
      <CreateAppDialog
        open
        onOpenChange={onOpenChange}
        template={{ title: "Demo" } as any}
      />
    );

    fireEvent.change(container.querySelector("input")!, {
      target: { value: "My App" },
    });

    fireEvent.submit(container.querySelector("form")!);
    await Promise.resolve();

    expect(createAppMock).toHaveBeenCalled();
    expect(setSelectedAppIdMock).toHaveBeenCalledWith(10);
    expect(routerPushMock).toHaveBeenCalledWith("/10/chat?id=20");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("handles create app error", async () => {
    createAppMock.mockRejectedValueOnce("boom");

    const { container } = render(
      <CreateAppDialog
        open
        onOpenChange={vi.fn()}
        template={{ title: "Demo" } as any}
      />
    );

    fireEvent.change(container.querySelector("input")!, {
      target: { value: "Fail App" },
    });

    fireEvent.submit(container.querySelector("form")!);
    await Promise.resolve();

    expect(showErrorMock).toHaveBeenCalled();
  });

  it("cancel button closes dialog", () => {
    const onOpenChange = vi.fn();

    const { queryByText } = render(
      <CreateAppDialog
        open
        onOpenChange={onOpenChange}
        template={{ title: "Demo" } as any}
      />
    );

    fireEvent.click(queryByText("Cancel")!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
