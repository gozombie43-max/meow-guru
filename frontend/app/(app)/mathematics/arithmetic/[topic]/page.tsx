import { mathematicsStaticParams, type MathematicsPageProps } from "@/app/(app)/mathematics/_shared/route-page";
import { renderMathematicsTopicPage } from "@/app/(app)/mathematics/_shared/topic-route-page";

export function generateStaticParams() {
  return mathematicsStaticParams("arithmetic");
}

export default function Page(props: MathematicsPageProps) {
  return renderMathematicsTopicPage(props, "arithmetic");
}
