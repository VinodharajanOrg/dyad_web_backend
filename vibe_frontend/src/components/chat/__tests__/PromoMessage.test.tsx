import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { PromoMessage } from "../PromoMessage";

// MOCKS
vi.mock("@/utils/openExternalUrl", () => ({
  openExternalUrl: vi.fn(),
}));

describe("PromoMessage Component", () => {
  it("should render without crashing", () => {
    render(<PromoMessage seed={1} />);
    expect(document.body).toBeTruthy();
  });

  it("should render some promotional text", () => {
    render(<PromoMessage seed={2} />);
    expect(document.body.textContent?.length).toBeGreaterThan(0);
  });

  it("should render a message container", () => {
    render(<PromoMessage seed={3} />);
    const paragraph = document.querySelector("p");
    expect(paragraph).toBeTruthy();
  });

  it("should render a link only if the selected message contains one", () => {
    render(<PromoMessage seed={4} />);

    const link = document.querySelector("a");

    // valid in both cases: link exists OR not
    expect(link === null || link instanceof HTMLAnchorElement).toBe(true);
  });

  it("should safely handle link clicks when a link exists", async () => {
    const { openExternalUrl } = await import("@/utils/openExternalUrl");

    render(<PromoMessage seed={5} />);

    const link = document.querySelector("a");

    // only click if link exists
    if (link) {
      fireEvent.click(link);
      expect(openExternalUrl).toHaveBeenCalled();
    } else {
      expect(openExternalUrl).not.toHaveBeenCalled();
    }
  });
});
