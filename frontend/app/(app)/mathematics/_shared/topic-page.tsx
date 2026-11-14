import SubjectTopicPage, {
  type SubjectTopicPageProps,
} from "@/features/quiz/components/SubjectTopicPage";
import { ConfigurationTemplate } from "@/design-system";

type MathematicsTopicPageProps = Omit<SubjectTopicPageProps, "subject">;

export default function MathematicsTopicPage(props: MathematicsTopicPageProps) {
  return (
    <ConfigurationTemplate
      variant="setup"
      header={null}
      showNavRail={false}
      showBottomNav={false}
      maxWidth="100%"
    >
      <SubjectTopicPage subject="mathematics" {...props} />
    </ConfigurationTemplate>
  );
}
