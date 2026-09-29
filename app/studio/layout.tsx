import { WorkspaceShell } from "@/app/components/workspace-shell";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell workspace="/studio" homeHref="/studio">{children}</WorkspaceShell>;
}
