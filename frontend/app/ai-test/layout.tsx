import ApplicationProviders from "@/app/providers";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ApplicationProviders>{children}</ApplicationProviders>;
}
