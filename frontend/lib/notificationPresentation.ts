import {
  Bell,
  CalendarDays,
  ClipboardList,
  Flame,
  Megaphone,
  Swords,
  Trophy,
} from "lucide-react";

export function getNotificationPresentation(
  type?: string,
  category?: string
) {
  switch (type) {
    case "battle_invite":
    case "battle_rematch":
      return {
        label: "Join Battle",
        Icon: Swords,
      };

    case "battle_result":
      return {
        label: "View Battle",
        Icon: Trophy,
      };

    case "daily_practice":
      return {
        label: "Start Practice",
        Icon: Flame,
      };

    case "streak_protection":
      return {
        label: "Continue Practice",
        Icon: Flame,
      };

    case "new_mock":
      return {
        label: "Open Mock",
        Icon: ClipboardList,
      };

    case "exam_update":
      return {
        label: "View Update",
        Icon: CalendarDays,
      };

    default:
      if (category === "announcements") {
        return {
          label: "Open",
          Icon: Megaphone,
        };
      }

      return {
        label: "View",
        Icon: Bell,
      };
  }
}

export function getSafeNotificationRoute(
  route?: string
) {
  if (
    !route ||
    typeof route !== "string"
  ) {
    return null;
  }

  const trimmed =
    route.trim();

  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//")
  ) {
    return null;
  }

  return trimmed;
}
