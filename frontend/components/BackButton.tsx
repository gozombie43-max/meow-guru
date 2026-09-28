"use client";
import { ArrowLeft } from "lucide-react";
import { useAppNavigation } from "@/hooks/useAppNavigation";
export default function BackButton({ href, label = "Back", className, onBeforeNavigate }: { href: string; label?: string; className?: string; onBeforeNavigate?: () => void }) {
  const navigation = useAppNavigation();
  return <button data-ui-button="icon" type="button" className={className} aria-label={label} title={label} onClick={() => { onBeforeNavigate?.(); navigation.back(href); }}><ArrowLeft aria-hidden="true" /></button>;
}
