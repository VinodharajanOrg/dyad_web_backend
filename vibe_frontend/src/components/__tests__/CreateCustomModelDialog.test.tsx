import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import React from "react";

// spies
const invalidateQueriesSpy = vi.fn();
const createSpy = vi.fn();
const successSpy = vi.fn();
const errorSpy = vi.fn();

// react-query
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesSpy,
  }),
  useMutation: (opts: any) => ({
    isPending: false,
    mutate: async () => {
      try {
        const res = await opts.mutationFn();
        await Promise.resolve(); // flush
        opts.onSuccess?.(res);
      } catch (e) {
        await Promise.resolve(); // flush
        opts.onError?.(e);
      }
    },
  }),
}));

//API
vi.mock("@/api/endpoints/language-models", () => ({
  languageModelsApi: {
    create: (...args: any[]) => createSpy(...args),
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
import { CreateCustomModelDialog } from "../CreateCustomModelDialog";

// helpers
const submitForm = async (container: HTMLElement) => {
  await act(async () => {
    fireEvent.submit(container.querySelector("form")!);
    await Promise.resolve();
  });
};

// tests
describe("CreateCustomModelDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog", () => {
    const { getByText } = render(
      <CreateCustomModelDialog
        isOpen
        providerId="1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(getByText("Add Custom Model")).toBeTruthy();
  });

  it("submits successfully with valid values", async () => {
    createSpy.mockResolvedValueOnce({ message: "ok" });

    const onClose = vi.fn();
    const onSuccess = vi.fn();

    const { container } = render(
      <CreateCustomModelDialog
        isOpen
        providerId="5"
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    await act(async () => {
      fireEvent.change(container.querySelector("#model-id")!, {
        target: { value: "gpt-x" },
      });
      fireEvent.change(container.querySelector("#model-name")!, {
        target: { value: "GPT X" },
      });
    });

    await submitForm(container);

    expect(createSpy).toHaveBeenCalled();
    expect(successSpy).toHaveBeenCalled();
    expect(invalidateQueriesSpy).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("errors when apiName is missing", async () => {
    const { container } = render(
      <CreateCustomModelDialog
        isOpen
        providerId="1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await submitForm(container);

    expect(errorSpy).toHaveBeenCalled();
  });

  it("errors when displayName is missing", async () => {
    const { container } = render(
      <CreateCustomModelDialog
        isOpen
        providerId="1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await act(async () => {
      fireEvent.change(container.querySelector("#model-id")!, {
        target: { value: "abc" },
      });
    });

    await submitForm(container);

    expect(errorSpy).toHaveBeenCalled();
  });

  it("errors on invalid numeric fields", async () => {
    const { container } = render(
      <CreateCustomModelDialog
        isOpen
        providerId="1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await act(async () => {
      fireEvent.change(container.querySelector("#model-id")!, {
        target: { value: "abc" },
      });
      fireEvent.change(container.querySelector("#model-name")!, {
        target: { value: "ABC" },
      });
      fireEvent.change(container.querySelector("#max-output-tokens")!, {
        target: { value: "bad" },
      });
    });

    await submitForm(container);

    expect(errorSpy).toHaveBeenCalled();
  });

  it("cancel closes dialog", () => {
    const onClose = vi.fn();

    const { getByText } = render(
      <CreateCustomModelDialog
        isOpen
        providerId="1"
        onClose={onClose}
        onSuccess={vi.fn()}
      />
    );

    fireEvent.click(getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
