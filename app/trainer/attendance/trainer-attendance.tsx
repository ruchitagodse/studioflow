"use client";

import { useState } from "react";
import type { AttendanceRoster } from "@/lib/attendance";
import { AttendanceRosterActions } from "@/app/components/attendance-roster";
import { StudioAction,StudioIcon } from "@/app/components/studio-icon";
import { trainerDisplayDate } from "@/lib/trainer-display";
import styles from "../trainer-ui.module.css";

export function TrainerAttendance({rosters,emptyLabel}:{rosters:AttendanceRoster[];emptyLabel:string}) {
  const [open,setOpen]=useState<string|null>(rosters[0]?.slotId??null);
  if(!rosters.length)return <div className={styles.empty}><StudioIcon name="check"/><h3>No attendance to record</h3><p>{emptyLabel}</p></div>;
  return <div>{rosters.map(roster=><article key={roster.slotId} className={styles.attendanceCard}>
    <button type="button" className={styles.rosterToggle} aria-expanded={open===roster.slotId} aria-controls={`trainer-roster-${roster.slotId}`} onClick={()=>setOpen(open===roster.slotId?null:roster.slotId)}><span><strong>{roster.className}</strong><small><StudioAction icon="calendar">{trainerDisplayDate(roster.localDate)}</StudioAction><StudioAction icon="clock">{roster.startTime}–{roster.endTime}</StudioAction></small><small><StudioAction icon="users">{roster.entries.length} clients</StudioAction></small></span><span><span className={styles.badge} data-status={roster.window}><StudioAction icon={roster.window==="open"?"check":roster.window==="before"?"clock":"lock"}>{roster.window==="open"?"Open":roster.window==="before"?"Not open":"Locked"}</StudioAction></span><StudioIcon name={open===roster.slotId?"remove":"add"}/></span></button>
    {open===roster.slotId&&<div id={`trainer-roster-${roster.slotId}`} className={styles.rosterBody}><AttendanceRosterActions roster={{...roster,role:"trainer"}}/></div>}
  </article>)}</div>;
}
