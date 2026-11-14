import MockTestManager from "@/components/admin/MockTestManager";
import { ConfigurationTemplate } from "@/design-system";

export default function MockTestsPage() {
  return (
    <ConfigurationTemplate
      variant="setup"
      showNavRail={false}
      showBottomNav={false}
      showSkipLink={false}
    >
      <MockTestManager />
    </ConfigurationTemplate>
  );
}
