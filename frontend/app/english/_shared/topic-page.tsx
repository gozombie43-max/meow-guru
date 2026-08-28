import SubjectTopicPage, {
  type SubjectTopicPageProps,
} from "@/components/quiz-engine/SubjectTopicPage";

type EnglishTopicPageProps = Omit<SubjectTopicPageProps, "subject">;

export default function EnglishTopicPage(props: EnglishTopicPageProps) {
  return <SubjectTopicPage subject="english" {...props} />;
}
