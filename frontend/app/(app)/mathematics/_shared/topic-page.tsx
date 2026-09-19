import SubjectTopicPage,{
type SubjectTopicPageProps,
} from "@/features/quiz/components/SubjectTopicPage";

type MathematicsTopicPageProps = Omit<SubjectTopicPageProps, "subject">;

export default function MathematicsTopicPage(props: MathematicsTopicPageProps) {
  return <SubjectTopicPage subject="mathematics" {...props} />;
}
