import AdminShell from "./AdminShell";
import ApplicationProviders from "@/app/providers";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ApplicationProviders><AdminShell>{children}</AdminShell></ApplicationProviders>
  );
}
