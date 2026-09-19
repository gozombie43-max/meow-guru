import SubjectTopicPage,{
type SubjectTopicPageProps,
} from "@/features/quiz/components/SubjectTopicPage";

type EnglishTopicPageProps = Omit<SubjectTopicPageProps, "subject">;

export default function EnglishTopicPage(props: EnglishTopicPageProps) {
  return <SubjectTopicPage subject="english" {...props} />;
}
