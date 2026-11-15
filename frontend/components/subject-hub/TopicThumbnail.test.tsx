import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TopicThumbnail from "./TopicThumbnail";

describe("TopicThumbnail", () => {
  it("keeps the shimmer frame active until load finishes and avoids data-cached on network load", async () => {
    const { container } = render(<TopicThumbnail src="/topics/percentages.webp" size={56} />);
    const frame = container.querySelector('[class*="frame"]') as HTMLElement;
    const img = container.querySelector("img[data-topic-thumbnail]") as HTMLImageElement;

    expect(frame).toBeTruthy();
    expect(img).toBeTruthy();
    expect(frame.hasAttribute("data-loaded")).toBe(false);
    expect(img.hasAttribute("data-loaded")).toBe(false);
    expect(img.hasAttribute("data-cached")).toBe(false);

    fireEvent.load(img);
    await waitFor(() => {
      expect(frame.hasAttribute("data-loaded")).toBe(true);
      expect(img.hasAttribute("data-loaded")).toBe(true);
    });
    expect(img.hasAttribute("data-cached")).toBe(false);
  });

  it("marks already-decoded cached images with data-cached so they render without fade flicker", () => {
    const originalComplete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete");
    const originalNaturalWidth = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "naturalWidth");
    Object.defineProperty(HTMLImageElement.prototype, "complete", { configurable: true, get: () => true });
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", { configurable: true, get: () => 128 });

    try {
      const { container } = render(<TopicThumbnail src="/topics/percentages.webp" size={56} />);
      const frame = container.querySelector('[class*="frame"]') as HTMLElement;
      const img = container.querySelector("img[data-topic-thumbnail]") as HTMLImageElement;

      expect(frame.hasAttribute("data-loaded")).toBe(true);
      expect(img.hasAttribute("data-loaded")).toBe(true);
      expect(img.hasAttribute("data-cached")).toBe(true);
    } finally {
      if (originalComplete) Object.defineProperty(HTMLImageElement.prototype, "complete", originalComplete);
      else delete (HTMLImageElement.prototype as { complete?: boolean }).complete;
      if (originalNaturalWidth) Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", originalNaturalWidth);
      else delete (HTMLImageElement.prototype as { naturalWidth?: number }).naturalWidth;
    }
  });
});
