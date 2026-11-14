import SubjectTopicPage, {
  type SubjectTopicPageProps,
} from "@/features/quiz/components/SubjectTopicPage";
import { ConfigurationTemplate } from "@/design-system";

type EnglishTopicPageProps = Omit<SubjectTopicPageProps, "subject">;

export default function EnglishTopicPage(props: EnglishTopicPageProps) {
  return (
    <ConfigurationTemplate
      variant="setup"
      header={null}
      showNavRail={false}
      showBottomNav={false}
      maxWidth="100%"
    >
      <SubjectTopicPage subject="english" {...props} />
    </ConfigurationTemplate>
  );
}
