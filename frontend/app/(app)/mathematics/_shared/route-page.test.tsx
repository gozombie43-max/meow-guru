import { describe, expect, it, vi } from "vitest";
import { MATHEMATICS_TOPICS } from "@/lib/mathematics-topics";
import * as arithmeticQuiz from "../arithmetic/[topic]/quiz/page";
import * as advanceQuiz from "../advance/[topic]/quiz/page";
import * as topLevelQuiz from "../[topic]/quiz/page";
import * as arithmeticTopic from "../arithmetic/[topic]/page";
import * as advanceTopic from "../advance/[topic]/page";
import * as topLevelTopic from "../[topic]/page";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); } }));
vi.mock("./quiz-engine", () => ({ default: () => null }));
vi.mock("./topic-page", () => ({ default: () => null }));

const routes = {
  arithmetic: { quiz: arithmeticQuiz, topic: arithmeticTopic },
  advance: { quiz: advanceQuiz, topic: advanceTopic },
  "top-level": { quiz: topLevelQuiz, topic: topLevelTopic },
};

describe("mathematics page entrypoints", () => {
  for (const topic of Object.values(MATHEMATICS_TOPICS)) {
    for (const path of [topic.route, ...topic.aliases]) {
      it(`renders both ${path} and ${path}/quiz`, async () => {
        const group = path.split("/").length === 3 ? "top-level" : path.split("/")[2] as "advance" | "arithmetic";
        for (const view of ["topic", "quiz"] as const) {
          const route = routes[group][view];
          expect(route.generateStaticParams()).toContainEqual({ topic: topic.slug });
          const page = await route.default({ params: Promise.resolve({ topic: topic.slug }) });
          const content = view === "quiz" ? page.props.children : page;
          expect(content.props).toMatchObject({ title: topic.label, slug: topic.slug, routeBase: topic.route });
        }
      });
    }
  }

  it("rejects unknown topics and topics in the wrong group", async () => {
    for (const topic of ["missing-topic", "algebra", "constructor", "__proto__"]) {
      await expect(arithmeticQuiz.default({ params: Promise.resolve({ topic }) })).rejects.toThrow("404");
    }
  });
});
