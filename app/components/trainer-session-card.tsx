import Link from "next/link";
import type { TrainerSlot } from "@/lib/trainer-schedule-logic";
import { trainerDisplayDate,trainerSessionLabel } from "@/lib/trainer-display";
import { StudioAction } from "./studio-icon";
import styles from "@/app/trainer/trainer-ui.module.css";

export function TrainerSessionCard({slot,now,featured=false}:{slot:TrainerSlot;now:Date;featured?:boolean}) {
  const {status,label}=trainerSessionLabel(slot,now);
  return <article className={`${styles.session} ${featured?styles.featured:""}`}>
    <div className={styles.sessionTop}><span className={styles.sessionDate}><StudioAction icon="calendar">{trainerDisplayDate(slot.localDate)}</StudioAction></span><span className={styles.badge} data-status={status}><StudioAction icon={status==="in-progress"?"check":status==="draft"?"edit":status==="completed"?"lock":"clock"}>{label}</StudioAction></span></div>
    <h3>{slot.className}</h3><p className={styles.sessionTime}><StudioAction icon="clock">{slot.startTime} – {slot.endTime}</StudioAction></p>
    <footer><span className={styles.booked}><StudioAction icon="users">{slot.rosterBookingCount} / {slot.capacity} booked</StudioAction></span>{slot.status!=="draft"?<Link prefetch={false} className={featured?styles.primary:styles.textLink} href={`/trainer/slots/${slot.id}`}><StudioAction icon="users">View roster</StudioAction><span aria-hidden="true">→</span></Link>:<span className={styles.muted}>Roster opens when published</span>}</footer>
  </article>;
}
