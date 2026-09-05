import SubjectTopicPage,{
type SubjectTopicPageProps,
} from "@/components/quiz-engine/SubjectTopicPage";

type ReasoningTopicPageProps = Omit<SubjectTopicPageProps, "subject">;

export default function ReasoningTopicPage(props: ReasoningTopicPageProps) {
  return <SubjectTopicPage subject="reasoning" {...props} />;
}
