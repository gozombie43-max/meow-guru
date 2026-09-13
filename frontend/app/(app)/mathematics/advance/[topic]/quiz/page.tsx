import { mathematicsStaticParams, renderMathematicsPage, type MathematicsPageProps } from "@/app/(app)/mathematics/_shared/route-page";

export function generateStaticParams() {
  return mathematicsStaticParams("advance");
}

export default function Page(props: MathematicsPageProps) {
  return renderMathematicsPage(props, "advance", "quiz");
}
