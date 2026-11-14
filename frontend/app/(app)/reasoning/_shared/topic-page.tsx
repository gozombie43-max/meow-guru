import SubjectTopicPage, {
  type SubjectTopicPageProps,
} from "@/features/quiz/components/SubjectTopicPage";
import { ConfigurationTemplate } from "@/design-system";

type ReasoningTopicPageProps = Omit<SubjectTopicPageProps, "subject">;

export default function ReasoningTopicPage(props: ReasoningTopicPageProps) {
  return (
    <ConfigurationTemplate
      variant="setup"
      header={null}
      showNavRail={false}
      showBottomNav={false}
      maxWidth="100%"
    >
      <SubjectTopicPage subject="reasoning" {...props} />
    </ConfigurationTemplate>
  );
}
