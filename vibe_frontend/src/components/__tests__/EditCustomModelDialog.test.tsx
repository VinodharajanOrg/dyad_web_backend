import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import React from "react";

// SPIES
const invalidateQueriesSpy = vi.fn();
const updateSpy = vi.fn();
const successSpy = vi.fn();
const errorSpy = vi.fn();

// react-query (act-safe)
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesSpy,
  }),
  useMutation: (opts: any) => ({
    isPending: false,
    mutate: async () => {
      try {
        const res = await opts.mutationFn();
        await Promise.resolve();
        opts.onSuccess?.(res);
      } catch (e) {
        await Promise.resolve();
        opts.onError?.(e);
      }
    },
  }),
}));

// API
vi.mock("@/api/endpoints/language-models", () => ({
  languageModelsApi: {
    update: (...args: any[]) => updateSpy(...args),
  },
}));

// toast
vi.mock("@/lib/toast", () => ({
  showSuccess: (v: any) => successSpy(v),
  showError: (v: any) => errorSpy(v),
}));

// UI mocks
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
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

// component
import { EditCustomModelDialog } from "../EditCustomModelDialog";

// helpers
const submitForm = async (container: HTMLElement) => {
  await act(async () => {
    fireEvent.submit(container.querySelector("form")!);
    await Promise.resolve();
  });
};

// tests
describe("EditCustomModelDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseModel = {
    id: 7,
    apiName: "gpt-x",
    displayName: "GPT X",
    description: "desc",
    maxOutputTokens: 4096,
    contextWindow: 8192,
    approved: true,
  };

  it("renders nothing when model is null", () => {
    const { container } = render(
      <EditCustomModelDialog
        isOpen
        providerId="1"
        model={null}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("prefills form fields from model", () => {
    const { container } = render(
      <EditCustomModelDialog
        isOpen
        providerId="1"
        model={baseModel}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(
      (container.querySelector("#edit-model-id") as HTMLInputElement).value
    ).toBeTruthy();
    expect(
      (container.querySelector("#edit-model-name") as HTMLInputElement).value
    ).toBeTruthy();
  });

  it("submits successfully with valid data", async () => {
    updateSpy.mockResolvedValueOnce(undefined);

    const onClose = vi.fn();
    const onSuccess = vi.fn();

    const { container } = render(
      <EditCustomModelDialog
        isOpen
        providerId="99"
        model={baseModel}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    await act(async () => {
      fireEvent.change(container.querySelector("#edit-model-name")!, {
        target: { value: "GPT X Updated" },
      });
    });

    await submitForm(container);

    expect(updateSpy).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        displayName: "GPT X Updated",
      })
    );
    expect(successSpy).toHaveBeenCalled();
    expect(invalidateQueriesSpy).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error when validation fails", async () => {
    const { container } = render(
      <EditCustomModelDialog
        isOpen
        providerId="1"
        model={baseModel}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    // FORCE validation error reliably (string field)
    await act(async () => {
      fireEvent.change(container.querySelector("#edit-model-id")!, {
        target: { value: "" },
      });
    });

    await submitForm(container);

    expect(errorSpy).toHaveBeenCalled();
  });

  it("calls onClose when cancel is clicked", () => {
    const onClose = vi.fn();

    const { getByText } = render(
      <EditCustomModelDialog
        isOpen
        providerId="1"
        model={baseModel}
        onClose={onClose}
        onSuccess={vi.fn()}
      />
    );

    fireEvent.click(getByText("Cancel"));

    expect(onClose).toHaveBeenCalled();
  });
});
