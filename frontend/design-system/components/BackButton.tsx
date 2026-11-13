"use client";

import { ArrowLeft } from "lucide-react";
import { useAppNavigation } from "@/hooks/useAppNavigation";
import { Button } from "./Button";
import styles from "./BackButton.module.css";

export interface BackButtonProps {
  /** Fallback route passed to `useAppNavigation().back(href)` when history cannot go back. */
  href: string;
  label?: string;
  className?: string;
  onBeforeNavigate?: () => void;
}

function joinClasses(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(" ");
}

/** Canonical 44px icon back navigation button backed by `useAppNavigation`. */
export function BackButton({
  href,
  label = "Back",
  className,
  onBeforeNavigate,
}: BackButtonProps) {
  const navigation = useAppNavigation();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={joinClasses(styles.backButton, className)}
      aria-label={label}
      title={label}
      data-meow-component="back-button"
      onClick={() => {
        onBeforeNavigate?.();
        navigation.back(href);
      }}
    >
      <ArrowLeft className={styles.icon} aria-hidden="true" />
    </Button>
  );
}

export default BackButton;
