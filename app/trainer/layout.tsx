import { WorkspaceShell } from "@/app/components/workspace-shell";

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell workspace="/trainer" homeHref="/trainer">{children}</WorkspaceShell>;
}
