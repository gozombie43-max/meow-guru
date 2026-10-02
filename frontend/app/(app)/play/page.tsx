import PlayClient from "./PlayClient";
import {
  PlayBrand,
  PlaySideNote,
  PlayHeading,
  PlayModeLibrary,
} from "./PlayStaticContent";
import "./play.css";
import "./play-hub.css";

// Render static copy/card bodies on the server and pass them through the client
// island as slots. URL state, auth-backed data and interactions stay in it.
export default function PlayPage() {
  return (
    <PlayClient
      brand={<PlayBrand />}
      sideNote={<PlaySideNote />}
      headings={Object.fromEntries(
        ["Play", "Train Me", "Mock", "Review", "Analytics"].map((tab) => [
          tab,
          <PlayHeading key={tab} tab={tab} />,
        ]),
      )}
      modeLibrary={<PlayModeLibrary />}
    />
  );
}
