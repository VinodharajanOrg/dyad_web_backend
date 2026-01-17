import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// MOCK lucide-react 
vi.mock("lucide-react", () => ({
  Trash2: () => <div data-testid="trash-icon" />,
}));

// IMPORT COMPONENT AFTER MOCKS
import { DyadDelete } from "../DyadDelete";

// TEST SUITE
describe("DyadDelete Component", () => {
  it("should render without crashing", () => {
    render(<DyadDelete />);
    expect(document.body).toBeTruthy();
  });

  it("should render Delete label", () => {
    render(<DyadDelete />);
    const label = screen.queryByText(/delete/i);
    expect(label).toBeTruthy();
  });

  it("should render Trash icon", () => {
    render(<DyadDelete />);
    const icon = screen.queryByTestId("trash-icon");
    expect(icon).toBeTruthy();
  });

  it("should extract and display filename from path prop", () => {
    render(<DyadDelete path="src/components/FileToDelete.tsx" />);
    const fileName = screen.queryByText("FileToDelete.tsx");
    expect(fileName).toBeTruthy();
  });

  it("should display full path when provided", () => {
    render(<DyadDelete path="src/utils/helpers.ts" />);
    const pathText = screen.queryByText("src/utils/helpers.ts");
    expect(pathText).toBeTruthy();
  });

  it("should render children content", () => {
    render(
      <DyadDelete path="src/app/page.tsx">
        This file will be permanently removed
      </DyadDelete>
    );

    const content = screen.queryByText(/permanently removed/i);
    expect(content).toBeTruthy();
  });

  it("should extract path from node.properties when path prop is missing", () => {
    const mockNode = {
      properties: {
        path: "lib/services/api.ts",
      },
    };

    render(<DyadDelete node={mockNode} />);

    const fileName = screen.queryByText("api.ts");
    expect(fileName).toBeTruthy();
  });
});
