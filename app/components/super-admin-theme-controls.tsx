"use client";

import { useState } from "react";
import { studioThemeAction } from "@/app/super-admin/actions";
import { studioThemes, themeIds, resolveTheme } from "@/lib/theme";
import styles from "./theme-controls.module.css";

type Studio = { id: string; name: string; theme: string; allowOwnerThemeCustomization: boolean };

export function SuperAdminThemeControls({ studios }: { studios: Studio[] }) {
  const [error, setError] = useState("");
  async function save(formData: FormData) { setError(""); const result = await studioThemeAction(formData); if (result.error) setError(result.error); }
  return <section className={styles.panel}><p className={styles.kicker}>THEME CONFIGURATION</p><h2>Studio appearance</h2><p className={styles.copy}>Choose a global appearance for each studio. The owner setting is enforced on the server.</p>{error && <p className={styles.error} role="alert">{error}</p>}{studios.map((studio) => { const current = resolveTheme(studio.theme); return <form action={save} className={styles.studio} key={studio.id}><input name="studioId" type="hidden" value={studio.id} /><div className={styles.studioHeading}><div><b>{studio.name}</b><span>Current theme: {studioThemes[current].name}</span></div><label><input name="allowOwnerThemeCustomization" type="checkbox" defaultChecked={studio.allowOwnerThemeCustomization} /> Owner customization</label></div><div className={styles.cards}>{themeIds.map((theme) => <label className={`${styles.card} ${theme === current ? styles.selected : ""}`} key={theme}><input name="theme" type="radio" value={theme} defaultChecked={theme === current} /><span className={`${styles.preview} ${styles[theme]}`} /><strong>{studioThemes[theme].name}</strong><small>{studioThemes[theme].description}</small></label>)}</div><button>Apply appearance</button></form>; })}</section>;
}
