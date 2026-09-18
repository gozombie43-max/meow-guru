import { test, expect } from "@playwright/test";

test("mobile quiz engine renders with reduced question boldness (400) and reduced metadata font size (12px)", async ({ page, context }) => {
  const appUrl = process.env.NAVIGATION_APP_URL || "http://127.0.0.1:3110";
  await page.setViewportSize({ width: 390, height: 844 });
  await context.addCookies([
    { name: "access_session", value: "mobile-quiz-fixture", domain: "127.0.0.1", path: "/" },
  ]);

  await page.route("**/backend-api/**", async (route) => {
    const url = new URL(route.request().url());
    const question = {
      id: "1",
      question: "Which planet is known as the Red Planet?",
      options: ["Venus", "Mars", "Jupiter", "Saturn"],
      correctAnswer: 1,
      solution: "Mars appears red due to iron oxide on its surface.",
      concept: "Solar System",
      topic: "astronomy",
      subject: "general-awareness",
      difficulty: "easy",
      questionType: "concept",
      exam: "SSC CGL 2024 Tier 1",
    };

    let data: unknown = {};
    if (url.pathname.endsWith("/session")) {
      data = {
        questions: [question],
        hasMore: false,
        nextCursor: null,
        totalCount: 1,
      };
    } else if (url.pathname.endsWith("/meta")) {
      data = {
        total: 1,
        exams: ["SSC CGL 2024 Tier 1"],
        concepts: ["Solar System"],
        letters: {},
        conceptGroups: [],
        groupingStatus: "empty",
      };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });

  await page.goto(`${appUrl}/general-awareness/ancient-history/quiz`, {
    waitUntil: "domcontentloaded",
  });

  const startButton = page.getByRole("button", { name: /Start Quiz/i });
  if (await startButton.isVisible()) {
    await startButton.click();
  }

  // Wait for the quiz screen to appear
  await page.waitForSelector(".ios-series-prompt", { timeout: 15000 });

  // 1. Verify Question Prompt Boldness is 400 (normal)
  const promptWeight = await page.$eval(".ios-series-prompt", (el) =>
    window.getComputedStyle(el).fontWeight
  );
  console.log("Computed .ios-series-prompt font-weight:", promptWeight);
  expect(["400", "normal"]).toContain(promptWeight);

  // 2. Verify Metadata Row Font Size is 12px
  const metaRowFontSize = await page.$eval(".ios-series-meta-row", (el) =>
    window.getComputedStyle(el).fontSize
  );
  console.log("Computed .ios-series-meta-row font-size:", metaRowFontSize);
  expect(metaRowFontSize).toBe("12px");

  // 3. Verify Concept Badge / Meta Items Font Size is 12px
  const metaItemsFontSize = await page.$eval(".ios-series-meta-items", (el) =>
    window.getComputedStyle(el).fontSize
  );
  console.log("Computed .ios-series-meta-items font-size:", metaItemsFontSize);
  expect(metaItemsFontSize).toBe("12px");

  // 4. Verify Timer Font Size is 12px
  const timerFontSize = await page.$eval(".ios-series-timer", (el) =>
    window.getComputedStyle(el).fontSize
  );
  console.log("Computed .ios-series-timer font-size:", timerFontSize);
  expect(timerFontSize).toBe("12px");

  // Capture Screenshot for visual confirmation
  await page.screenshot({ path: "mobile-quiz-verified.png" });
});
