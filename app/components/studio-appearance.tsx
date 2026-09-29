"use client";

import { useState } from "react";
import { ownerThemeAction } from "@/app/studio/theme-actions";
import { studioThemes, themeIds, resolveTheme } from "@/lib/theme";
import styles from "./theme-controls.module.css";

export function StudioAppearance({ theme }: { theme: string }) { const [error, setError] = useState(""); const current = resolveTheme(theme); async function save(formData: FormData) { setError(""); const result = await ownerThemeAction(formData); if (result.error) setError(result.error); } return <section className={styles.panel}><p className={styles.kicker}>APPEARANCE</p><h2>Your studio theme</h2><p className={styles.copy}>This change applies to your entire studio, including customer mobile screens.</p>{error && <p className={styles.error} role="alert">{error}</p>}<form action={save} className={styles.studio}><div className={styles.cards}>{themeIds.map((item) => <label className={`${styles.card} ${item === current ? styles.selected : ""}`} key={item}><input name="theme" type="radio" value={item} defaultChecked={item === current} /><span className={`${styles.preview} ${styles[item]}`} /><strong>{studioThemes[item].name}</strong><small>{studioThemes[item].description}</small></label>)}</div><button>Save appearance</button></form></section>; }
