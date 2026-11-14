import { DashboardTemplate } from "@/design-system/layouts/DashboardTemplate";
import HomeClient from "./HomeClient";
import { DesktopHomeContent, MobileHomeContent } from "./HomeStaticContent";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <DashboardTemplate
      showNavRail={false}
      showBottomNav={false}
      maxWidth="100%"
      gridColumns={1}
      mainClassName={styles.homeDashboardMain}
    >
      <HomeClient
        desktopContent={<DesktopHomeContent />}
        mobileContent={<MobileHomeContent />}
      />
    </DashboardTemplate>
  );
}
