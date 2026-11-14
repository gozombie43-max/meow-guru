import { expect, it } from "vitest";
import { hidesPrimaryNavigation } from "./shell-policy";

it("distinguishes fullscreen tools from neighboring primary routes", () => {
  for (const route of [
    "/play/setup/adaptive",
    "/play/session/123",
    "/ai-chat/",
    "/mathematics/average/quiz",
    "/mathematics/average/formula-notes",
    "/mock-test/exam",
    "/battle",
    "/battle/rewards",
    "/battle/leaderboard",
    "/battle/missions",
    "/battle/profile",
    "/battle/social",
    "/english/homonyms-homophones/study-mode",
    "/english/homonyms-homophones/study-mode/quiz",
    "/english/spelling-misspelled-words/study-mode",
    "/english/spelling-misspelled-words/study-mode/quiz",
    "/english/synonyms-antonyms/study-mode",
    "/english/one-word-substitution/study-mode",
    "/english/one-word-substitution/study-mode/quiz",
    "/english/idioms-phrases/study-mode",
  ]) {
    expect(hidesPrimaryNavigation(route)).toBe(true);
  }
  for (const route of [
    "/",
    "/play",
    "/play/setup-guide",
    "/mathematics",
    "/mock-test",
    "/profile",
    "/english/homonyms-homophones",
    "/english/synonyms-antonyms",
  ]) {
    expect(hidesPrimaryNavigation(route)).toBe(false);
  }
});
