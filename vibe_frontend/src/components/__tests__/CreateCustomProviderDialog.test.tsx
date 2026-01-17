import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";


//spies
const createProviderSpy = vi.fn();
const editProviderSpy = vi.fn();

// hook mock
vi.mock("@/hooks/useCustomLanguageModelProvider", () => ({
  useCustomLanguageModelProvider: () => ({
    createProvider: createProviderSpy,
    editProvider: editProviderSpy,
    isCreating: false,
    isEditing: false,
    error: null,
  }),
}));

// UI mocks
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

vi.mock("lucide-react", () => ({
  Loader2: () => <span />,
}));

// component
import { CreateCustomProviderDialog } from "../CreateCustomProviderDialog";

// helpers
const submitForm = async (container: HTMLElement) => {
  await act(async () => {
    fireEvent.submit(container.querySelector("form")!);
    await Promise.resolve();
  });
};

// tests
describe("CreateCustomProviderDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders add mode", () => {
    const { getByText } = render(
      <CreateCustomProviderDialog
        isOpen
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(getByText("Add Custom Provider")).toBeTruthy();
    expect(getByText("Add Provider")).toBeTruthy();
  });

  it("creates provider successfully", async () => {
    createProviderSpy.mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();

    const { container } = render(
      <CreateCustomProviderDialog
        isOpen
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    await act(async () => {
      fireEvent.change(container.querySelector("#name")!, {
        target: { value: "openai" },
      });
      fireEvent.change(container.querySelector("#apiBaseUrl")!, {
        target: { value: "https://api.test.com" },
      });
      fireEvent.change(container.querySelector("#envVarName")!, {
        target: { value: "API_KEY" },
      });
    });

    await submitForm(container);

    expect(createProviderSpy).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it("renders edit mode and submits edit", async () => {
    editProviderSpy.mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();

    const editingProvider = {
      id: "custom::12",
      name: "old",
      apiBaseUrl: "http://old",
      envVarName: "OLD_KEY",
    } as any;

    const { container, getByText } = render(
      <CreateCustomProviderDialog
        isOpen
        editingProvider={editingProvider}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    );

    expect(getByText("Edit Custom Provider")).toBeTruthy();

    await act(async () => {
      fireEvent.change(container.querySelector("#name")!, {
        target: { value: "new" },
      });
    });

    await submitForm(container);

    expect(editProviderSpy).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it("shows error on invalid edit provider id", async () => {
    editProviderSpy.mockRejectedValueOnce(new Error("Invalid provider ID"));

    const editingProvider = {
      id: "invalid",
      name: "x",
      apiBaseUrl: "y",
    } as any;

    const { container, getByText } = render(
      <CreateCustomProviderDialog
        isOpen
        editingProvider={editingProvider}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await submitForm(container);

    expect(getByText("Invalid provider ID")).toBeTruthy();
  });

  it("shows fallback error message", async () => {
    createProviderSpy.mockRejectedValueOnce("err");

    const { container, getByText } = render(
      <CreateCustomProviderDialog
        isOpen
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await act(async () => {
      fireEvent.change(container.querySelector("#name")!, {
        target: { value: "x" },
      });
      fireEvent.change(container.querySelector("#apiBaseUrl")!, {
        target: { value: "y" },
      });
    });

    await submitForm(container);

    expect(getByText("Failed to create custom provider")).toBeTruthy();
  });

  it("cancel closes dialog", () => {
    const onClose = vi.fn();

    const { getByText } = render(
      <CreateCustomProviderDialog
        isOpen
        onClose={onClose}
        onSuccess={vi.fn()}
      />
    );

    fireEvent.click(getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
