import { cookies } from "next/headers";
import { DashboardTemplate } from "@/design-system/layouts/DashboardTemplate";
import HomeClient from "./HomeClient";
import { DesktopHomeContent, MobileHomeContent } from "./HomeStaticContent";
import styles from "./page.module.css";

export default async function HomePage() {
  // The HttpOnly refresh cookie reaches this origin through the /backend-api proxy.
  // Without it the visitor cannot have a session, so the intro can render immediately
  // instead of flashing the signed-in home page while the session check runs.
  const mayHaveSession = (await cookies()).has("refreshToken");

  return (
    <DashboardTemplate
      showNavRail={false}
      showBottomNav={false}
      maxWidth="100%"
      gridColumns={1}
      mainClassName={styles.homeDashboardMain}
    >
      <HomeClient
        mayHaveSession={mayHaveSession}
        desktopContent={<DesktopHomeContent />}
        mobileContent={<MobileHomeContent />}
      />
    </DashboardTemplate>
  );
}
