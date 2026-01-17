import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// HOIST SAFE MOCKS
vi.mock("@/utils/openExternalUrl", () => ({
  openExternalUrl: vi.fn(),
}));

vi.mock("lucide-react", () => ({
  KeyRound: () => <span data-testid="key-icon" />,
}));

let mockSettings: any = {};
let mockBudget: any = null;

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: mockSettings,
  }),
}));

vi.mock("@/hooks/useUserBudgetInfo", () => ({
  useUserBudgetInfo: () => ({
    userBudget: mockBudget,
  }),
}));

// IMPORT AFTER MOCKS
import {
  ProBanner,
  ManageDyadProButton,
  SetupDyadProButton,
  AiAccessBanner,
  SmartContextBanner,
  TurboBanner,
} from "../ProBanner";

import { openExternalUrl } from "@/utils/openExternalUrl";

// TESTS
describe("ProBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = {};
    mockBudget = null;
  });

  it("renders ManageDyadProButton when Dyad Pro is enabled", () => {
    mockSettings = { enableDyadPro: true };

    render(<ProBanner />);

    expect(
      screen.getByText("Manage Dyad Pro subscription"),
    ).toBeTruthy();
  });

  it("renders ManageDyadProButton when user budget exists", () => {
    mockBudget = { remaining: 100 };

    render(<ProBanner />);

    expect(
      screen.getByText("Manage Dyad Pro subscription"),
    ).toBeTruthy();
  });

  it("renders AI banner when random selects ai", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    render(<ProBanner />);

    expect(
      screen.getByText("Access leading AI models with one plan"),
    ).toBeTruthy();
  });

  it("renders Smart Context banner when random selects smart", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    render(<ProBanner />);

    expect(screen.getByText("Up to 5x cheaper")).toBeTruthy();
  });

  it("renders Turbo banner when random selects turbo", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);

    render(<ProBanner />);

    expect(
      screen.getByText("Generate code 4–10x faster"),
    ).toBeTruthy();
  });

  it("clicking SetupDyadProButton opens settings link", () => {
    render(<SetupDyadProButton />);

    fireEvent.click(
      screen.getByText("Already have Dyad Pro? Add your key"),
    );

    expect(vi.mocked(openExternalUrl)).toHaveBeenCalled();
  });

  it("clicking ManageDyadProButton opens subscription link", () => {
    render(<ManageDyadProButton />);

    fireEvent.click(
      screen.getByText("Manage Dyad Pro subscription"),
    );

    expect(vi.mocked(openExternalUrl)).toHaveBeenCalled();
  });

  it("clicking AiAccessBanner opens marketing link", () => {
    render(<AiAccessBanner />);

    fireEvent.click(
      screen.getByText("Access leading AI models with one plan"),
    );

    expect(vi.mocked(openExternalUrl)).toHaveBeenCalled();
  });

  it("clicking SmartContextBanner opens marketing link", () => {
    render(<SmartContextBanner />);

    fireEvent.click(screen.getByText("Up to 5x cheaper"));

    expect(vi.mocked(openExternalUrl)).toHaveBeenCalled();
  });

  it("clicking TurboBanner opens marketing link", () => {
    render(<TurboBanner />);

    fireEvent.click(
      screen.getByText("Generate code 4–10x faster"),
    );

    expect(vi.mocked(openExternalUrl)).toHaveBeenCalled();
  });
});
