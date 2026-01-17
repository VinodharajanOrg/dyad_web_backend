import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AttachmentsList } from "../AttachmentsList";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  FileText: () => <div data-testid="file-text-icon" />,
  X: () => <div data-testid="x-icon" />,
  MessageSquare: () => <div data-testid="message-icon" />,
  Upload: () => <div data-testid="upload-icon" />,
}));

//Mock URL APIs used by <img>
const mockCreate = vi.fn(() => "blob:mock-url");
const mockRevoke = vi.fn();

global.URL.createObjectURL = mockCreate;
global.URL.revokeObjectURL = mockRevoke;

// Helpers
function createAttachment(
  name: string,
  mime: string = "text/plain",
  type: "chat" | "upload-to-codebase" = "chat"
) {
  return {
    type,
    file: new File(["dummy"], name, { type: mime }),
  };
}

// TESTS
describe("AttachmentsList – MAXIMUM COVERAGE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when attachments list is empty", () => {
    const { container } = render(
      <AttachmentsList attachments={[]} onRemove={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders non-image attachment with FileText icon and filename", () => {
    const attachments = [createAttachment("file.pdf", "application/pdf")];

    render(<AttachmentsList attachments={attachments} onRemove={() => {}} />);

    expect(screen.getByText("file.pdf")).toBeTruthy();
    expect(screen.getByTestId("file-text-icon")).toBeTruthy();
    expect(screen.getByTestId("message-icon")).toBeTruthy();
  });

  it("renders Upload icon when type is upload-to-codebase", () => {
    const attachments = [
      createAttachment(
        "upload.js",
        "application/javascript",
        "upload-to-codebase"
      ),
    ];

    render(<AttachmentsList attachments={attachments} onRemove={() => {}} />);

    expect(screen.getByTestId("upload-icon")).toBeTruthy();
  });

  it("renders image thumbnail and hover preview, covering load + error paths", () => {
    const attachments = [createAttachment("photo.png", "image/png")];

    render(<AttachmentsList attachments={attachments} onRemove={() => {}} />);

    // Both thumbnail + preview are rendered immediately (preview is CSS-hidden)
    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThanOrEqual(2);

    const thumbnail = images[0];
    const preview = images[1];

    // Trigger load + error on thumbnail
    fireEvent.load(thumbnail);
    fireEvent.error(thumbnail);

    // Trigger load + error on preview (covers lines 49–52)
    fireEvent.load(preview);
    fireEvent.error(preview);

    expect(mockRevoke).toHaveBeenCalledTimes(4);
  });

  it("renders tooltip with filename and formatted size", () => {
    const file = new File(["dummy-data"], "doc.txt", {
      type: "text/plain",
    });

    render(
      <AttachmentsList
        attachments={[{ type: "chat", file }]}
        onRemove={() => {}}
      />
    );

    const tooltipEl = document.querySelector("[title]");
    expect(tooltipEl).toBeTruthy();
    expect(tooltipEl!.getAttribute("title")).toContain("doc.txt");
    expect(tooltipEl!.getAttribute("title")).toContain("KB");
  });

  it("calls onRemove with correct index when remove button is clicked", () => {
    const onRemove = vi.fn();

    render(
      <AttachmentsList
        attachments={[createAttachment("remove.txt")]}
        onRemove={onRemove}
      />
    );

    fireEvent.click(screen.getByLabelText("Remove attachment"));
    expect(onRemove).toHaveBeenCalledWith(0);
  });
});
