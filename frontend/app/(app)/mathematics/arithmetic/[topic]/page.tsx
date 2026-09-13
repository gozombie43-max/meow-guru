import { mathematicsStaticParams, renderMathematicsPage, type MathematicsPageProps } from "@/app/(app)/mathematics/_shared/route-page";

export function generateStaticParams() {
  return mathematicsStaticParams("arithmetic");
}

export default function Page(props: MathematicsPageProps) {
  return renderMathematicsPage(props, "arithmetic", "topic");
}
