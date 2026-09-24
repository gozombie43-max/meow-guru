import { expect, it } from "vitest";
import { hidesPrimaryNavigation } from "./shell-policy";

it("distinguishes fullscreen tools from neighboring primary routes", () => {
  for (const route of ["/play/setup/adaptive", "/play/session/123", "/ai-chat/", "/mathematics/average/quiz", "/mathematics/average/formula-notes", "/mock-test/exam"]) expect(hidesPrimaryNavigation(route)).toBe(true);
  for (const route of ["/", "/play", "/play/setup-guide", "/mathematics", "/mock-test", "/videos"]) expect(hidesPrimaryNavigation(route)).toBe(false);
});
