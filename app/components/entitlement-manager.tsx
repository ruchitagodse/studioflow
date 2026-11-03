"use client";

import { StudioIcon, StudioAction } from "@/app/components/studio-icon";
import { useActionState, useEffect, useRef, useState } from "react";
import { ClientPortal } from "./client-portal";
import { currentMemberships, recentMemberships } from "@/lib/membership-display";
import { adjustCreditsAction, cancelSubscriptionAction, createPlanAction, pauseSubscriptionAction, renewSubscriptionAction, retirePlanAction, updatePlanAction, type EntitlementActionState } from "@/app/studio/entitlements/actions";
import styles from "./schedule.module.css";
import entStyles from "./entitlement-ui.module.css";
import { StudioMembershipTabs } from "./studio-membership-tabs";
import { StudioStatusStrip } from "./studio-status-strip";

type Plan = { id: string; name: string; description: string; pricePaise: number; creditAllocation: number; validityDays: number | null; durationMonths: number | null; status: "draft" | "active" | "retired" };
type Subscription = { id: string; customerUid: string; customerName: string; customerEmail: string; planName: string; status: "active" | "paused" | "inactive"; inactiveReason: string | null; startsAt: string; endsAt: string; effectiveEndsAt: string; availableCredits: number; reservedCredits: number; usedCredits: number; usableCredits: number; durationMonths: number | null; pauseDaysUsed: number; pauseAllowanceDays: number; pauseEndsAt: string | null };
type LedgerEntry = { id: string; action: string; amount: number; balanceBefore: number; balanceAfter: number; reason: string; createdAt: string };
const initial: EntitlementActionState = {};
const op = () => crypto.randomUUID();
function Result({ state }: { state: EntitlementActionState }) { return state.error ? <p className={styles.error} role="alert">{state.error}</p> : state.success ? <p className={styles.success} role="status">{state.success}</p> : null; }
function duration(plan: Pick<Plan, "validityDays" | "durationMonths">) { return plan.durationMonths ? `${plan.durationMonths} calendar month${plan.durationMonths === 1 ? "" : "s"}` : `${plan.validityDays} days`; }
function FreshOperation() { return <input type="hidden" name="operationId" defaultValue={op()} />; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function subscriptionLabel(subscription: Subscription) {
  if (subscription.status === "inactive") return subscription.inactiveReason?.toLowerCase().includes("cancel") ? "Cancelled" : "Expired";
  return subscription.status[0].toUpperCase() + subscription.status.slice(1);
}
function shortDate(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
function EntitlementIcon({ name }: { name: "available" | "reserved" | "used" | "history" | "membership" | "adjust" }) {
  const names = { available: "credits", reserved: "clock", used: "check", history: "history", membership: "membership", adjust: "settings" } as const;
  return <span className={entStyles.meaningIcon}><StudioIcon name={names[name]} /></span>;
}
type DurationType = "fixed-days" | "calendar-months";
function DurationFields({ id, validityDays, durationMonths, disabled }: { id: string; validityDays?: number | null; durationMonths?: number | null; disabled: boolean }) {
  const initialType: DurationType = durationMonths ? "calendar-months" : "fixed-days";
  const [type, setType] = useState<DurationType>(initialType);
  const [days, setDays] = useState(initialType === "fixed-days" && validityDays ? String(validityDays) : "");
  const [months, setMonths] = useState(initialType === "calendar-months" && durationMonths ? String(durationMonths) : "");
  const choose = (next: DurationType) => { setType(next); if (next === "fixed-days") setMonths(""); else setDays(""); };
  const onlyPositiveWholeNumber = (value: string, update: (next: string) => void) => { if (value === "" || (/^\d+$/.test(value) && Number(value) >= 1)) update(value); };
  return <fieldset className={entStyles.durationSelector} disabled={disabled}>
    <legend className={entStyles.durationLegend}>Duration type *</legend>
    <div className={entStyles.durationOptions} role="radiogroup" aria-label="Plan duration type">
      <label className={entStyles.durationOption} data-active={type === "fixed-days"}><input type="radio" name={`${id}-duration-type`} value="fixed-days" checked={type === "fixed-days"} onChange={() => choose("fixed-days")} /> Fixed days</label>
      <label className={entStyles.durationOption} data-active={type === "calendar-months"}><input type="radio" name={`${id}-duration-type`} value="calendar-months" checked={type === "calendar-months"} onChange={() => choose("calendar-months")} /> Calendar months</label>
    </div>
    <div className={entStyles.durationFields}>
      {type === "fixed-days" ? <label>Number of days<input name="validityDays" type="number" min="1" step="1" inputMode="numeric" placeholder="30" required disabled={disabled} value={days} onChange={(event) => onlyPositiveWholeNumber(event.target.value, setDays)} /></label> : <label>Number of months<input name="durationMonths" type="number" min="1" step="1" inputMode="numeric" placeholder="1" required disabled={disabled} value={months} onChange={(event) => onlyPositiveWholeNumber(event.target.value, setMonths)} /></label>}
    </div>
  </fieldset>;
}

function PlanDrawer({ plan, action, state, pending, onClose }: { plan: Plan | null; action: (payload: FormData) => void; state: EntitlementActionState; pending: boolean; onClose: () => void }) {
  const editing = plan !== null;
  const title = editing ? "EDIT PLAN" : "CREATE NEW PLAN";
  return <div className={entStyles.planDrawerBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
    <section className={entStyles.planDrawer} role="dialog" aria-modal="true" aria-labelledby="plan-drawer-title">
      <div className={entStyles.planDrawerHeader}><div><p className={styles.kicker}>{title}</p><h2 id="plan-drawer-title">{editing ? plan.name : "Create a membership plan"}</h2><span>{editing ? "Changes apply only to future subscriptions." : "Create a membership plan for your customers."}</span></div><button type="button" onClick={onClose} disabled={pending} aria-label="Close plan form"><StudioIcon name="close" /></button></div>
      <form action={action} className={styles.form}>
        {editing ? <input type="hidden" name="planId" value={plan.id} /> : <FreshOperation />}
        <label>Plan name *<input name="name" defaultValue={plan?.name ?? ""} required minLength={2} maxLength={100} disabled={pending} /></label>
        <label>Description<textarea name="description" defaultValue={plan?.description ?? ""} maxLength={400} disabled={pending} placeholder="Short description..." /></label>
        <div className={styles.two}><label>Price (INR) *<input name="priceInr" type="number" min="0" step="0.01" defaultValue={plan ? (plan.pricePaise / 100).toFixed(2) : ""} required disabled={pending} /></label><label>Credits *<input name="creditAllocation" type="number" min="1" defaultValue={plan?.creditAllocation ?? ""} required disabled={pending} /></label></div>
        <DurationFields id={editing ? `edit-plan-${plan.id}` : "create-plan"} validityDays={plan?.validityDays} durationMonths={plan?.durationMonths} disabled={pending} />
        <p className={styles.note}>Only calendar-month plans are pause eligible.</p>
        <label>Status<select name="status" defaultValue={plan?.status === "active" ? "active" : "draft"} disabled={pending}><option value="draft">Draft</option><option value="active">Active</option></select></label>
        <Result state={state} />
        <div className={entStyles.drawerActions}><button type="button" className={styles.textButton} onClick={onClose} disabled={pending}>Cancel</button><button disabled={pending}><StudioAction icon={editing ? "save" : "add"}>{pending ? (editing ? "Saving…" : "Creating…") : (editing ? "Save future terms" : "Create plan")}</StudioAction></button></div>
      </form>
    </section>
  </div>;
}

type LedgerFilter = "all" | "allocation" | "reservation" | "consumption" | "release" | "adjustment";
const ledgerFilters: { value: LedgerFilter; label: string }[] = [{ value: "all", label: "All" }, { value: "allocation", label: "Allocation" }, { value: "reservation", label: "Reservation" }, { value: "consumption", label: "Consumption" }, { value: "release", label: "Release" }, { value: "adjustment", label: "Adjustment" }];
function ledgerType(entry: LedgerEntry): Exclude<LedgerFilter, "all"> {
  const action = entry.action.toLowerCase();
  if (action.includes("allocation")) return "allocation";
  if (action.includes("reservation")) return "reservation";
  if (action.includes("consumption")) return "consumption";
  if (action.includes("release") || action.includes("return")) return "release";
  return "adjustment";
}
function ledgerLabel(entry: LedgerEntry) { const type = ledgerType(entry); return type[0].toUpperCase() + type.slice(1); }
function ledgerDate(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function LedgerHistory({ subscription, entries, returnHref }: { subscription: Subscription; entries: LedgerEntry[]; returnHref: string }) {
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const displayedEntries = entries.filter((entry) => filter === "all" || ledgerType(entry) === filter);
  const total = Math.max(subscription.availableCredits + subscription.reservedCredits + subscription.usedCredits, 1);
  return <ClientPortal><div className={entStyles.ledgerBackdrop} role="presentation"><section className={entStyles.ledgerModal} role="dialog" aria-modal="true" aria-labelledby="ledger-title">
    <div className={entStyles.ledgerHeader}><div><p className={styles.kicker}>LEDGER HISTORY</p><h2 id="ledger-title">Credit history</h2><span>Actual immutable ledger activity for this subscription.</span></div><a href={returnHref} aria-label="Close credit history">×</a></div>
    <section className={entStyles.ledgerSummary} aria-label="Subscription credit summary"><div className={entStyles.ledgerCustomer}><span className={entStyles.customerAvatar} aria-hidden="true">{initials(subscription.customerName)}</span><div><b>{subscription.customerName}</b><span>Plan: {subscription.planName}</span><small data-status={subscription.status}>● Status: {subscriptionLabel(subscription)}</small></div></div><div><small>Available</small><b>{subscription.usableCredits}</b><span>credits</span></div><div><small>Reserved</small><b>{subscription.reservedCredits}</b><span>credits</span></div><div><small>Used</small><b>{subscription.usedCredits}</b><span>credits</span></div><div><small>Total plan</small><b>{total}</b><span>credits</span></div></section>
    <div className={entStyles.ledgerTools}><div className={entStyles.ledgerFilters} role="group" aria-label="Filter ledger transactions">{ledgerFilters.map((item) => <button type="button" key={item.value} data-active={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div></div>
    {displayedEntries.length === 0 ? <p className={styles.empty}>No {filter === "all" ? "" : filter + " "}ledger entries are available.</p> : <div className={entStyles.ledgerTable}><div className={entStyles.ledgerTableHead} aria-hidden="true"><span>Date &amp; time</span><span>Type</span><span>Description</span><span>Credits</span><span>Balance after</span></div>{displayedEntries.map((entry) => <article key={entry.id}><time dateTime={entry.createdAt}><StudioIcon name="clock" /><span>{ledgerDate(entry.createdAt)}<small>{ledgerType(entry)}</small></span></time><span className={entStyles.ledgerType} data-type={ledgerType(entry)}>{ledgerLabel(entry)}</span><div className={entStyles.ledgerDescription}><b>{entry.reason || ledgerLabel(entry) + " recorded"}</b><span>{entry.action.replaceAll("_", " ")}</span></div><strong data-positive={entry.amount > 0}>{entry.amount > 0 ? "+" : ""}{entry.amount}</strong><div className={entStyles.ledgerBalance}><span>Available: {entry.balanceAfter}</span><span>Before: {entry.balanceBefore}</span></div></article>)}</div>}
  </section></div></ClientPortal>;
}

type EntitlementView = "plans" | "subscriptions" | "credits" | "pauses";
function MembershipHistory({ records, onClose }: { records: Subscription[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  const current = currentMemberships(records)[0];
  const past = recentMemberships(records.filter((record) => record.id !== current?.id));
  return <dialog ref={dialogRef} className={entStyles.membershipHistory} onCancel={onClose} onClose={onClose} aria-labelledby="membership-history-title" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <header><div><p className={styles.kicker}>{current?.customerName}</p><h2 id="membership-history-title">Membership history</h2></div><button type="button" aria-label="Close membership history" onClick={onClose}><StudioIcon name="close" /></button></header>
    {current && <p className={entStyles.historyCurrent}>Current membership: <strong>{current.planName}</strong> · {subscriptionLabel(current)}</p>}
    <p className={entStyles.historyNote}>Previous memberships from the recent subscription records. Each ledger keeps its original transactions.</p>
    {past.length === 0 ? <p className={styles.empty}>No previous memberships in the loaded records.</p> : <div className={entStyles.historyList}>{past.map((record) => <article key={record.id}><div><h3>{record.planName}</h3><span>{shortDate(record.startsAt)} – {shortDate(record.effectiveEndsAt)}</span><small>{record.availableCredits} available · {record.reservedCredits} reserved · {record.usedCredits} used</small></div><em>{subscriptionLabel(record)}</em><a href={`/studio/credits?subscription=${encodeURIComponent(record.id)}&customer=${encodeURIComponent(record.customerUid)}`}><StudioAction icon="history">Credit history</StudioAction></a></article>)}</div>}
  </dialog>;
}

export function EntitlementManager({ plans, subscriptions, ledger, selectedSubscriptionId, view, customerUid = null }: { plans: Plan[]; subscriptions: Subscription[]; ledger: LedgerEntry[]; selectedSubscriptionId: string | null; view: EntitlementView; customerUid?: string | null }) {
  const [createState, createAction, creating] = useActionState(createPlanAction, initial);
  const [updateState, updateAction, updating] = useActionState(updatePlanAction, initial);
  const [retireState, retireAction, retiring] = useActionState(retirePlanAction, initial);
  const [renewState, renewAction, renewing] = useActionState(renewSubscriptionAction, initial);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelSubscriptionAction, initial);
  const [pauseState, pauseAction, pausing] = useActionState(pauseSubscriptionAction, initial);
  const [adjustState, adjustAction, adjusting] = useActionState(adjustCreditsAction, initial);
  const [planQuery, setPlanQuery] = useState("");
  const [planStatus, setPlanStatus] = useState("all");
  const [subscriptionQuery, setSubscriptionQuery] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("all");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [openCreditAdjustmentId, setOpenCreditAdjustmentId] = useState<string | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [historyCustomerUid, setHistoryCustomerUid] = useState<string | null>(null);
  const [pauseEditorOpen, setPauseEditorOpen] = useState(false);
  const creditAdjustmentRef = useRef<HTMLDetailsElement | null>(null);
  useEffect(() => {
    if (!openCreditAdjustmentId) return;
    const closeWhenOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !creditAdjustmentRef.current?.contains(event.target)) setOpenCreditAdjustmentId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenCreditAdjustmentId(null); };
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("pointerdown", closeWhenOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [openCreditAdjustmentId]);
  useEffect(() => {
    const selector = `details.${entStyles.pauseEditor}`;
    const updatePauseEditor = (event: Event) => {
      if (event.target instanceof HTMLDetailsElement && event.target.matches(selector)) setPauseEditorOpen(event.target.open);
    };
    document.addEventListener("toggle", updatePauseEditor, true);
    return () => document.removeEventListener("toggle", updatePauseEditor, true);
  }, []);
  const closePauseEditor = () => {
    document.querySelectorAll<HTMLDetailsElement>(`details.${entStyles.pauseEditor}[open]`).forEach((editor) => { editor.open = false; });
    setPauseEditorOpen(false);
  };
  useEffect(() => {
    const openLedger = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href*="/studio/credits?subscription="]');
      if (!link) return;
      event.preventDefault();
      setLedgerLoading(true);
      window.requestAnimationFrame(() => window.location.assign(link.href));
    };
    document.addEventListener("click", openLedger);
    return () => document.removeEventListener("click", openLedger);
  }, []);
  const activePlans = plans.filter((plan) => plan.status === "active");
  const visiblePlans = plans.filter((plan) => {
    const query = planQuery.trim().toLowerCase();
    return (!query || plan.name.toLowerCase().includes(query) || plan.description.toLowerCase().includes(query)) && (planStatus === "all" || plan.status === planStatus);
  });
  const scopedSubscriptions = customerUid ? subscriptions.filter((subscription) => subscription.customerUid === customerUid) : subscriptions;
  const boardSubscriptions = view === "subscriptions" || view === "credits" ? currentMemberships(scopedSubscriptions) : scopedSubscriptions;
  const visibleSubscriptions = boardSubscriptions.filter((subscription) => {
    const query = subscriptionQuery.trim().toLowerCase();
    const matchesStatus = subscriptionStatus === "all" || subscription.status === subscriptionStatus || (subscriptionStatus === "expired" && subscription.status === "inactive" && !subscription.inactiveReason?.toLowerCase().includes("cancel")) || (subscriptionStatus === "cancelled" && subscription.status === "inactive" && subscription.inactiveReason?.toLowerCase().includes("cancel"));
    return (!query || subscription.customerName.toLowerCase().includes(query) || subscription.planName.toLowerCase().includes(query)) && matchesStatus;
  });
  const subscriptionCounts = {
    all: boardSubscriptions.length,
    active: boardSubscriptions.filter((subscription) => subscription.status === "active").length,
    paused: boardSubscriptions.filter((subscription) => subscription.status === "paused").length,
    expired: boardSubscriptions.filter((subscription) => subscription.status === "inactive" && !subscription.inactiveReason?.toLowerCase().includes("cancel")).length,
    cancelled: boardSubscriptions.filter((subscription) => subscription.status === "inactive" && subscription.inactiveReason?.toLowerCase().includes("cancel")).length,
  };
  const selectedSubscription = selectedSubscriptionId ? subscriptions.find((subscription) => subscription.id === selectedSubscriptionId) ?? null : null;
  const exportSubscriptions = () => {
    const rows = [["Customer", "Plan", "Credits", "Start date", "Expiry date", "Status", "Cancellation"], ...visibleSubscriptions.map((sub) => [sub.customerName, sub.planName, `${sub.usableCredits} / ${sub.availableCredits}`, shortDate(sub.startsAt), shortDate(sub.effectiveEndsAt), subscriptionLabel(sub), sub.inactiveReason ?? ""])];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "subscriptions.csv"; link.click(); URL.revokeObjectURL(url);
  };

  return <main className={`${styles.page} ${styles.studioPolish} ${entStyles.entUi}`} data-view={view}>
    {customerUid && (view === "subscriptions" || view === "credits") && <section className={entStyles.customerContext} aria-label="Customer membership workspace">
      <a href={`/studio/customers/${encodeURIComponent(customerUid)}`}><StudioAction icon="back">Customer profile</StudioAction></a>
      <div><span className={entStyles.contextAvatar} aria-hidden="true">{initials(scopedSubscriptions[0]?.customerName ?? "Customer")}</span><strong>{scopedSubscriptions[0]?.customerName ?? "Customer"}</strong></div>
      <nav aria-label="Customer membership screens"><a href={`/studio/subscriptions?customer=${encodeURIComponent(customerUid)}`} aria-current={view === "subscriptions" ? "page" : undefined}><EntitlementIcon name="membership" />Memberships</a><a href={`/studio/credits?customer=${encodeURIComponent(customerUid)}`} aria-current={view === "credits" ? "page" : undefined}><EntitlementIcon name="available" />Credits</a></nav>
    </section>}
    {(view === "subscriptions" || view === "credits") && <h1 className={entStyles.compactTitle}>{view === "credits" ? "Credits" : "Memberships"}</h1>}
    {view === "subscriptions" && !customerUid && <StudioMembershipTabs active="memberships" />}
    {historyCustomerUid && <ClientPortal><MembershipHistory records={scopedSubscriptions.filter((record) => record.customerUid === historyCustomerUid)} onClose={() => setHistoryCustomerUid(null)} /></ClientPortal>}
    {ledgerLoading && <ClientPortal><div className={entStyles.ledgerLoadingBackdrop} role="status" aria-live="polite"><div className={entStyles.ledgerLoadingNotice}><span className={entStyles.ledgerLinkSpinner} aria-hidden="true" />Opening ledger…</div></div></ClientPortal>}
    {pauseEditorOpen && <ClientPortal><button type="button" className={entStyles.pauseEditorBackdrop} aria-label="Close pause form by clicking outside" onClick={closePauseEditor} /><button type="button" className={entStyles.pauseEditorClose} aria-label="Close pause form" onClick={closePauseEditor}><StudioIcon name="close" /></button></ClientPortal>}
    {view === "plans" && <header className={`${styles.header} ${entStyles.entHeader}`}><h1>Plans</h1><button type="button" className={entStyles.createPlanButton} onClick={() => setCreatingPlan(true)}><StudioAction icon="add">Create plan</StudioAction></button></header>}
    {view === "plans" && <section className={`${styles.panel} ${entStyles.entPanel} ${entStyles.planLibrary}`}>
      <div className={entStyles.libraryHeader}><div className={entStyles.planFilters}><label><StudioIcon name="search" /><input type="search" placeholder="Search plans…" aria-label="Search plans" value={planQuery} onChange={(event) => setPlanQuery(event.target.value)} /></label><select aria-label="Filter plans by status" value={planStatus} onChange={(event) => setPlanStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="retired">Retired</option></select></div></div>
      <Result state={updateState} /><Result state={retireState} />
      {plans.length === 0 ? <p className={styles.empty}>No plans yet.</p> : <>
        <div className={entStyles.planTableHead} aria-hidden="true"><span>Name</span><span>Description</span><span>Price</span><span>Credits</span><span>Duration</span><span>Status</span><span>Actions</span></div>
        <div className={`${styles.memberList} ${entStyles.planRows}`}>{visiblePlans.map((plan) => <article key={plan.id} className={`${styles.memberCard} ${entStyles.planRow}`}>
          <div className={`${styles.memberHeading} ${entStyles.planIdentity}`}><b>{plan.name}</b></div><span className={entStyles.planDescription}>{plan.description || "No description"}</span><span className={entStyles.planPrice}>₹{(plan.pricePaise / 100).toFixed(2)}</span><span className={entStyles.planCredits}>{plan.creditAllocation} credits</span><span className={entStyles.planDuration}>{duration(plan)}</span><em className={`${plan.status === "active" ? styles.activeBadge : styles.inactiveBadge} ${entStyles.planStatus}`}>{plan.status}</em>
          {plan.status === "retired" ? <p className={styles.note}>Historical only</p> : <div className={entStyles.planActions}><button type="button" className={entStyles.planEditButton} onClick={() => setSelectedPlan(plan)}>Edit</button><details className={entStyles.planOverflow}><summary aria-label={`Plan actions for ${plan.name}`}><StudioIcon name="more" /></summary><form action={retireAction}><input type="hidden" name="planId" value={plan.id} /><button type="submit" disabled={retiring}>{retiring ? "Retiring…" : "Retire plan"}</button></form></details></div>}
        </article>)}</div>{visiblePlans.length === 0 && <p className={entStyles.noPlans}>No plans match those filters.</p>}</>}
    </section>}
    {view === "subscriptions" && <section className={`${styles.panel} ${entStyles.entPanel} ${entStyles.subscriptionLibrary}`}><div className={entStyles.subscriptionToolbar}><StudioStatusStrip label="Subscription status filters" value={subscriptionStatus} onChange={setSubscriptionStatus} items={[{value:"all",label:"All",count:subscriptionCounts.all,icon:"list",tone:"primary"},{value:"active",label:"Active",count:subscriptionCounts.active,icon:"check",tone:"success"},{value:"paused",label:"Paused",count:subscriptionCounts.paused,icon:"pause",tone:"warning"},{value:"expired",label:"Expired",count:subscriptionCounts.expired,icon:"clock",tone:"muted"},{value:"cancelled",label:"Cancelled",count:subscriptionCounts.cancelled,icon:"close",tone:"danger"}]}/><div className={entStyles.subscriptionTools}><div className={entStyles.planFilters}><label><StudioIcon name="search" /><input type="search" placeholder="Search members…" aria-label="Search subscriptions" value={subscriptionQuery} onChange={(event) => setSubscriptionQuery(event.target.value)} /></label><select aria-label="Filter subscriptions by status" value={subscriptionStatus} onChange={(event) => setSubscriptionStatus(event.target.value)}><option value="all">All status</option><option value="active">Active</option><option value="paused">Paused</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option></select></div><button type="button" className={entStyles.exportButton} onClick={exportSubscriptions} disabled={!visibleSubscriptions.length}><StudioAction icon="download">Export</StudioAction></button></div></div><Result state={renewState} /><Result state={cancelState} />{subscriptions.length === 0 ? <p className={styles.empty}>No subscriptions have been assigned.</p> : <><div className={entStyles.subscriptionTableHead} aria-hidden="true"><span>Customer</span><span>Plan</span><span>Credits</span><span>Start date</span><span>Expiry date</span><span>Status</span><span>Cancellation</span><span>Actions</span></div><div className={`${styles.memberList} ${entStyles.subscriptionRows}`}>{visibleSubscriptions.map((sub) => { const label = subscriptionLabel(sub); return <article key={sub.id} className={`${styles.memberCard} ${entStyles.subscriptionRow}`} data-status={label.toLowerCase()}><div className={entStyles.subscriptionCustomer}><span className={entStyles.customerAvatar} aria-hidden="true">{initials(sub.customerName)}</span><b>{sub.customerName}</b></div><span className={entStyles.subscriptionPlan}><b><StudioAction icon="membership">{sub.planName}</StudioAction></b><small>{sub.durationMonths ? `${sub.durationMonths} month${sub.durationMonths === 1 ? "" : "s"}` : "Fixed-term plan"}</small></span><span className={entStyles.creditBalance}><b><StudioAction icon="credits">{sub.usableCredits}</StudioAction></b><small>{sub.reservedCredits} reserved</small></span><time dateTime={sub.startsAt}><StudioAction icon="calendar">{shortDate(sub.startsAt)}</StudioAction></time><time dateTime={sub.effectiveEndsAt}><StudioAction icon="clock">{shortDate(sub.effectiveEndsAt)}</StudioAction></time><em className={`${entStyles.subscriptionStatus} ${entStyles[`status${label}`]}`}><StudioAction icon={sub.status === "active" ? "check" : sub.status === "paused" ? "pause" : label === "Cancelled" ? "close" : "clock"}>{label}</StudioAction></em><span className={entStyles.cancellationDetail} data-empty={!sub.inactiveReason}>{sub.inactiveReason ?? "—"}</span><div className={entStyles.subscriptionActions}><a className={styles.textButton} href={`/studio/credits?subscription=${encodeURIComponent(sub.id)}${customerUid ? `&customer=${encodeURIComponent(customerUid)}` : ""}`}><StudioAction icon="history">Credit history</StudioAction></a><button type="button" className={entStyles.historyButton} onClick={() => setHistoryCustomerUid(sub.customerUid)} aria-label={`Membership history for ${sub.customerName}`}><StudioAction icon="membership">History</StudioAction></button><details className={entStyles.subscriptionEditor}><summary aria-label={`Actions for ${sub.customerName}`}><StudioAction icon="settings">Manage</StudioAction></summary>{sub.status === "inactive" && activePlans.length > 0 && <form action={renewAction} className={styles.form}><FreshOperation /><input type="hidden" name="customerUid" value={sub.customerUid} /><label>Renew with active plan<select name="planId" disabled={renewing}>{activePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {duration(plan)}</option>)}</select></label><button disabled={renewing}>{renewing ? "Renewing…" : "Create renewal"}</button></form>}{(sub.status === "active" || sub.status === "paused") && <form action={cancelAction} className={styles.form}><FreshOperation /><input type="hidden" name="subscriptionId" value={sub.id} /><label>Cancellation timing<select name="mode" defaultValue="end_of_term" disabled={cancelling}><option value="end_of_term">End of term</option><option value="immediate">Immediate</option></select></label><label>Reason (required for immediate)<input name="reason" minLength={2} maxLength={300} disabled={cancelling} /></label><button className={styles.textButton} disabled={cancelling}>{cancelling ? "Saving…" : "Save cancellation"}</button></form>}</details></div></article>; })}</div>{visibleSubscriptions.length === 0 && <p className={entStyles.noPlans}>No subscriptions match those filters.</p>}</>}</section>}
    {view === "credits" && <section className={`${styles.panel} ${entStyles.entPanel} ${entStyles.subscriptionLibrary} ${entStyles.creditActivity}`}><div className={entStyles.libraryHeader}><div><p className={styles.kicker}>CUSTOMER CREDIT BALANCES</p><h2>Credit balances</h2><p>View current credit balances, usage and reservation details for each customer.</p></div><div className={entStyles.planFilters}><label><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg><input type="search" placeholder="Search customer by name…" aria-label="Search customer credits" value={subscriptionQuery} onChange={(event) => setSubscriptionQuery(event.target.value)} /></label></div></div><Result state={adjustState} />{subscriptions.length === 0 ? <p className={styles.empty}>No customer credit balances are available yet.</p> : <><div className={`${entStyles.subscriptionTableHead} ${entStyles.creditTableHead}`} aria-hidden="true"><span>Customer</span><span>Plan</span><span>Credit balance <small>Available</small></span><span><small>Reserved</small></span><span><small>Used</small></span><span>Status</span><span>Actions</span></div><div className={`${styles.memberList} ${entStyles.subscriptionRows}`}>{visibleSubscriptions.map((sub) => { const total = Math.max(sub.availableCredits + sub.reservedCredits + sub.usedCredits, 1); const label = subscriptionLabel(sub); return <article key={sub.id} className={`${styles.memberCard} ${entStyles.subscriptionRow} ${entStyles.creditRow}`}><div className={entStyles.subscriptionCustomer}><span className={entStyles.customerAvatar} aria-hidden="true">{initials(sub.customerName)}</span><b>{sub.customerName}</b></div><span className={entStyles.creditPlan}><b>{sub.planName}</b><small>{total} total credits</small></span><div className={entStyles.creditMeasure} data-kind="available"><small className={entStyles.creditMetricLabel}><EntitlementIcon name="available" />Available</small><b>{sub.usableCredits}</b><span className={entStyles.creditUnit}>credits</span></div><div className={entStyles.creditMeasure} data-kind="reserved"><small className={entStyles.creditMetricLabel}><EntitlementIcon name="reserved" />Reserved</small><b>{sub.reservedCredits}</b><span className={entStyles.creditUnit}>credits</span></div><div className={entStyles.creditMeasure} data-kind="used"><small className={entStyles.creditMetricLabel}><EntitlementIcon name="used" />Used</small><b>{sub.usedCredits}</b><span className={entStyles.creditUnit}>credits</span></div><em className={`${entStyles.subscriptionStatus} ${entStyles[`status${label}`]}`}><i />{label}</em><div className={entStyles.creditActions}><a className={styles.textButton} href={`/studio/credits?subscription=${encodeURIComponent(sub.id)}${customerUid ? `&customer=${encodeURIComponent(customerUid)}` : ""}`}><EntitlementIcon name="history" />Credit history</a><button type="button" className={entStyles.historyButton} onClick={() => setHistoryCustomerUid(sub.customerUid)} aria-label={`Membership history for ${sub.customerName}`}><EntitlementIcon name="membership" />Membership history</button><details ref={openCreditAdjustmentId === sub.id ? creditAdjustmentRef : null} className={entStyles.subscriptionEditor} open={openCreditAdjustmentId === sub.id} onToggle={(event) => setOpenCreditAdjustmentId(event.currentTarget.open ? sub.id : null)}><summary aria-label={`Adjust credits for ${sub.customerName}`}><EntitlementIcon name="adjust" /><span>Adjust credits</span></summary><form action={adjustAction} className={styles.form}><FreshOperation /><input type="hidden" name="subscriptionId" value={sub.id} /><label>Adjustment<input name="amount" type="number" required disabled={adjusting} /></label><label>Reason<input name="reason" minLength={2} required disabled={adjusting} /></label><button disabled={adjusting}>{adjusting ? "Adjusting…" : "Record adjustment"}</button></form></details></div></article>; })}</div>{visibleSubscriptions.length === 0 && <p className={entStyles.noPlans}>No customer credit balances match that search.</p>}</>}</section>}
    {view === "pauses" && <section className={`${styles.panel} ${entStyles.entPanel} ${entStyles.pauseLibrary}`}>
      <div className={entStyles.pauseHeader}>
        <div><h1>Membership pauses</h1></div>
        <div className={entStyles.pauseFilters}><select aria-label="Filter pauses" value={subscriptionStatus} onChange={(event) => setSubscriptionStatus(event.target.value)}><option value="all">All</option><option value="active">Ready to pause</option><option value="paused">Active pauses</option><option value="inactive">History</option></select><label><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input type="search" placeholder="Search customer by name…" aria-label="Search customer by name" value={subscriptionQuery} onChange={(event) => setSubscriptionQuery(event.target.value)} /></label></div>
      </div>
      <Result state={pauseState} />
      <div className={entStyles.pauseTableHead} aria-hidden="true"><span>Customer</span><span>Plan</span><span>Allowance</span><span>Start date</span><span>Pause end</span><span>Status</span><span>History</span><span>Actions</span></div>
      <div className={entStyles.pauseRows}>{visibleSubscriptions.filter((sub) => sub.durationMonths).map((sub) => { const remaining = Math.max(sub.pauseAllowanceDays - sub.pauseDaysUsed, 0); const progress = sub.pauseAllowanceDays ? Math.min(100, (sub.pauseDaysUsed / sub.pauseAllowanceDays) * 100) : 0; return <article key={sub.id} className={entStyles.pauseRow}>
        <div className={entStyles.pauseCustomer}><span className={entStyles.pauseAvatar} aria-hidden="true">{initials(sub.customerName)}</span><span><b>{sub.customerName}</b>{sub.customerEmail && <small>{sub.customerEmail}</small>}</span></div>
        <span className={entStyles.pausePlan}><b>{sub.planName}</b><small>{sub.availableCredits} credits</small></span>
        <span className={entStyles.pauseAllowance}><b>{sub.pauseDaysUsed} / {sub.pauseAllowanceDays} days</b><i aria-label={`${remaining} pause days remaining`}><i style={{ width: `${progress}%` }} /></i><small>{remaining} day{remaining === 1 ? "" : "s"} remaining</small></span>
        <time className={entStyles.pauseStart} dateTime={sub.startsAt}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg><span><b>{shortDate(sub.startsAt)}</b><small>{new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(sub.startsAt))}</small></span></time>
        <span className={entStyles.pauseEnd}><b>{sub.pauseEndsAt ? shortDate(sub.pauseEndsAt) : "—"}</b><small>{sub.pauseEndsAt ? "Pause active" : "Ongoing"}</small></span>
        <em className={`${entStyles.pauseStatus} ${sub.status === "paused" ? entStyles.pauseStatusPaused : ""}`}><i />{sub.status === "active" ? "Ready" : subscriptionLabel(sub)}</em>
        <span className={entStyles.pauseHistory}>{sub.status === "inactive" ? "Completed / inactive" : <><b>—</b><small>No pauses yet</small></>}</span>
        <div className={entStyles.pauseActions}>{sub.status === "active" && remaining > 0 ? <details className={entStyles.pauseEditor}><summary><StudioIcon name="pause" /> Pause membership</summary><form action={pauseAction} className={styles.form}><FreshOperation /><input type="hidden" name="subscriptionId" value={sub.id} /><label>Pause days <input name="pauseDays" type="number" min="1" max={remaining} required disabled={pausing} /></label><small>Up to {remaining} day{remaining === 1 ? "" : "s"} remaining.</small><button disabled={pausing}><StudioAction icon="pause">{pausing ? "Pausing…" : "Pause now"}</StudioAction></button></form></details> : <span className={entStyles.pauseUnavailable}>—</span>}</div>
      </article>; })}</div>
      {visibleSubscriptions.filter((sub) => sub.durationMonths).length === 0 && <p className={styles.empty}>No pause-eligible subscriptions match those filters.</p>}
    </section>}
    {(creatingPlan || selectedPlan) && <PlanDrawer plan={selectedPlan} action={selectedPlan ? updateAction : createAction} state={selectedPlan ? updateState : createState} pending={selectedPlan ? updating : creating} onClose={() => { setCreatingPlan(false); setSelectedPlan(null); }} />}{selectedSubscription && view === "credits" && <LedgerHistory subscription={selectedSubscription} entries={ledger} returnHref={customerUid ? `/studio/credits?customer=${encodeURIComponent(customerUid)}` : "/studio/credits"} />}
  </main>;
}
