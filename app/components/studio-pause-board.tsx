"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { pauseSubscriptionAction, type EntitlementActionState } from "@/app/studio/entitlements/actions";
import { StudioAction, StudioIcon } from "./studio-icon";
import { StudioMembershipTabs } from "./studio-membership-tabs";
import { StudioStatusStrip } from "./studio-status-strip";
import styles from "./studio-class-library.module.css";
import pauseStyles from "./studio-pause-board.module.css";

type Membership = { id:string; customerUid:string; customerName:string; planName:string; status:string; durationMonths:number|null; pauseDaysUsed:number; pauseAllowanceDays:number; pauseEndsAt:string|null; effectiveEndsAt:string };
const initial: EntitlementActionState = {};
const remainingDays = (item:Membership) => Math.max(0,item.pauseAllowanceDays-item.pauseDaysUsed);
const ready = (item:Membership) => item.status === "active" && remainingDays(item)>0;
function PauseForm({item,onClose}:{item:Membership;onClose:()=>void}) {
  const [state,action,pending]=useActionState(pauseSubscriptionAction,initial);
  const [operationId]=useState(()=>crypto.randomUUID());
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const node=dialog.current;if(node&&!node.open)node.showModal();},[]);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="pause-form-title" onCancel={event=>{event.preventDefault();if(!pending)onClose();}}>
    <header><h2 id="pause-form-title"><StudioAction icon="pause">Pause membership</StudioAction></h2><button type="button" className={styles.button} disabled={pending} onClick={onClose} aria-label="Close pause form"><StudioIcon name="close" /></button></header>
    <div className={styles.body}><form id="studio-pause-form" action={action} className={styles.form}>
      <strong>{item.customerName}</strong><p className={styles.note}>{item.planName} · {remainingDays(item)} pause days remaining</p>
      <input type="hidden" name="subscriptionId" value={item.id}/><input type="hidden" name="operationId" value={operationId}/>
      <label>Number of pause days<input name="pauseDays" type="number" min={1} max={remainingDays(item)} required disabled={pending||!!state.success}/></label>
      <p className={styles.note}>Pause starts now. New bookings are unavailable while paused. Credits and existing bookings stay unchanged; validity extends by the actual pause duration.</p>
      {state.error&&<p role="alert">{state.error}</p>}{state.success&&<p role="status"><StudioAction icon="check">{state.success}</StudioAction></p>}
    </form></div>
    <footer><button type="button" className={styles.button} onClick={onClose} disabled={pending}>{state.success?"Done":"Go back"}</button><button type="submit" form="studio-pause-form" className={`${styles.button} ${styles.primary}`} disabled={pending||!!state.success}><StudioAction icon="pause">{pending?"Pausing…":"Confirm pause"}</StudioAction></button></footer>
  </dialog>;
}

export function StudioPauseBoard({subscriptions,timezone}:{subscriptions:Membership[];timezone:string}) {
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState("all");
  const [selected,setSelected]=useState<Membership|null>(null);
  const eligible=subscriptions.filter(item=>!!item.durationMonths);
  const matches=(item:Membership,value:string)=>value==="all"||value==="ready"&&ready(item)||value==="paused"&&item.status==="paused"||value==="inactive"&&item.status==="inactive";
  const visible=eligible.filter(item=>matches(item,filter)&&`${item.customerName} ${item.planName}`.toLowerCase().includes(query.trim().toLowerCase()));
  const date=(value:string)=>new Intl.DateTimeFormat("en-IN",{timeZone:timezone,dateStyle:"medium"}).format(new Date(value));
  return <main className={styles.page}><header className={`${styles.header} ${pauseStyles.heading}`}><h1><StudioAction icon="pause">Membership pauses</StudioAction></h1></header><StudioMembershipTabs active="pauses" />
    <section className={styles.panel} aria-label="Membership pauses"><StudioStatusStrip label="Pause status filters" value={filter} onChange={setFilter} items={[{value:"all",label:"All",count:eligible.length,icon:"list",tone:"primary"},{value:"ready",label:"Ready",count:eligible.filter(ready).length,icon:"check",tone:"success"},{value:"paused",label:"Paused",count:eligible.filter(item=>item.status==="paused").length,icon:"pause",tone:"warning"},{value:"inactive",label:"Inactive",count:eligible.filter(item=>item.status==="inactive").length,icon:"history",tone:"muted"}]}/><div className={`${styles.tools} ${pauseStyles.tools}`}><label className={styles.search}><StudioIcon name="search"/><span className="sr-only">Search memberships to pause</span><input type="search" placeholder="Search customer or plan…" value={query} onChange={event=>setQuery(event.target.value)}/></label></div>
    <p className={styles.count} aria-live="polite">{visible.length} of {eligible.length} eligible memberships in recent records · {timezone}</p>
    {visible.map(item=><article className={pauseStyles.row} key={item.id} data-status={item.status} data-ready={ready(item)}>
      <header><a href={`/studio/customers/${encodeURIComponent(item.customerUid)}`}><StudioAction icon="user">{item.customerName}</StudioAction></a><span><StudioAction icon={item.status==="paused"?"pause":ready(item)?"check":"info"}>{item.status==="paused"?"Paused":ready(item)?"Ready to pause":item.status==="inactive"?"Inactive":"Allowance used"}</StudioAction></span></header>
      <p className={pauseStyles.plan}><StudioAction icon="membership">{item.planName}</StudioAction></p>
      <dl className={pauseStyles.facts}><div><dt><StudioAction icon="clock">Days remaining</StudioAction></dt><dd>{remainingDays(item)}</dd></div><div><dt><StudioAction icon="history">Days used</StudioAction></dt><dd>{item.pauseDaysUsed} <small>of {item.pauseAllowanceDays}</small></dd></div><div><dt><StudioAction icon="calendar">{item.status==="paused"?"Pause ends":"Membership expires"}</StudioAction></dt><dd className={pauseStyles.date}>{item.status==="paused"?(item.pauseEndsAt?date(item.pauseEndsAt):"Not recorded"):date(item.effectiveEndsAt)}</dd></div></dl>
      <footer>{ready(item)?<button type="button" className={styles.button} onClick={()=>setSelected(item)} aria-label={`Pause membership for ${item.customerName}`}><StudioAction icon="pause">Pause membership</StudioAction></button>:<p>{item.status==="paused"?"New bookings are unavailable while paused.":item.status==="inactive"?"Inactive memberships cannot be paused.":"This membership’s pause allowance has been used."}</p>}</footer>
    </article>)}
    {!visible.length&&<div className={styles.empty}><StudioIcon name="pause"/><h2>{eligible.length?"No matching memberships":"No pause-eligible memberships"}</h2>{eligible.length?<button type="button" className={styles.button} onClick={()=>{setQuery("");setFilter("all");}}>Clear filters</button>:<p>Only calendar-month memberships are eligible.</p>}</div>}
    </section>{selected&&<PauseForm item={selected} onClose={()=>setSelected(null)}/>}
  </main>;
}
