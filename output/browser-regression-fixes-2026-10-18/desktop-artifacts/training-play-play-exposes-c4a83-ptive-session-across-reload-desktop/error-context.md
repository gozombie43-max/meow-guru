# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: training-play.spec.ts >> play exposes all modes and persists an adaptive session across reload
- Location: e2e\training-play.spec.ts:44:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('2 + 2 = ?', { exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('2 + 2 = ?', { exact: true }) with timeout 5000ms
  - waiting for getByText('2 + 2 = ?', { exact: true })

```

```yaml
- main:
  - status: Restoring your training session…
- alert
```

# Test source

```ts
  313 |             bestStreak: 1,
  314 |             questionsPerMinute: 1,
  315 |           },
  316 |         };
  317 |       }
  318 |       expect(url.searchParams.get('response')).toBe('delta');
  319 |       const { questions: _questions, ...state } = session;
  320 |       const response = session.status === 'active'
  321 |         ? { ...state, kind: 'delta', baseRevision: session.revision - 1 }
  322 |         : session;
  323 |       return route.fulfill({
  324 |         status: 200,
  325 |         contentType: "application/json",
  326 |         body: JSON.stringify(response),
  327 |       });
  328 |     }
  329 |
  330 |     const fixtureUrl = `http://127.0.0.1:3111${path}${url.search}`;
  331 |     const response = await route.fetch({ url: fixtureUrl });
  332 |     return route.fulfill({ response });
  333 |   });
  334 |
  335 |   await page.goto("/play");
  336 |   await expect(page.getByRole("button", { name: /^Set up / })).toHaveCount(8);
  337 |   const setupViewport = page.viewportSize()!;
  338 |   if (testInfo.project.name === "mobile") await page.setViewportSize({ width: 320, height: 568 });
  339 |   for (const mode of modes) {
  340 |     await page.getByRole("button", { name: `Set up ${mode.title}`, exact: true }).click();
  341 |     await expect(page).toHaveURL(new RegExp(`/play/setup/${mode.id}`));
  342 |     await expect(page.getByRole("heading", { name: mode.title, exact: true })).toBeVisible();
  343 |     await expect(async () => {
  344 |       const b = await page.getByRole("button", { name: "Begin training" }).boundingBox();
  345 |       expect(b!.y + b!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  346 |     }).toPass();
  347 |     if (mode.id === "adaptive") {
  348 |       expect(trainingReads).toEqual({ capabilities: 1, dashboard: 1, session: 0 });
  349 |       await page.screenshot({ path: testInfo.outputPath("setup.png") });
  350 |     }
  351 |     await page.getByRole("link", { name: "Back to Play" }).click();
  352 |     await expect(page).toHaveURL(/\/play$/);
  353 |   }
  354 |   await page.setViewportSize(setupViewport);
  355 |   await page.getByRole("button", { name: "Set up Adaptive" }).click();
  356 |   await expect(page).toHaveURL(/\/play\/setup\/adaptive/);
  357 |   await expect(page.getByRole("heading", { name: "Adaptive" })).toBeVisible();
  358 |   await page.getByRole("button", { name: /^Subject / }).click();
  359 |   const subjectListbox = page.getByRole("listbox", { name: "Subject" });
  360 |   await expect(subjectListbox).toBeVisible();
  361 |   await subjectListbox.getByRole("option", { name: "English", exact: true }).click();
  362 |   await page.screenshot({ path: testInfo.outputPath("subject-picker.png") });
  363 |   await expect(page.getByRole("button", { name: "Subject English", exact: true })).toBeFocused();
  364 |   await page.getByRole("button", { name: /^Topic / }).click();
  365 |   const topicPicker = page.getByRole("dialog", { name: "Choose Topic", exact: true });
  366 |   await expect(topicPicker.getByRole("radio", { name: "Grammar", exact: true })).toBeVisible();
  367 |   await expect(topicPicker.getByRole("radio", { name: "Arithmetic", exact: true })).toHaveCount(0);
  368 |   await topicPicker.getByRole("radio", { name: "Grammar", exact: true }).check();
  369 |   await topicPicker.getByRole("button", { name: "Cancel", exact: true }).click();
  370 |   await expect(page.getByRole("button", { name: "Topic Balanced topic mix", exact: true })).toBeVisible();
  371 |   await page.getByRole("button", { name: /^Topic / }).click();
  372 |   await topicPicker.getByRole("searchbox").fill("no-such-topic");
  373 |   await expect(topicPicker.getByRole("status")).toContainText("No matching topics");
  374 |   await page.keyboard.press("Escape");
  375 |   await expect(topicPicker).toHaveCount(0);
  376 |   await page.getByRole("button", { name: /^Subject / }).click();
  377 |   await page.keyboard.press("Escape");
  378 |   await expect(subjectListbox).toHaveCount(0);
  379 |   await page.getByRole("button", { name: "Begin training" }).click();
  380 |   await expect(page.getByText("Building your session…", { exact: false }).first()).toBeVisible();
  381 |   await expect(page.getByRole("button", { name: "Building your session…" })).toBeDisabled();
  382 |   await expect(page.getByRole("button", { name: /^Subject / })).toBeDisabled();
  383 |   expect(trainingReads.session).toBe(0);
  384 |   releaseCreation();
  385 |
  386 |   await expect(page).toHaveURL(/\/play\/session\/browser-training$/);
  387 |   await expect(page.getByText("2 + 2 = ?", { exact: true })).toBeVisible();
  388 |   expect(trainingReads.session).toBe(0);
  389 |   // Reload has no handoff and must fetch authoritative state.
  390 |   await page.reload();
  391 |   await expect(page.getByRole("heading", { name: "Loading your questions", exact: true })).toBeVisible();
  392 |   await expect(page.locator(".training-skeleton-option")).toHaveCount(4);
  393 |   await page.screenshot({ path: testInfo.outputPath("question-loading.png") });
  394 |   releaseQuestions();
  395 |   await expect(page.getByText("2 + 2 = ?", { exact: true })).toBeVisible();
  396 |   await expect(page.locator(".training-loading-skeleton")).toHaveCount(0);
  397 |   await page.locator("summary[aria-label='Question exam details']").click();
  398 |   await expect(page.locator(".training-question-info-content")).toContainText("SSC CHSL Tier I 2023");
  399 |   await expect(page.locator(".training-question-info-content dd").last()).toHaveText("2023");
  400 |   await page.screenshot({ path: testInfo.outputPath("question-metadata.png") });
  401 |   await page.keyboard.press("Escape");
  402 |   await expect(page.locator(".training-question-info-content")).toBeHidden();
  403 |   for (const theme of ["light", "dark"]) {
  404 |     await page.evaluate(value => localStorage.setItem("ui-theme", value), theme);
  405 |     for (const mode of modes) {
  406 |       const free = ["pressure", "section"].includes(mode.id);
  407 |       session = {
  408 |         ...session, mode: mode.id, effectiveMode: mode.id,
  409 |         policy: policy(mode.id, { navigation: free ? "free" : "forward", confidence: !["nightmare", "survival"].includes(mode.id) }),
  410 |         allowedVisitIndices: free ? [0, 1] : [], lives: mode.id === "survival" ? 3 : 999,
  411 |       };
  412 |       await page.reload();
> 413 |       await expect(page.getByText("2 + 2 = ?", { exact: true })).toBeVisible();
      |                                                                  ^ Error: expect(locator).toBeVisible() failed
  414 |       const footer = page.locator(".training-session-footer");
  415 |       await expect(async () => {
  416 |         const bounds = await footer.boundingBox();
  417 |         expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  418 |       }).toPass();
  419 |       expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  420 |       if (page.viewportSize()!.width < 1024) {
  421 |         const toggle = page.locator('.training-header-overview-btn');
  422 |         await toggle.click();
  423 |         await expect(page.locator("#training-overview")).toBeVisible();
  424 |         await toggle.click();
  425 |         await expect(page.locator("#training-overview")).toBeHidden();
  426 |       } else {
  427 |         await expect(page.locator("#training-overview")).toBeVisible();
  428 |       }
  429 |       await page.getByRole("radio", { name: /4/ }).click();
  430 |       await expect(page.getByText("Answer selected", { exact: true })).toBeVisible();
  431 |       await page.screenshot({ path: testInfo.outputPath(`${mode.id}-${theme}.png`) });
  432 |     }
  433 |   }
  434 |   session = { ...session, mode: "adaptive", effectiveMode: "adaptive", policy: policy("adaptive"), allowedVisitIndices: [], lives: 999 };
  435 |   const originalViewport = page.viewportSize()!;
  436 |   if (testInfo.project.name === "desktop") {
  437 |     for (const viewport of [{ width: 1366, height: 600 }, { width: 1280, height: 720 }]) {
  438 |       await page.setViewportSize(viewport);
  439 |       session.questions = [{
  440 |         ...questions[0],
  441 |         text: String.raw`The value of $\left(\frac{\cosec A}{\cosec A-1}+\frac{\cosec A}{\cosec A+1}\right)\left(\frac{\sec A}{\sec A-1}+\frac{\sec A}{\sec A+1}\right)^{-1}$, when $A=60^{\circ}$ is:`,
  442 |       }, questions[1]];
  443 |       await page.reload();
  444 |       await expect(page.getByRole("radio")).toHaveCount(4);
  445 |       for (const answer of await page.getByRole("radio").all()) await expect(answer).toBeInViewport({ ratio: 1 });
  446 |       await expect(page.getByRole("button", { name: "Sure", exact: true })).toBeInViewport({ ratio: 1 });
  447 |       expect(await page.locator(".training-session-main").evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
  448 |       await page.screenshot({ path: testInfo.outputPath(`desktop-fit-${viewport.width}.png`) });
  449 |     }
  450 |   }
  451 |   for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 540 }]) {
  452 |     await page.setViewportSize(viewport);
  453 |     session.questions = [{ ...questions[0], text: Array(12).fill("Read the statement carefully before selecting the correct answer.").join("\n\n") }, questions[1]];
  454 |     await page.reload();
  455 |     await expect(page.getByRole("button", { name: "Answer & continue" })).toBeVisible();
  456 |     await page.locator(".training-session-main").evaluate(element => { element.scrollTop = element.scrollHeight; });
  457 |     await expect(page.getByRole("radio", { name: /4/ })).toBeInViewport();
  458 |     const footer = await page.locator(".training-session-footer").boundingBox();
  459 |     expect(footer!.y + footer!.height).toBeLessThanOrEqual(viewport.height + 1);
  460 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  461 |     await page.getByRole("button", { name: "Finish session" }).click();
  462 |     await expect(page.getByRole("dialog", { name: "Finish this session?" })).toBeVisible();
  463 |     await page.screenshot({ path: testInfo.outputPath(`finish-${viewport.width}.png`) });
  464 |     await page.keyboard.press("Escape");
  465 |     await expect(page.getByRole("dialog")).toHaveCount(0);
  466 |     await expect(page.getByRole("button", { name: "Finish session" })).toBeFocused();
  467 |     await page.getByRole("button", { name: "Finish session" }).click();
  468 |     await page.evaluate(() => history.back());
  469 |     await expect(page.getByRole("dialog")).toHaveCount(0);
  470 |     await expect(page).toHaveURL(/\/play\/session\/browser-training$/);
  471 |   }
  472 |   session.questions = questions;
  473 |   await page.setViewportSize(originalViewport);
  474 |   await page.reload();
  475 |   await expect(page.getByText("2 + 2 = ?", { exact: true })).toBeVisible();
  476 |   await page.getByRole("radio", { name: /4/ }).click();
  477 |   await page.getByRole("button", { name: "Sure", exact: true }).click();
  478 |   await page.getByRole("button", { name: /Answer & continue/ }).click();
  479 |   await expect(page.getByText("3 + 3 = ?", { exact: true })).toBeVisible();
  480 |
  481 |   await page.reload();
  482 |   await expect(page.getByText("3 + 3 = ?", { exact: true })).toBeVisible();
  483 |   await expect(page.getByText("2 + 2 equals 4.")).toHaveCount(0);
  484 |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  485 |
  486 |   await page.getByRole("button", { name: "Finish session" }).click();
  487 |   await page.getByRole("button", { name: "Finish & see results" }).click();
  488 |   await expect(page.getByRole("heading", { name: "Official Score Breakdown & Deductions" })).toBeVisible();
  489 |   await page.locator(".trade-review-shortcut").click();
  490 |   await page.locator(".trade-expand-all-btn").first().click();
  491 |   await expect(page.getByText("2 + 2 equals 4.")).toBeVisible();
  492 | });
  493 |
```