import { readDocument } from "@/lib/firebase/reads";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import Image from "next/image";
import studioImage from "@/app/assets/pilates-hero-v2.png";
import { requireWorkspace } from "@/lib/auth/server";
import { getAssignedTrainerSlots } from "@/lib/trainer-schedule";
import { trainerDateKey,trainerDisplayDate } from "@/lib/trainer-display";
import { TrainerSessionCard } from "@/app/components/trainer-session-card";
import { StudioAction,StudioIcon } from "@/app/components/studio-icon";
import styles from "./trainer-ui.module.css";
import home from "./trainer-home.module.css";

export default async function TrainerWorkspace() {
  await connection();
  let principal;
  try{principal=await requireWorkspace("/trainer");}catch(error){redirect(error instanceof Error&&error.message==="NO_ACTIVE_SESSION"?"/":"/access-denied");}
  const [slots,member,studio]=await Promise.all([getAssignedTrainerSlots(principal),readDocument(`studios/${principal.studioId}/members/${principal.uid}`),readDocument(`studios/${principal.studioId}`)]);
  const timezone=String(studio.data()?.timezone??"UTC");
  const now=new Date();
  const today=trainerDateKey(now,timezone);
  const todaySlots=slots.filter(slot=>slot.localDate===today).sort((a,b)=>a.startsAt.getTime()-b.startsAt.getTime());
  const current=slots.find(slot=>slot.status==="published"&&slot.startsAt<=now&&slot.endsAt>now);
  const next=current??slots.filter(slot=>slot.status==="published"&&slot.startsAt>now).sort((a,b)=>a.startsAt.getTime()-b.startsAt.getTime())[0];
  const name=String(member.data()?.displayName??"").trim()||"Trainer";
  const hour=Number(new Intl.DateTimeFormat("en-US",{timeZone:timezone,hour:"numeric",hourCycle:"h23"}).format(now));
  const greeting=hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  const remainingToday=todaySlots.filter(slot=>slot.id!==next?.id);
  return <main className={`${styles.page} ${home.page}`}>
    <header className={home.hero}><Image src={studioImage} alt="" fill sizes="(max-width: 760px) 100vw, 1032px" preload className={home.heroImage}/><div className={home.heroShade}/><div className={home.heroCopy}><p className={home.date}><StudioAction icon="calendar">{trainerDisplayDate(today)}</StudioAction></p><p className={home.greeting}>{greeting},</p><h1>{name}.</h1><span className={home.role}><StudioAction icon="user">Trainer</StudioAction></span></div></header>
    <section className={home.daily} aria-label="Today’s assigned schedule"><div className={home.dailyTitle}><h2>Your day</h2><span>Today</span></div><div className={home.metrics}><div><span className={home.metricIcon}><StudioIcon name="calendar"/></span><span><strong>{todaySlots.length}</strong><small>Classes</small></span></div><div><span className={home.metricIcon}><StudioIcon name="users"/></span><span><strong>{todaySlots.reduce((sum,slot)=>sum+slot.rosterBookingCount,0)}</strong><small>Bookings</small></span></div></div></section>
    <nav className={home.quickActions} aria-label="Trainer quick actions"><Link prefetch={false} href="/trainer/classes"><span className={home.actionIcon}><StudioIcon name="calendar"/></span><span><strong>My classes</strong><small>Assigned sessions</small></span><StudioIcon name="arrow"/></Link><Link prefetch={false} href="/trainer/attendance"><span className={home.actionIcon}><StudioIcon name="check"/></span><span><strong>Attendance</strong><small>Open rosters</small></span><StudioIcon name="arrow"/></Link></nav>
    <div className={home.schedule}>
      {next?<section aria-labelledby="next-session"><div className={styles.sectionHeading}><h2 id="next-session"><StudioAction icon={current?"check":"clock"}>{current?"Your class is live":"Next session"}</StudioAction></h2></div><TrainerSessionCard slot={next} now={now} featured/></section>:<section className={home.clearSchedule} aria-labelledby="schedule-clear"><span className={home.clearIcon}><StudioIcon name="calendar"/></span><div><h2 id="schedule-clear">No upcoming sessions</h2><p>Your assigned classes will appear here.</p></div><Link prefetch={false} href="/trainer/classes?view=week" aria-label="View this week’s assigned classes"><StudioIcon name="arrow"/></Link></section>}
      {remainingToday.length>0&&<section aria-labelledby="today-schedule"><div className={styles.sectionHeading}><h2 id="today-schedule">{next?.localDate===today?"More today":"Today’s schedule"}</h2><Link prefetch={false} href="/trainer/classes">View all</Link></div>{remainingToday.map(slot=><TrainerSessionCard key={slot.id} slot={slot} now={now}/>)}</section>}
    </div><p className={styles.timezone}><StudioIcon name="clock"/>Studio time · {timezone}</p>
  </main>;
}
