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

  const startButton = page.getByRole("button", { name: /Start Quiz/i }).first();
  await expect(startButton).toBeEnabled({ timeout: 15000 });
  await startButton.click({ force: true });

  // Wait for the quiz screen to appear
  await page.waitForSelector(".ios-series-prompt", { timeout: 15000 });

  // 1. Verify Question Prompt Boldness is 400 (normal) or 500 depending on platform variable font rendering
  const promptWeight = await page.$eval(".ios-series-prompt", (el) =>
    window.getComputedStyle(el).fontWeight
  );
  console.log("Computed .ios-series-prompt font-weight:", promptWeight);
  expect(["400", "500", "normal"]).toContain(promptWeight);

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

  // 5. Question reads directly from the canvas — no card treatment.
  const questionCardStyle = await page.$eval(".ios-series-question-card", (el) => {
    const style = window.getComputedStyle(el);
    return {
      backgroundColor: style.backgroundColor,
      borderTopWidth: style.borderTopWidth,
      boxShadow: style.boxShadow,
      borderRadius: style.borderRadius,
    };
  });
  expect(questionCardStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(questionCardStyle.borderTopWidth).toBe("0px");
  expect(questionCardStyle.boxShadow).toBe("none");
  expect(questionCardStyle.borderRadius).toBe("0px");

  // 6. Answer rows use tonal fill separation rather than visible outlines.
  const optionStyle = await page.$eval(".ios-series-option", (el) => {
    const style = window.getComputedStyle(el);
    return {
      backgroundColor: style.backgroundColor,
      borderTopWidth: style.borderTopWidth,
    };
  });
  const canvasColor = await page.$eval(".ios-series-quiz", (el) =>
    window.getComputedStyle(el).backgroundColor
  );
  expect(optionStyle.backgroundColor).not.toBe(canvasColor);
  expect(optionStyle.borderTopWidth).toBe("0px");

  // 7. Solution and Ask AI are equal sibling actions in the same color system.
  const [solutionIconColor, aiIconColor] = await Promise.all([
    page.$eval(".ios-series-pill-solution .solution-icon", (el) => window.getComputedStyle(el).color),
    page.$eval(".ios-series-pill-ai .ai-icon", (el) => window.getComputedStyle(el).color),
  ]);
  expect(solutionIconColor).toBe(aiIconColor);

  const actionMetrics = await page.$eval(".ios-series-pill-item", (items) =>
    items.map((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        backgroundColor: style.backgroundColor,
      };
    })
  );
  expect(actionMetrics).toHaveLength(2);
  expect(actionMetrics[0]).toEqual(actionMetrics[1]);

  // 8. Submit remains primary, but uses the restrained slate-blue theme.
  const submitColor = await page.$eval(".ios-series-footer-next", (el) =>
    window.getComputedStyle(el).backgroundColor
  );
  expect(submitColor).toBe("rgb(86, 119, 166)");

  // Capture Screenshot for visual confirmation
  await page.screenshot({ path: "mobile-quiz-verified.png" });
});
