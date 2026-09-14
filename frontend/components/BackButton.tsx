"use client";
import { ArrowLeft } from "lucide-react";
import { useAppNavigation } from "@/hooks/useAppNavigation";
export default function BackButton({ href, label = "Back", className }: { href: string; label?: string; className?: string }) {
  const navigation = useAppNavigation();
  return <button data-ui-button="icon" type="button" className={className} aria-label={label} title={label} onClick={() => navigation.back(href)}><ArrowLeft aria-hidden="true" /></button>;
}
