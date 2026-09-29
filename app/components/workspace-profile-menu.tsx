"use client";

import { useEffect, useRef } from "react";
import { LogoutButton } from "./logout-button";
import styles from "./workspace-shell.module.css";

type WorkspaceLink = { href: string; label: string };
type WorkspaceProfileMenuProps = { name: string; role: string; studioName: string; customerProfile?: boolean; workspaceLinks?: WorkspaceLink[] };

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "S";
}

export function WorkspaceProfileMenu({ name, role, studioName, customerProfile = false, workspaceLinks = [] }: WorkspaceProfileMenuProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeFromOutside(event: PointerEvent) {
      if (menuRef.current?.open && !menuRef.current.contains(event.target as Node)) menuRef.current.open = false;
    }
    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) menuRef.current.open = false;
    }
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => { document.removeEventListener("pointerdown", closeFromOutside); document.removeEventListener("keydown", closeFromKeyboard); };
  }, []);

  return <details ref={menuRef} className={styles.profile} id={customerProfile ? "customer-profile" : "trainer-profile"}>
    <summary className={styles.identity} aria-label={`Open profile menu. Signed in as ${name}, ${role}, ${studioName}`}>
      <span className={styles.avatar} aria-hidden="true">{initials(name)}</span>
      <span className={styles.identityText}><strong>{name}</strong><span><em>{role}</em><small>{studioName}</small></span></span>
    </summary>
    <div className={styles.profileMenu}>
      <div className={styles.menuIdentity}>
        <span className={styles.menuAvatar} aria-hidden="true">{initials(name)}</span>
        <span><strong>{name}</strong><small>{role} · {studioName}</small></span>
      </div>
      <div className={styles.menuDivider} />
      {workspaceLinks.map((link) => <a key={link.href} className={styles.workspaceSwitch} href={link.href}>{link.label}<span aria-hidden="true">→</span></a>)}
      <LogoutButton className={styles.logout} withIcon />
    </div>
  </details>;
}
