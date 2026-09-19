import SubjectTopicPage,{
type SubjectTopicPageProps,
} from "@/features/quiz/components/SubjectTopicPage";

type GeneralAwarenessTopicPageProps = Omit<SubjectTopicPageProps, "subject">;

export default function GeneralAwarenessTopicPage(props: GeneralAwarenessTopicPageProps) {
  return <SubjectTopicPage subject="general-awareness" {...props} />;
}
