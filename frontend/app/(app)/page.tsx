import HomeClient from "./HomeClient";
import { DesktopHomeContent,MobileHomeContent } from "./HomeStaticContent";

export default function HomePage() {
  return (
    <HomeClient
      desktopContent={<DesktopHomeContent />}
      mobileContent={<MobileHomeContent />}
    />
  );
}
