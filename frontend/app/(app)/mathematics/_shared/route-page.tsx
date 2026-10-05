import { notFound } from "next/navigation";
import { mathematicsTopicsForRoute, resolveMathematicsTopic, type MathematicsRouteGroup } from "@/lib/mathematics-topics";

export type MathematicsPageProps = { params: Promise<{ topic: string }> };

export function mathematicsStaticParams(group: MathematicsRouteGroup) {
  return mathematicsTopicsForRoute(group).map((topic) => ({ topic }));
}

export async function resolveMathematicsPageProps(
  { params }: MathematicsPageProps,
  group: MathematicsRouteGroup,
) {
  const { topic: slug } = await params;
  const topic = resolveMathematicsTopic(group, slug);
  if (!topic) notFound();
  return { title: topic.label, slug: topic.slug, routeBase: topic.route };
}
