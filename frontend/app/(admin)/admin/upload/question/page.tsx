import QuestionUploadForm from "@/components/admin/QuestionUploadForm";
import { ConfigurationTemplate } from "@/design-system";

export default function QuestionUploadPage() {
  return (
    <ConfigurationTemplate
      variant="setup"
      showNavRail={false}
      showBottomNav={false}
      showSkipLink={false}
    >
      <QuestionUploadForm />
    </ConfigurationTemplate>
  );
}
