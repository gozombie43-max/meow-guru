import { mathematicsStaticParams, type MathematicsPageProps } from "@/app/(app)/mathematics/_shared/route-page";
import { renderMathematicsQuizPage } from "@/app/(app)/mathematics/_shared/quiz-route-page";

export function generateStaticParams() {
  return mathematicsStaticParams("arithmetic");
}

export default function Page(props: MathematicsPageProps) {
  return renderMathematicsQuizPage(props, "arithmetic");
}
