import ApplicationProviders from "@/app/providers";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ApplicationProviders><div id="main-content" tabIndex={-1}>{children}</div></ApplicationProviders>;
}
