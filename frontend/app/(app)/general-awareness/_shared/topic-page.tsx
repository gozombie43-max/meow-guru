import SubjectTopicPage, {
  type SubjectTopicPageProps,
} from "@/features/quiz/components/SubjectTopicPage";
import { ConfigurationTemplate } from "@/design-system";

type GeneralAwarenessTopicPageProps = Omit<SubjectTopicPageProps, "subject">;

export default function GeneralAwarenessTopicPage(props: GeneralAwarenessTopicPageProps) {
  return (
    <ConfigurationTemplate
      variant="setup"
      header={null}
      showNavRail={false}
      showBottomNav={false}
      maxWidth="100%"
    >
      <SubjectTopicPage subject="general-awareness" {...props} />
    </ConfigurationTemplate>
  );
}
