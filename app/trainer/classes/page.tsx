import { readDocument } from "@/lib/firebase/reads";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/server";
import { getAssignedTrainerSlots } from "@/lib/trainer-schedule";
import { trainerDateKey,trainerDisplayDate } from "@/lib/trainer-display";
import { TrainerSessionCard } from "@/app/components/trainer-session-card";
import { StudioAction,StudioIcon } from "@/app/components/studio-icon";
import styles from "../trainer-ui.module.css";

type View="today"|"tomorrow"|"week";
function addDays(key:string,days:number){const [y,m,d]=key.split("-").map(Number);return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10);}
export default async function TrainerClassesPage({searchParams}:{searchParams:Promise<{view?:string|string[]}>}) {
  await connection();let principal;
  try{principal=await requireWorkspace("/trainer");}catch{redirect("/access-denied");}
  const requested=(await searchParams).view;
  const view:View=requested==="tomorrow"||requested==="week"?requested:"today";
  const [slots,studio]=await Promise.all([getAssignedTrainerSlots(principal),readDocument(`studios/${principal.studioId}`)]);
  const timezone=String(studio.data()?.timezone??"UTC");const now=new Date();const today=trainerDateKey(now,timezone);
  const [y,m,d]=today.split("-").map(Number);const monday=addDays(today,-((new Date(Date.UTC(y,m-1,d)).getUTCDay()+6)%7));
  const first=view==="week"?monday:view==="tomorrow"?addDays(today,1):today;
  const last=view==="week"?addDays(monday,6):first;
  const visible=slots.filter(slot=>slot.localDate>=first&&slot.localDate<=last).sort((a,b)=>a.startsAt.getTime()-b.startsAt.getTime());
  const dates=[...new Set(visible.map(slot=>slot.localDate))];
  return <main className={styles.page}><header className={styles.header}><p className={styles.eyebrow}>Your assigned schedule</p><h1><StudioAction icon="calendar">My classes</StudioAction></h1></header>
    <nav className={styles.tabs} aria-label="Class date range">{([['today','Today','calendar'],['tomorrow','Tomorrow','arrow'],['week','This week','list']] as const).map(([value,label,icon])=><Link prefetch={false} key={value} href={`/trainer/classes?view=${value}`} aria-current={value===view?"page":undefined}><StudioAction icon={icon}>{label}</StudioAction></Link>)}</nav>
    {!visible.length?<section className={styles.empty}><StudioIcon name="calendar"/><h2>No classes in this period</h2><p>Only classes assigned to you appear here.</p>{view!=="week"&&<Link prefetch={false} href="/trainer/classes?view=week" className={styles.secondary}>View this week <StudioIcon name="arrow"/></Link>}</section>:dates.map(date=><section key={date} className={styles.day} aria-label={trainerDisplayDate(date)}><header><h2><StudioAction icon="calendar">{trainerDisplayDate(date)}</StudioAction></h2><span>{visible.filter(slot=>slot.localDate===date).length} classes</span></header><div className={styles.sessionList}>{visible.filter(slot=>slot.localDate===date).map(slot=><TrainerSessionCard key={slot.id} slot={slot} now={now}/>)}</div></section>)}
    <p className={styles.timezone}><StudioIcon name="clock"/>Studio time · {timezone}</p>
  </main>;
}
