import { notFound } from "next/navigation";
import QuizRouteShell from "@/components/quiz-engine/QuizRouteShell";
import { mathematicsTopicsForRoute, resolveMathematicsTopic, type MathematicsRouteGroup } from "@/lib/mathematics-topics";
import MathematicsQuizEngine from "./quiz-engine";
import MathematicsTopicPage from "./topic-page";

export type MathematicsPageProps = { params: Promise<{ topic: string }> };

export function mathematicsStaticParams(group: MathematicsRouteGroup) {
  return mathematicsTopicsForRoute(group).map((topic) => ({ topic }));
}

export async function renderMathematicsPage(
  { params }: MathematicsPageProps,
  group: MathematicsRouteGroup,
  view: "topic" | "quiz",
) {
  const { topic: slug } = await params;
  const topic = resolveMathematicsTopic(group, slug);
  if (!topic) notFound();
  const props = { title: topic.label, slug: topic.slug, routeBase: topic.route };
  return view === "quiz" ? (
    <QuizRouteShell><MathematicsQuizEngine {...props} /></QuizRouteShell>
  ) : <MathematicsTopicPage {...props} />;
}
