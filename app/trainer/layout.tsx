import { WorkspaceShell } from "@/app/components/workspace-shell";
import { TrainerMobileNav } from "@/app/components/trainer-mobile-nav";
import styles from "./trainer-ui.module.css";

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell workspace="/trainer" homeHref="/trainer"><div className={styles.layout}><TrainerMobileNav/>{children}</div></WorkspaceShell>;
}
