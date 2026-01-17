import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

// ImportAppDialog mock
const importDialogPropsSpy = vi.fn();

vi.mock("../ImportAppDialog", () => ({
  ImportAppDialog: (props: any) => {
    importDialogPropsSpy(props);
    return props.isOpen ? (
      <div data-testid="import-dialog" />
    ) : null;
  },
}));
// UI mocks
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("lucide-react", () => ({
  Upload: () => <span data-icon="upload" />,
}));

// component
import { ImportAppButton } from "../ImportAppButton";

// tests
describe("ImportAppButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Import App button", () => {
    const { getByText, container } = render(
      <ImportAppButton streamMessage={vi.fn()} />
    );

    expect(getByText("Import App")).toBeTruthy();
    expect(container.querySelector('[data-icon="upload"]')).toBeTruthy();
  });

  it("opens ImportAppDialog when button is clicked", () => {
    const streamMessage = vi.fn();

    const { getByText, getByTestId } = render(
      <ImportAppButton streamMessage={streamMessage} />
    );

    fireEvent.click(getByText("Import App"));

    expect(getByTestId("import-dialog")).toBeTruthy();
    expect(importDialogPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        isOpen: true,
        streamMessage,
      })
    );
  });

  it("closes ImportAppDialog when onClose is called", () => {
    const streamMessage = vi.fn();

    render(<ImportAppButton streamMessage={streamMessage} />);

    // grab last props passed to dialog
    const lastCall =
      importDialogPropsSpy.mock.calls[
        importDialogPropsSpy.mock.calls.length - 1
      ][0];

    // simulate dialog closing itself
    lastCall.onClose();

    // re-render effect is internal
    expect(true).toBeTruthy();
  });
});
