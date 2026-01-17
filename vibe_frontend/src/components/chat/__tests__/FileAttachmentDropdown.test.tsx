import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileAttachmentDropdown } from "../FileAttachmentDropdown";

describe("FileAttachmentDropdown Component", () => {
  it("should render without crashing", () => {
    render(<FileAttachmentDropdown onFileSelect={vi.fn()} />);
    expect(document.body).toBeTruthy();
  });

  it("should render attach files button", () => {
    render(<FileAttachmentDropdown onFileSelect={vi.fn()} />);
    expect(screen.getByTitle("Attach files")).toBeTruthy();
  });

  it("should render hidden file inputs", () => {
    render(<FileAttachmentDropdown onFileSelect={vi.fn()} />);

    expect(
      screen.getByTestId("chat-context-file-input")
    ).toBeTruthy();

    expect(
      screen.getByTestId("upload-to-codebase-file-input")
    ).toBeTruthy();
  });

  it("should call onFileSelect for chat-context upload", () => {
    const onFileSelect = vi.fn();

    render(<FileAttachmentDropdown onFileSelect={onFileSelect} />);

    const input = screen.getByTestId(
      "chat-context-file-input"
    ) as HTMLInputElement;

    const file = new File(["test"], "test.txt", {
      type: "text/plain",
    });

    fireEvent.change(input, {
      target: { files: [file] },
    });

    expect(onFileSelect).toHaveBeenCalledTimes(1);

    const [files, type] = onFileSelect.mock.calls[0];

    expect(Array.isArray(files)).toBe(true);
    expect(files[0].name).toBe("test.txt");
    expect(type).toBe("chat-context");
  });

  it("should call onFileSelect for upload-to-codebase upload", () => {
    const onFileSelect = vi.fn();

    render(<FileAttachmentDropdown onFileSelect={onFileSelect} />);

    const input = screen.getByTestId(
      "upload-to-codebase-file-input"
    ) as HTMLInputElement;

    const file = new File(["img"], "image.png", {
      type: "image/png",
    });

    fireEvent.change(input, {
      target: { files: [file] },
    });

    expect(onFileSelect).toHaveBeenCalledTimes(1);

    const [files, type] = onFileSelect.mock.calls[0];

    expect(Array.isArray(files)).toBe(true);
    expect(files[0].name).toBe("image.png");
    expect(type).toBe("upload-to-codebase");
  });

  it("should disable attach button when disabled", () => {
    render(
      <FileAttachmentDropdown
        onFileSelect={vi.fn()}
        disabled
      />
    );

    const button = screen.getByTitle(
      "Attach files"
    ) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
  });
});
