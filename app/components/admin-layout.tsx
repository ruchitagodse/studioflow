import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";
import styles from "./workspace-shell.module.css";
import mobile from "./studio-mobile-nav.module.css";

type AdminLayoutProps = {
  children: React.ReactNode;
  name: string;
  role: string;
  studioName: string;
  roles: ("owner" | "staff")[];
  workspaceLinks: { href: string; label: string }[];
};

/** Shared desktop studio shell. Individual route pages remain responsible for authorization. */
export function AdminLayout({ children, ...sidebarProps }: AdminLayoutProps) {
  return <div className={styles.adminShell}><AdminSidebar {...sidebarProps} /><div className={`${styles.adminContent} ${mobile.content}`}><AdminHeader {...sidebarProps} />{children}</div></div>;
}
