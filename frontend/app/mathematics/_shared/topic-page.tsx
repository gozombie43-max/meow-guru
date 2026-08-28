import SubjectTopicPage, {
  type SubjectTopicPageProps,
} from "@/components/quiz-engine/SubjectTopicPage";

type MathematicsTopicPageProps = Omit<SubjectTopicPageProps, "subject">;

export default function MathematicsTopicPage(props: MathematicsTopicPageProps) {
  return <SubjectTopicPage subject="mathematics" {...props} />;
}
