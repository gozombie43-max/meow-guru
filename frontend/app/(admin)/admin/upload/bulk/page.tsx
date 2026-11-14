import BulkTopicImportManager from "@/features/admin/bulk-import/BulkTopicImportManager";
import { ConfigurationTemplate } from "@/design-system";

export default function BulkUploadPage() {
  return (
    <ConfigurationTemplate
      variant="setup"
      showNavRail={false}
      showBottomNav={false}
      showSkipLink={false}
    >
      <BulkTopicImportManager />
    </ConfigurationTemplate>
  );
}
