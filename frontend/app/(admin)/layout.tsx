import { AuthProvider } from "@/context/AuthContext";
import AdminShell from "./AdminShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
