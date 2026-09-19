import SubjectTopicPage,{
type SubjectTopicPageProps,
} from "@/features/quiz/components/SubjectTopicPage";

type ReasoningTopicPageProps = Omit<SubjectTopicPageProps, "subject">;

export default function ReasoningTopicPage(props: ReasoningTopicPageProps) {
  return <SubjectTopicPage subject="reasoning" {...props} />;
}
