"use client";

import type { CSSProperties } from "react";
import { StudioIcon, type StudioIconName } from "./studio-icon";
import styles from "./studio-status-strip.module.css";

type StatusChoice = {value:string;label:string;count:number;icon:StudioIconName;tone:"primary"|"success"|"warning"|"muted"|"danger"};
export function StudioStatusStrip({label,items,value,onChange}:{label:string;items:StatusChoice[];value:string;onChange:(value:string)=>void}) {
  return <div className={styles.strip} role="group" aria-label={label} style={{"--status-columns":items.length} as CSSProperties}>{items.map(item=><button type="button" key={item.value} className={styles.choice} data-tone={item.tone} aria-pressed={value===item.value} onClick={()=>onChange(item.value)}><span className={styles.icon}><StudioIcon name={item.icon}/></span><strong>{item.count}</strong><span className={styles.label}>{item.label}</span></button>)}</div>;
}
