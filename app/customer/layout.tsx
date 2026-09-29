import { WorkspaceShell } from "@/app/components/workspace-shell";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell workspace="/customer" homeHref="/customer">{children}</WorkspaceShell>;
}
