"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StudioIcon } from "./studio-icon";
import styles from "./trainer-mobile-nav.module.css";

export function TrainerMobileNav() {
  const pathname=usePathname();
  const items=[{href:"/trainer",label:"Home",icon:"home"},{href:"/trainer/classes",label:"Classes",icon:"calendar"},{href:"/trainer/attendance",label:"Attendance",icon:"check"},{href:"/trainer/profile",label:"Profile",icon:"user"}] as const;
  return <nav className={styles.nav} aria-label="Trainer navigation">{items.map(item=>{const active=item.href==="/trainer"?pathname===item.href:pathname.startsWith(item.href)||(item.href==="/trainer/attendance"&&pathname.startsWith("/trainer/slots/"));return <Link prefetch={false} key={item.href} href={item.href} aria-current={active?"page":undefined}><StudioIcon name={item.icon}/><span>{item.label}</span></Link>;})}</nav>;
}
