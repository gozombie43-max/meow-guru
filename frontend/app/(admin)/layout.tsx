import AdminShell from "./AdminShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell>{children}</AdminShell>
  );
}
