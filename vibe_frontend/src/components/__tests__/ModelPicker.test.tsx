import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

// JOTAI (HOIST-SAFE, FULL)
const setAtomMock = vi.fn();

vi.mock("jotai", () => {
  const atom = (initialValue: any) => ({
    __atom: true,
    initialValue,
  });

  return {
    atom,
    useAtom: () => [{}, setAtomMock],
    useAtomValue: () => ({}),
    useSetAtom: () => setAtomMock,
  };
});

// Settings
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: {
      selectedModel: { name: "gpt-4", provider: "openai" },
      proEnabled: true,
    },
    updateSettings: vi.fn(),
  }),
}));

//PROVIDERS + MODELS
vi.mock("@/hooks/useLanguageModelsByProviders", () => ({
  useLanguageModelsByProviders: () => ({
    data: {
      auto: [
        {
          apiName: "turbo",
          displayName: "Auto Turbo",
          description: "Auto model",
        },
      ],
      "1": [
        {
          apiName: "gpt-4",
          displayName: "GPT-4",
          description: "GPT-4 desc",
          dollarSigns: 3,
        },
      ],
    },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useLanguageModelProviders", () => ({
  useLanguageModelProviders: () => ({
    data: [{ id: 1, name: "OpenAI", type: "cloud" }],
    isLoading: false,
  }),
}));

// LOCAL MODELS
vi.mock("@/hooks/useLocalModels", () => ({
  useLocalModels: () => ({
    models: [{ modelName: "llama2", displayName: "LLaMA 2" }],
    loading: false,
    error: null,
    loadModels: vi.fn(),
  }),
}));

vi.mock("@/hooks/useLMStudioModels", () => ({
  useLocalLMSModels: () => ({
    models: [{ modelName: "/models/mistral", displayName: "Mistral" }],
    loading: false,
    error: null,
    loadModels: vi.fn(),
  }),
}));

// UI PRIMITIVES
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div onClick={onClick}>{children}</div>
  ),
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <div />,
  DropdownMenuSub: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

// MISC
vi.mock("@/components/PriceBadge", () => ({
  PriceBadge: () => <span>$$$</span>,
}));

vi.mock("@/lib/schemas", () => ({
  isDyadProEnabled: () => true,
}));

vi.mock("@/ipc/shared/language_model_constants", () => ({
  TURBO_MODELS: [{ apiName: "turbo", displayName: "Turbo" }],
}));

vi.mock("@/lib/utils", () => ({
  cn: (...c: any[]) => c.filter(Boolean).join(" "),
}));

//IMPORT AFTER MOCKS
import { ModelPicker } from "../ModelPicker";

// TESTS
describe("ModelPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with initial model from settings", () => {
    render(<ModelPicker />);
    expect(screen.getByText("GPT-4")).toBeTruthy();
  });

  it("opens dropdown and shows cloud models", () => {
    render(<ModelPicker />);
    fireEvent.click(screen.getByText("GPT-4"));
    expect(screen.getByText("Cloud Models")).toBeTruthy();
  });

  it("selects auto model", async () => {
    render(<ModelPicker />);
    fireEvent.click(screen.getByText("GPT-4"));
    fireEvent.click(screen.getByText("Auto Turbo"));
    await Promise.resolve();
    expect(setAtomMock).toHaveBeenCalled();
  });

  it("selects Ollama model", async () => {
    render(<ModelPicker />);
    fireEvent.click(screen.getByText("GPT-4"));
    fireEvent.click(screen.getByText("Ollama"));
    fireEvent.click(screen.getByText("LLaMA 2"));
    await Promise.resolve();
    expect(setAtomMock).toHaveBeenCalled();
  });

  it("selects LM Studio model", async () => {
    render(<ModelPicker />);
    fireEvent.click(screen.getByText("GPT-4"));
    fireEvent.click(screen.getByText("LM Studio"));
    fireEvent.click(screen.getByText("Mistral"));
    await Promise.resolve();
    expect(setAtomMock).toHaveBeenCalled();
  });
});
