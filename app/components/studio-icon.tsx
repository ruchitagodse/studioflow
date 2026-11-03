import type { ReactNode } from "react";
import styles from "./studio-icon.module.css";

const paths = {
  sound: <><path d="M4 9h4l5-4v14l-5-4H4zM17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14"/></>,
  soundOff: <><path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6"/></>,
  chevronDown: <path d="m6 9 6 6 6-6"/>,
  home: <><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 11h18"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>,
  membership: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/></>,
  credits: <><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 4 14 4 14 0V6M5 12v6c0 4 14 4 14 0v-6"/></>,
  pause: <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M9 8v8M15 8v8"/></>,
  search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
  add: <path d="M12 4v16M4 12h16"/>,
  edit: <><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z"/></>,
  save: <><path d="M4 3h13l4 4v14H3V3zM7 3v6h10V3M7 21v-8h10v8"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  back: <path d="M20 12H4m7-7-7 7 7 7"/>,
  arrow: <path d="M4 12h16m-7-7 7 7-7 7"/>,
  history: <><path d="M3 4v5h5M3 9a9 9 0 1 1 0 6M12 7v5l3 2"/></>,
  alert: <><path d="m12 3 10 18H2zM12 8v5M12 17h.01"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  shield: <><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6z"/><path d="m8 12 3 3 5-6"/></>,
  filter: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  link: <><path d="m10 14 4-4M9 16l-2 2a3.5 3.5 0 0 1-5-5l5-5a3.5 3.5 0 0 1 5 0M15 8l2-2a3.5 3.5 0 0 1 5 5l-5 5a3.5 3.5 0 0 1-5 0"/></>,
  copy: <><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,
  remove: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="m3 3 18 18M10 5h2c6 0 10 7 10 7s-1 2-3 4M6 6a22 22 0 0 0-4 6s4 7 10 7c2 0 3-.5 4-1M10 10l4 4"/></>,
  settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18h2c2 0 0-4 2-4h2c5 0 4-14-6-14Z"/><path d="M7 10h.01M10 6h.01M15 7h.01M18 11h.01"/></>,
};
export type StudioIconName = keyof typeof paths;

/** Decorative icon paired with visible text or a separately labelled control. */
export function StudioIcon({ name }: { name: StudioIconName }) {
  return <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

export function StudioAction({ icon, children }: { icon: StudioIconName; children: ReactNode }) {
  return <span className={styles.action}><StudioIcon name={icon}/><span>{children}</span></span>;
}
