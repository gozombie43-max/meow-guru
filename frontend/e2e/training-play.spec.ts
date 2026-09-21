import { test, expect } from "@playwright/test";
import { modes } from "../components/training/training-types";

type BrowserQuestion = {
  id: string;
  text: string;
  options: string[];
  image: string;
  subject: string;
  topic: string;
  subtopic: string;
  difficulty: number;
  expectedTime: number;
  targetSource: string;
  sourceType: string;
  correctIndex?: number;
  solution?: string;
};

type BrowserAnswer = {
  choice: number | null;
  confidence: string | null;
  seconds: number;
};

const policy = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  navigation: "forward",
  confidence: true,
  sectional: false,
  requiresSubject: false,
  supportsFullSection: false,
  supportsTier: false,
  clock: "target",
  clockMultiplier: 1.2,
  minuteOptions: [],
  minDifficulty: 1,
  lives: null,
  ...overrides,
});

test("play exposes all modes and persists an adaptive session across reload", async ({
  page,
  context,
  request,
}, testInfo) => {
  const hostname = new URL(testInfo.project.use.baseURL || "http://127.0.0.1:3110").hostname;
  const login = await request.post("http://127.0.0.1:3111/auth/login", {
    data: {
      email: `browser-${testInfo.project.name}@example.test`,
      password: "Browser-fixture-123!",
    },
  });
  expect(login.ok()).toBeTruthy();
  const refreshCookie = login.headers()["set-cookie"].split(";")[0].slice("refreshToken=".length);
  await context.addCookies([
    {
      name: "refreshToken",
      value: refreshCookie,
      domain: hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "access_session",
      value: "training-browser-fixture",
      domain: hostname,
      path: "/",
    },
  ]);

  const now = Date.now();
  const questions = [
    {
      id: "q1",
      text: "2 + 2 = ?",
      options: ["3", "4", "5", "6"],
      image: "",
      subject: "Mathematics",
      topic: "Arithmetic",
      subtopic: "Addition",
      difficulty: 1,
      expectedTime: 30,
      targetSource: "baseline",
      sourceType: "bank",
    },
    {
      id: "q2",
      text: "3 + 3 = ?",
      options: ["5", "6", "7", "8"],
      image: "",
      subject: "Mathematics",
      topic: "Arithmetic",
      subtopic: "Addition",
      difficulty: 2,
      expectedTime: 30,
      targetSource: "baseline",
      sourceType: "bank",
    },
  ];
  let session: {
    id: string;
    mode: string;
    effectiveMode: string;
    policy: ReturnType<typeof policy>;
    allowedVisitIndices: number[];
    exam: string;
    status: string;
    completionReason: string | null;
    revision: number;
    current: number;
    duration: number;
    deadline: string;
    serverNow: number;
    lastEventAt: number;
    lives: number;
    marking: { correct: number; wrong: number };
    questions: BrowserQuestion[];
    answers: Record<string, BrowserAnswer>;
    result: unknown;
  } = {
    id: "browser-training",
    mode: "adaptive",
    effectiveMode: "adaptive",
    policy: policy("adaptive"),
    allowedVisitIndices: [],
    exam: "ssc-cgl",
    status: "active",
    completionReason: null,
    revision: 0,
    current: 0,
    duration: 600,
    deadline: new Date(now + 600000).toISOString(),
    serverNow: now,
    lastEventAt: now,
    lives: 999,
    marking: { correct: 1, wrong: 0.25 },
    questions,
    answers: {},
    result: null,
  };

  await context.route("**/backend-api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/backend-api", "");

    if (path === "/api/training/capabilities") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          exams: [{ id: "ssc-cgl", label: "SSC CGL" }],
          modes: {
            adaptive: policy("adaptive"),
            challenge: policy("challenge"),
            sprint: policy("sprint", { clock: "fixed", minuteOptions: [5, 10, 15] }),
            pressure: policy("pressure", { navigation: "free", clockMultiplier: 0.7 }),
            section: policy("section", { navigation: "free", sectional: true, requiresSubject: true, supportsFullSection: true, supportsTier: true }),
            gauntlet: policy("gauntlet", { sectional: true, requiresSubject: true, supportsFullSection: true, supportsTier: true }),
            nightmare: policy("nightmare", { confidence: false, minDifficulty: 3 }),
            survival: policy("survival", { confidence: false, lives: 3 }),
            review: policy("review"),
            mission: policy("mission"),
          },
        }),
      });
    }

    if (path === "/api/training/dashboard") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          readiness: null,
          evidenceConfidence: "low",
          confidenceScore: 10,
          attempts: 0,
          evidence: "Build your baseline.",
          factors: {},
          topics: [],
          reviews: [],
          due: [],
          subjects: ["Mathematics", "English"],
          catalogTopics: ["Arithmetic", "Algebra", "Grammar"],
          catalog: [
            { subject: "Mathematics", topic: "Arithmetic" },
            { subject: "Mathematics", topic: "Algebra" },
            { subject: "English", topic: "Grammar" },
          ],
          active: [],
          history: [],
          mission: [{ mode: "adaptive", count: 10, label: "Build your skill baseline" }],
          personalBest: 0,
        }),
      });
    }

    if (path === "/api/training/sessions" && route.request().method() === "POST") {
      session = { ...session, serverNow: Date.now(), lastEventAt: Date.now() };
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(session),
      });
    }

    if (path === "/api/training/sessions/browser-training" && route.request().method() === "GET") {
      session = { ...session, serverNow: Date.now() };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session),
      });
    }

    if (path === "/api/training/sessions/browser-training/actions") {
      const body = route.request().postDataJSON() as {
        type: string;
        choice?: number | null;
        confidence?: string | null;
      };
      if (body.type === "answer") {
        const q = questions[session.current];
        session = {
          ...session,
          revision: session.revision + 1,
          current: Math.min(session.current + 1, questions.length - 1),
          serverNow: Date.now(),
          lastEventAt: Date.now(),
          answers: {
            ...session.answers,
            [q.id]: {
              choice: body.choice ?? null,
              confidence: body.confidence ?? null,
              seconds: 8,
            },
          },
        };
      } else if (body.type === "finish") {
        session = {
          ...session,
          revision: session.revision + 1,
          status: "completed",
          completionReason: "submitted",
          serverNow: Date.now(),
          questions: questions.map((q, index) => ({
            ...q,
            correctIndex: 1,
            solution: index === 0 ? "2 + 2 equals 4." : "3 + 3 equals 6.",
          })),
          result: {
            rows: [
              {
                questionId: "q1",
                number: 1,
                topic: "Arithmetic",
                attempted: true,
                correct: true,
                choice: 1,
                correctIndex: 1,
                seconds: 8,
                target: 30,
                confidence: "sure",
                mistake: null,
                solution: "2 + 2 equals 4.",
                score: 1,
              },
              {
                questionId: "q2",
                number: 2,
                topic: "Arithmetic",
                attempted: false,
                correct: false,
                choice: null,
                correctIndex: 1,
                seconds: 0,
                target: 30,
                confidence: null,
                mistake: null,
                solution: "3 + 3 equals 6.",
                score: 0,
              },
            ],
            blockBreakdown: [],
            attempted: 1,
            correct: 1,
            accuracy: 100,
            score: 1,
            maxScore: 2,
            negativeLoss: 0,
            secondsSaved: 22,
            averageSeconds: 8,
            findings: [],
            failureMap: {},
            modePoints: 10,
            masteryDelta: [],
            bestStreak: 1,
            questionsPerMinute: 1,
          },
        };
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(session),
      });
    }

    const fixtureUrl = `http://127.0.0.1:3111${path}${url.search}`;
    const response = await route.fetch({ url: fixtureUrl });
    return route.fulfill({ response });
  });

  await page.goto("/play");
  await expect(page.getByRole("button", { name: /^Set up / })).toHaveCount(8);
  const setupViewport = page.viewportSize()!;
  if (testInfo.project.name === "mobile") await page.setViewportSize({ width: 320, height: 568 });
  for (const mode of modes) {
    await page.getByRole("button", { name: `Set up ${mode.title}`, exact: true }).click();
    const setup = page.getByRole("dialog");
    await expect(setup.getByRole("heading", { name: mode.title, exact: true })).toBeVisible();
    const startBounds = await setup.getByRole("button", { name: "Begin training" }).boundingBox();
    expect(startBounds!.y + startBounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    if (mode.id === "adaptive") await page.screenshot({ path: testInfo.outputPath("setup.png") });
    await page.getByRole("button", { name: "Close setup" }).click();
  }
  await page.setViewportSize(setupViewport);
  await page.getByRole("button", { name: "Set up Adaptive" }).click();
  await expect(page.getByRole("heading", { name: "Adaptive" })).toBeVisible();
  await page.getByRole("button", { name: "Begin training" }).click();

  await expect(page).toHaveURL(/\/play\/session\/browser-training$/);
  await expect(page.getByText("2 + 2 = ?", { exact: true })).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => localStorage.setItem("ui-theme", value), theme);
    for (const mode of modes) {
      const free = ["pressure", "section"].includes(mode.id);
      session = {
        ...session, mode: mode.id, effectiveMode: mode.id,
        policy: policy(mode.id, { navigation: free ? "free" : "forward", confidence: !["nightmare", "survival"].includes(mode.id) }),
        allowedVisitIndices: free ? [0, 1] : [], lives: mode.id === "survival" ? 3 : 999,
      };
      await page.reload();
      await expect(page.getByText("2 + 2 = ?", { exact: true })).toBeVisible();
      const footer = page.locator(".training-session-footer");
      const bounds = await footer.boundingBox();
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (page.viewportSize()!.width < 1024) {
        const toggle = page.getByRole("button", { name: free ? "Questions" : "Session info", exact: true });
        await toggle.click();
        await expect(page.locator("#training-overview")).toBeVisible();
        await toggle.click();
        await expect(page.locator("#training-overview")).toBeHidden();
      } else {
        await expect(page.locator("#training-overview")).toBeVisible();
      }
      await page.getByRole("radio", { name: /4/ }).click();
      await expect(page.getByText("Answer not saved yet", { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${mode.id}-${theme}.png`) });
    }
  }
  session = { ...session, mode: "adaptive", effectiveMode: "adaptive", policy: policy("adaptive"), allowedVisitIndices: [], lives: 999 };
  const originalViewport = page.viewportSize()!;
  for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 540 }]) {
    await page.setViewportSize(viewport);
    session.questions = [{ ...questions[0], text: Array(12).fill("Read the statement carefully before selecting the correct answer.").join("\n\n") }, questions[1]];
    await page.reload();
    await expect(page.getByRole("button", { name: "Answer & continue" })).toBeVisible();
    await page.locator(".training-session-main").evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(page.getByRole("radio", { name: /4/ })).toBeInViewport();
    const footer = await page.locator(".training-session-footer").boundingBox();
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Finish session" }).click();
    await expect(page.getByRole("dialog", { name: "Finish this session?" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`finish-${viewport.width}.png`) });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Finish session" })).toBeFocused();
    await page.getByRole("button", { name: "Finish session" }).click();
    await page.evaluate(() => history.back());
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/play\/session\/browser-training$/);
  }
  session.questions = questions;
  await page.setViewportSize(originalViewport);
  await page.reload();
  await expect(page.getByText("2 + 2 = ?", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: /4/ }).click();
  await page.getByRole("button", { name: "Sure", exact: true }).click();
  await page.getByRole("button", { name: /Answer & continue/ }).click();
  await expect(page.getByText("3 + 3 = ?", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("3 + 3 = ?", { exact: true })).toBeVisible();
  await expect(page.getByText("2 + 2 equals 4.")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Finish session" }).click();
  await page.getByRole("button", { name: "Finish & see results" }).click();
  await expect(page.getByRole("heading", { name: "Every session is evidence." })).toBeVisible();
  await page.locator("summary").first().click();
  await expect(page.getByText("2 + 2 equals 4.")).toBeVisible();
});
