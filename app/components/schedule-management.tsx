"use client";

import { useActionState, useState } from "react";
import { cancelSlotAction, updateClassAction, updateSlotAction, type ScheduleState } from "@/app/studio/schedule-actions";
import styles from "./schedule.module.css";

type ClassItem = { id: string; name: string; description: string; durationMinutes: number; status: string };
type Trainer = { uid: string; name: string };
type Slot = { id: string; className: string; trainerUid: string; trainerName: string; localDate: string; startTime: string; endTime: string; capacity: number; confirmedBookingCount: number; status: string; isPast: boolean };
const initialState: ScheduleState = {};

function SlotStatus({ slot }: { slot: Slot }) {
  const remaining = Math.max(0, slot.capacity - slot.confirmedBookingCount);
  const label = slot.isPast ? "Past" : slot.status === "published" && remaining === 0 ? "Full" : slot.status;
  return <em className={styles.slotStatus}>{label}</em>;
}

function SlotEditForm({ slot, trainers, action, pending }: { slot: Slot; trainers: Trainer[]; action: (payload: FormData) => void; pending: boolean }) {
  const [operationId] = useState(() => crypto.randomUUID());
  return <form action={action} className={styles.form}><input type="hidden" name="slotId" value={slot.id} /><input type="hidden" name="operationId" value={operationId} /><div className={styles.two}><label>Date<input name="localDate" type="date" defaultValue={slot.localDate} required disabled={pending} /></label><label>Capacity<input name="capacity" type="number" min={slot.confirmedBookingCount} max="100" defaultValue={slot.capacity} required disabled={pending} /></label></div><div className={styles.two}><label>Start time<input name="startTime" type="time" defaultValue={slot.startTime} required disabled={pending} /></label><label>End time<input name="endTime" type="time" defaultValue={slot.endTime} required disabled={pending} /></label></div><label>Trainer<select name="trainerUid" defaultValue={slot.trainerUid} disabled={pending}>{trainers.map((trainer) => <option key={trainer.uid} value={trainer.uid}>{trainer.name}</option>)}</select></label><label>Status<select name="status" defaultValue={slot.status} disabled={pending}><option value="draft">Draft</option><option value="published">Published</option></select></label><button disabled={pending}>{pending ? "Saving…" : "Save slot"}</button></form>;
}

export function ScheduleManagement({ classes, trainers, slots }: { classes: ClassItem[]; trainers: Trainer[]; slots: Slot[] }) {
  const [classState, classAction, classPending] = useActionState(updateClassAction, initialState);
  const [slotState, slotAction, slotPending] = useActionState(updateSlotAction, initialState);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelSlotAction, initialState);

  return <section className={styles.panel} aria-label="Manage existing schedule">
    <p className={styles.kicker}>MANAGE SCHEDULE</p><h2>Today and upcoming</h2>
    <p className={styles.note}>Edit a future slot before customers book. Once bookings exist, you can safely increase capacity, but customer-facing time, trainer, and publication changes are blocked.</p>
    {slotState.error && <p className={styles.error} role="alert">{slotState.error}</p>}{slotState.success && <p className={styles.success} role="status">{slotState.success}</p>}
    {cancelState.error && <p className={styles.error} role="alert">{cancelState.error}</p>}{cancelState.success && <p className={styles.success} role="status">{cancelState.success}</p>}
    <div className={styles.managementList}>
      {slots.map((slot) => {
        const remaining = Math.max(0, slot.capacity - slot.confirmedBookingCount);
        const editable = !slot.isPast && slot.status !== "cancelled" && slot.status !== "completed";
        return <article className={styles.managementCard} key={slot.id}>
          <div className={styles.managementHeading}><div><b>{slot.className}</b><span>{slot.localDate} · {slot.startTime}–{slot.endTime} · {slot.trainerName}</span></div><SlotStatus slot={slot} /></div>
          <p className={styles.bookingCount}>{slot.confirmedBookingCount} / {slot.capacity} booked · {remaining} available</p>
          {editable ? <details className={styles.editDetails}><summary>Edit slot</summary><SlotEditForm key={`${slot.id}:${slot.localDate}:${slot.startTime}:${slot.endTime}:${slot.trainerUid}:${slot.capacity}:${slot.status}`} slot={slot} trainers={trainers} action={slotAction} pending={slotPending} /><form action={cancelAction} className={styles.inlineAction}><input type="hidden" name="slotId" value={slot.id} /><button type="submit" disabled={cancelPending || slot.confirmedBookingCount > 0}>{cancelPending ? "Cancelling…" : "Cancel slot"}</button>{slot.confirmedBookingCount > 0 && <span>Cancellation is unavailable while this slot has bookings.</span>}</form></details> : <p className={styles.empty}>This slot is no longer editable.</p>}
        </article>;
      })}
      {!slots.length && <p className={styles.empty}>No scheduled slots to manage yet.</p>}
    </div>
    <details className={styles.editDetails}><summary>Manage class library</summary>{classState.error && <p className={styles.error} role="alert">{classState.error}</p>}{classState.success && <p className={styles.success} role="status">{classState.success}</p>}{classes.map((item) => <form key={item.id} action={classAction} className={styles.form}><input type="hidden" name="classId" value={item.id} /><label>Name<input name="name" defaultValue={item.name} required disabled={classPending} /></label><label>Description<input name="description" defaultValue={item.description} disabled={classPending} /></label><div className={styles.two}><label>Duration<input name="durationMinutes" type="number" min="15" max="240" defaultValue={item.durationMinutes} required disabled={classPending} /></label><label>Status<select name="status" defaultValue={item.status} disabled={classPending}><option value="active">Active</option><option value="draft">Draft</option><option value="retired">Retired</option></select></label></div><button disabled={classPending}>{classPending ? "Saving…" : "Save class"}</button></form>)}</details>
  </section>;
}
