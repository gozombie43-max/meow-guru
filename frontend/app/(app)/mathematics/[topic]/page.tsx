import { mathematicsStaticParams, type MathematicsPageProps } from "@/app/(app)/mathematics/_shared/route-page";
import { renderMathematicsTopicPage } from "@/app/(app)/mathematics/_shared/topic-route-page";

export function generateStaticParams() {
  return mathematicsStaticParams("top-level");
}

export default function Page(props: MathematicsPageProps) {
  return renderMathematicsTopicPage(props, "top-level");
}
