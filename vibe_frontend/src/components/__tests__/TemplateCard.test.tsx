import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

//HOISTED MOCK REFERENCES 
const mocks = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  showWarning: vi.fn(),
  openExternalUrl: vi.fn(),
}));

// useSettings
let acceptedCommunityCode = false;
let hasNeonToken = true;
let selectedTemplateId: string | undefined;

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: {
      acceptedCommunityCode,
      neon: hasNeonToken ? { accessToken: "token" } : null,
      selectedTemplateId,
    },
    updateSettings: mocks.updateSettings,
  }),
}));

// toast
vi.mock("@/lib/toast", () => ({
  showWarning: mocks.showWarning,
}));

// openExternalUrl
vi.mock("@/utils/openExternalUrl", () => ({
  openExternalUrl: mocks.openExternalUrl,
}));

// CommunityCodeConsentDialog
vi.mock("../CommunityCodeConsentDialog", () => ({
  CommunityCodeConsentDialog: ({
    isOpen,
    onAccept,
    onCancel,
  }: any) =>
    isOpen ? (
      <div>
        <button onClick={onAccept}>Accept Community Code</button>
        <button onClick={onCancel}>Cancel Community Code</button>
      </div>
    ) : null,
}));

// Button
vi.mock("../ui/button", () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

// IMPORT AFTER MOCKS
import { TemplateCard } from "../TemplateCard";

// TestData
const baseTemplate = {
  id: "tpl-1",
  title: "Test Template",
  description: "Template description",
  imageUrl: "/test.png",
  isOfficial: true,
  isExperimental: false,
  requiresNeon: false,
  githubUrl: "https://github.com/test/repo",
};

// TESTS
describe("TemplateCard", () => {
  const onSelect = vi.fn();
  const onCreateApp = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    acceptedCommunityCode = false;
    hasNeonToken = true;
    selectedTemplateId = undefined;
  });

  it("renders template title and description", () => {
    render(
      <TemplateCard
        template={baseTemplate as any}
        isSelected={false}
        onSelect={onSelect}
        onCreateApp={onCreateApp}
      />,
    );

    expect(screen.getByText("Test Template")).toBeTruthy();
    expect(screen.getByText("Template description")).toBeTruthy();
  });

  it("selects template on click when allowed", () => {
    render(
      <TemplateCard
        template={baseTemplate as any}
        isSelected={false}
        onSelect={onSelect}
        onCreateApp={onCreateApp}
      />,
    );

    fireEvent.click(screen.getByText("Test Template"));

    expect(onSelect).toHaveBeenCalledWith("tpl-1");
  });

  it("shows community consent dialog for community template", () => {
    render(
      <TemplateCard
        template={{ ...baseTemplate, isOfficial: false } as any}
        isSelected={false}
        onSelect={onSelect}
        onCreateApp={onCreateApp}
      />,
    );

    fireEvent.click(screen.getByText("Test Template"));

    expect(screen.getByText("Accept Community Code")).toBeTruthy();
  });

  it("accepts community consent and selects template", () => {
    render(
      <TemplateCard
        template={{ ...baseTemplate, isOfficial: false } as any}
        isSelected={false}
        onSelect={onSelect}
        onCreateApp={onCreateApp}
      />,
    );

    fireEvent.click(screen.getByText("Test Template"));
    fireEvent.click(screen.getByText("Accept Community Code"));

    expect(mocks.updateSettings).toHaveBeenCalledWith({
      acceptedCommunityCode: true,
    });
    expect(onSelect).toHaveBeenCalledWith("tpl-1");
  });

  it("cancels community consent dialog", () => {
    render(
      <TemplateCard
        template={{ ...baseTemplate, isOfficial: false } as any}
        isSelected={false}
        onSelect={onSelect}
        onCreateApp={onCreateApp}
      />,
    );

    fireEvent.click(screen.getByText("Test Template"));
    fireEvent.click(screen.getByText("Cancel Community Code"));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows warning when Neon is required but not connected", () => {
    hasNeonToken = false;

    render(
      <TemplateCard
        template={{ ...baseTemplate, requiresNeon: true } as any}
        isSelected={false}
        onSelect={onSelect}
        onCreateApp={onCreateApp}
      />,
    );

    fireEvent.click(screen.getByText("Test Template"));

    expect(mocks.showWarning).toHaveBeenCalledWith(
      "Please connect your Neon account to use this template.",
    );
  });

  it("opens GitHub link without selecting template", () => {
    render(
      <TemplateCard
        template={baseTemplate as any}
        isSelected={false}
        onSelect={onSelect}
        onCreateApp={onCreateApp}
      />,
    );

    fireEvent.click(screen.getByText("View on GitHub"));

    expect(mocks.openExternalUrl).toHaveBeenCalledWith(
      "https://github.com/test/repo",
    );
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows Create App button only when selected and triggers onCreateApp", () => {
    selectedTemplateId = "tpl-1";

    render(
      <TemplateCard
        template={baseTemplate as any}
        isSelected={true}
        onSelect={onSelect}
        onCreateApp={onCreateApp}
      />,
    );

    fireEvent.click(screen.getByText("Create App"));

    expect(onCreateApp).toHaveBeenCalled();
  });
});
