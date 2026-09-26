import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import type { createNavigationController } from "../lib/navigation-controller";

declare global {
  interface Window {
    nav: ReturnType<typeof createNavigationController>;
    NavigationFixture: { createNavigationController: typeof createNavigationController };
    removeGuard: () => void;
    removeLayer: () => void;
    closedPanels: string[];
  }
}

let bundle: string;
test.beforeAll(async ({ browserName }, testInfo) => {
  // Use TypeScript 7's supported CLI; it has no stable transpileModule API.
  // Playwright owns the output directory and cleans it between runs.
  const outputDirectory = testInfo.outputPath(`navigation-fixture-${browserName}`);
  await mkdir(outputDirectory, { recursive: true });
  const require = createRequire(path.resolve("package.json"));
  const compiler = path.join(path.dirname(require.resolve("typescript/package.json")), "bin", "tsc");
  await promisify(execFile)(process.execPath, [
    compiler, "--ignoreConfig", "--target", "ES2022", "--module", "commonjs",
    "--noCheck", "--outDir", outputDirectory, path.resolve("lib/navigation-controller.ts"),
  ], { windowsHide: true, timeout: 30000 });
  const outputText = await readFile(path.join(outputDirectory, "navigation-controller.js"), "utf8");
  bundle = `var exports = {}; ${outputText}; window.NavigationFixture = exports;`;
});
test.beforeEach(async ({ page }) => {
  await page.route("http://navigation.test/**", route => route.fulfill({ contentType: "text/html", body: '<button id="focus">Quiz</button><a href="/topics" id="parent">Back to topics</a>' }));
  await page.goto("http://navigation.test/home");
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    history.pushState({ nextState: "preserved" }, "", "/quiz");
    window.nav = window.NavigationFixture.createNavigationController(window);
    window.closedPanels = [];
    window.removeGuard = window.nav.addGuard("Leave this quiz?", "/topics");
    document.querySelector("a")!.addEventListener("click", event => {
      event.preventDefault();
      history.replaceState({}, "", "/topics");
    });
  });
});

/** Wait for the custom exit-confirmation modal state to appear. */
const awaitConfirmation = (page: import("@playwright/test").Page) =>
  expect.poll(() => page.evaluate(() => window.nav.getConfirmation() !== null)).toBe(true);

/** Dismiss the custom confirmation (equivalent to old dialog.dismiss). */
const dismissConfirmation = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.nav.resolveConfirmation(false));

/** Accept the custom confirmation (equivalent to old dialog.accept). */
const acceptConfirmation = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.nav.resolveConfirmation(true));

test("Back closes the top panel before warning; cancelling does not grow history", async ({ page }) => {
  const length = await page.evaluate(() => {
    window.nav.addLayer(() => window.closedPanels.push("solution"));
    window.nav.addLayer(() => window.closedPanels.push("tutor"));
    return history.length;
  });
  await page.evaluate(() => history.back());
  await expect.poll(() => page.evaluate(() => window.closedPanels)).toEqual(["tutor"]);
  await expect(page).toHaveURL(/\/quiz$/);
  await page.evaluate(() => history.back());
  await expect.poll(() => page.evaluate(() => window.closedPanels)).toEqual(["tutor", "solution"]);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => history.back());
    await awaitConfirmation(page);
    await dismissConfirmation(page);
    await expect.poll(() => page.evaluate(() => Boolean(history.state?.__meowNavigation))).toBe(true);
    expect(await page.evaluate(() => history.length)).toBe(length);
  }
  await page.evaluate(() => history.back());
  await awaitConfirmation(page);
  await acceptConfirmation(page);
  await expect(page).toHaveURL(/\/home$/);
});

test("repeated open/close preserves router state and one temporary entry", async ({ page }) => {
  const length = await page.evaluate(() => history.length);
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => { window.removeLayer = window.nav.addLayer(() => window.closedPanels.push("tutor")); });
    await page.evaluate(() => window.removeLayer());
    expect(await page.evaluate(() => history.length)).toBe(length);
  }
  expect(await page.evaluate(() => history.state.nextState)).toBe("preserved");
  await page.evaluate(() => window.nav.back(() => history.replaceState({}, "", "/topics")));
  await awaitConfirmation(page);
  await acceptConfirmation(page);
  await expect(page).toHaveURL(/\/topics$/);
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/home$/);
});

test("parent links warn once and remove temporary history on acceptance", async ({ page }) => {
  await page.locator("#parent").click();
  await awaitConfirmation(page);
  await dismissConfirmation(page);
  await expect(page).toHaveURL(/\/quiz$/);
  await page.locator("#parent").click();
  await awaitConfirmation(page);
  await acceptConfirmation(page);
  await expect(page).toHaveURL(/\/topics$/);
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/home$/);
});

test("completion removes the warning and temporary history", async ({ page }) => {
  expect(await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);
  await page.evaluate(() => window.removeGuard());
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.__meowNavigation))).toBe(false);
  expect(await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(false);
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/home$/);
});

test("Escape closes only the top panel", async ({ page }) => {
  await page.evaluate(() => {
    window.nav.addLayer(() => window.closedPanels.push("solution"));
    window.nav.addLayer(() => window.closedPanels.push("tutor"));
  });
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window.closedPanels)).toEqual(["tutor"]);
  await expect(page).toHaveURL(/\/quiz$/);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window.closedPanels)).toEqual(["tutor", "solution"]);
});

test("effect cleanup and immediate remount do not duplicate history", async ({ page }) => {
  const length = await page.evaluate(() => history.length);
  await page.evaluate(() => {
    window.removeGuard();
    window.removeGuard = window.nav.addGuard("Leave this quiz?", "/topics");
  });
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.evaluate(() => history.back());
  await awaitConfirmation(page);
  await acceptConfirmation(page);
  await expect(page).toHaveURL(/\/home$/);
});

test("a standalone panel closes with Back without trapping the route", async ({ page }) => {
  await page.evaluate(() => window.removeGuard());
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.__meowNavigation))).toBe(false);
  await page.evaluate(() => window.nav.addLayer(() => window.closedPanels.push("tutor")));
  await page.evaluate(() => history.back());
  await expect.poll(() => page.evaluate(() => window.closedPanels)).toEqual(["tutor"]);
  await expect(page).toHaveURL(/\/quiz$/);
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/home$/);
});

test("restoring a controller after reload reuses the existing history marker", async ({ page }) => {
  const length = await page.evaluate(() => history.length);
  await page.evaluate(() => {
    window.nav.dispose();
    window.nav = window.NavigationFixture.createNavigationController(window);
    window.removeGuard = window.nav.addGuard("Leave this quiz?", "/topics");
  });
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.evaluate(() => history.back());
  await awaitConfirmation(page);
  await acceptConfirmation(page);
  await expect(page).toHaveURL(/\/home$/);
});
