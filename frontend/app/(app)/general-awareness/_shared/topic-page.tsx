import SubjectTopicPage,{
type SubjectTopicPageProps,
} from "@/components/quiz-engine/SubjectTopicPage";

type GeneralAwarenessTopicPageProps = Omit<SubjectTopicPageProps, "subject">;

export default function GeneralAwarenessTopicPage(props: GeneralAwarenessTopicPageProps) {
  return <SubjectTopicPage subject="general-awareness" {...props} />;
}
