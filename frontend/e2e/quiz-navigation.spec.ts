import { test, expect } from "@playwright/test";

const appUrl = process.env.NAVIGATION_APP_URL;
test.skip(!appUrl, "Set NAVIGATION_APP_URL to a running local frontend; all API responses are mocked.");

for (const [parent, width] of [
  ["/reasoning/analogy", 320],
  ["/mathematics/arithmetic/profit-and-loss", 390],
  ["/english/synonyms-antonyms", 1440],
  ["/general-awareness/ancient-history", 390],
] as const) {
  test(`${parent}: panels close before quiz exit (${width}px)`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    await context.addCookies([{ name: "access_session", value: "navigation-fixture", url: appUrl! }]);
    await page.route("**/backend-api/**", async route => {
      const url = new URL(route.request().url());
      const question = { id: "1", question: "What is the capital of India?", options: ["Mumbai", "New Delhi", "Kolkata", "Chennai"], correctAnswer: "B", solution: "New Delhi is the capital.", concept: "Capitals", topic: url.searchParams.get("topic"), subject: url.searchParams.get("subject"), difficulty: "easy", questionType: "concept", exam: "SSC CGL 2025" };
      let data: unknown = {};
      if (url.pathname.endsWith("/session")) data = { questions: [question, { ...question, id: "2" }], hasMore: false, nextCursor: null, totalCount: 2 };
      if (url.pathname.endsWith("/meta")) data = { total: 2, exams: [], concepts: ["Capitals"], letters: {}, conceptGroups: [], groupingStatus: "empty" };
      await route.fulfill({ status: url.pathname.includes("refresh") ? 401 : 200, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.goto(`${appUrl}${parent}/quiz`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Start Quiz/ }).click();
    await expect(page.getByRole("button", { name: "Leave quiz", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByText("New Delhi", { exact: true }).click();
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    const reviewBtn = page.getByRole("button", { name: "Review", exact: true });
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click();
    }
    await page.getByRole("button", { name: /view solution/i }).click();
    await expect(page.getByRole("dialog", { name: "Question solution" })).toBeVisible();
    await page.getByRole("button", { name: "Back to quiz", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Question solution" })).toHaveCount(0);
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click();
    }
    await page.getByRole("button", { name: /view solution/i }).click();
    await page.evaluate(() => history.back());
    await expect(page.getByRole("dialog", { name: "Question solution" })).toHaveCount(0);
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click();
    }
    await page.getByRole("button", { name: /ask ai tutor/i }).click();
    await expect(page.getByRole("dialog", { name: "AI Tutor", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to quiz", exact: true })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => history.back());
    await expect(page.getByRole("dialog", { name: "AI Tutor", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Leave quiz", exact: true }).click();
    await expect(page.getByRole("dialog", { name: /exit quiz/i })).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("Your answer", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Leave quiz", exact: true }).click();
    await expect(page.getByRole("dialog", { name: /exit quiz/i })).toBeVisible();
    await page.getByRole("button", { name: "Exit quiz", exact: true }).click();
    await expect(page).toHaveURL(`${appUrl}${parent}`);
  });
}
