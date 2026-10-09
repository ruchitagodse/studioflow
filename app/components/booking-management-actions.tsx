"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";
import { cancelBookingAction, rescheduleBookingAction, type BookingActionState } from "@/app/customer/actions";
import styles from "./booking.module.css";
import actionStyles from "./booking-management-actions.module.css";

type Booking = { id: string; cancellationState: "free" | "late" | "unavailable"; reschedulable: boolean };
type Target = { id: string; className: string; localDate: string; startTime: string; endTime: string; trainerName: string; remainingCapacity: number; alreadyBooked: boolean };
const initial: BookingActionState = {};

function CalendarIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18" /></svg>; }
function CancelIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="m9 9 6 6m0-6-6 6" /></svg>; }
function escapeText(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

export function BookingManagementActions({ booking, targets }: { booking: Booking; targets: Target[] }) {
  const [cancelState, cancelAction] = useActionState(cancelBookingAction, initial);
  const [cancelPending, startCancelTransition] = useTransition();
  const [reschedulePending, setReschedulePending] = useState(false);
  const router = useRouter();
  const [cancelOperationId] = useState(() => crypto.randomUUID()); const [rescheduleOperationId] = useState(() => crypto.randomUUID());
  const late = booking.cancellationState === "late";
  useEffect(() => { if (cancelState.success || cancelState.error) void Swal.fire({ icon: cancelState.success ? "success" : "error", title: cancelState.success ? "Booking updated" : "Couldn’t cancel booking", text: cancelState.success ?? cancelState.error, confirmButtonText: "Done", customClass: { popup: styles.swalPopup, confirmButton: styles.swalConfirm } }).then(() => { if (cancelState.success) router.refresh(); }); }, [cancelState.error, cancelState.success, router]);
  async function confirmCancellation() { const result = await Swal.fire({ icon: "warning", title: late ? "Cancel this class?" : "Cancel your booking?", text: late ? "This is a late cancellation. Your reserved class pass will be used." : "Your reserved class pass will return to your available balance.", showCancelButton: true, confirmButtonText: late ? "Yes, cancel class" : "Yes, cancel booking", cancelButtonText: "Keep booking", focusCancel: true, customClass: { popup: styles.swalPopup, confirmButton: styles.swalConfirm, cancelButton: actionStyles.swalCancel } }); if (result.isConfirmed) { const form = new FormData(); form.set("bookingId", booking.id); form.set("operationId", cancelOperationId); startCancelTransition(() => cancelAction(form)); } }
  async function openReschedule() {
    if (!targets.length) { await Swal.fire({ icon: "info", title: "No classes available", text: "There are no eligible available classes to reschedule into right now.", confirmButtonText: "Done", customClass: { popup: styles.swalPopup, confirmButton: styles.swalConfirm } }); return; }
    let selectedTarget = targets[0];
    const result = await Swal.fire({
      icon: "question",
      title: "Reschedule class",
      html: `<p class="${actionStyles.pickerHint}">Choose your new class. Your reserved class pass will move with this booking.</p><div class="${actionStyles.slotChoices}" role="radiogroup" aria-label="Available classes">${targets.map((target, index) => `<button class="${actionStyles.slotChoice}${index === 0 ? ` ${actionStyles.slotChoiceSelected}` : ""}" type="button" role="radio" aria-checked="${index === 0}" data-index="${index}">${escapeText(`${target.localDate} · ${target.startTime}–${target.endTime}`)}<strong>${escapeText(target.className)}</strong><span>with ${escapeText(target.trainerName)} · ${target.remainingCapacity} seats available</span></button>`).join("")}</div>`,
      showCancelButton: true,
      confirmButtonText: "Confirm reschedule",
      cancelButtonText: "Keep booking",
      didOpen: () => {
        Swal.getHtmlContainer()?.querySelectorAll<HTMLButtonElement>(`button.${actionStyles.slotChoice}`).forEach((choice) => choice.addEventListener("click", () => {
          const index = Number(choice.dataset.index); selectedTarget = targets[index];
          Swal.getHtmlContainer()?.querySelectorAll<HTMLButtonElement>(`button.${actionStyles.slotChoice}`).forEach((item) => { const active = item === choice; item.classList.toggle(actionStyles.slotChoiceSelected, active); item.setAttribute("aria-checked", String(active)); });
        }));
      },
      preConfirm: () => selectedTarget.id,
      customClass: { popup: styles.swalPopup, confirmButton: styles.swalConfirm, cancelButton: actionStyles.swalCancel },
    });
    if (!result.isConfirmed) return;
    const form = new FormData();
    form.set("bookingId", booking.id);
    form.set("operationId", rescheduleOperationId);
    form.set("targetSlotId", String(result.value));
    setReschedulePending(true);
    const state = await rescheduleBookingAction(initial, form);
    setReschedulePending(false);
    await Swal.fire({ icon: state.success ? "success" : "error", title: state.success ? "Class rescheduled" : "Couldn’t reschedule", text: state.success ?? state.error ?? "We could not reschedule your class. Please try again.", confirmButtonText: "Done", customClass: { popup: styles.swalPopup, confirmButton: styles.swalConfirm } });
    if (state.success) router.refresh();
  }
  if (booking.cancellationState === "unavailable") return <p className={styles.actionHint}>This booking can no longer be changed online.</p>;
  return <div className={`${actionStyles.actions} ${booking.reschedulable ? "" : actionStyles.singleAction}`}>
    <button type="button" className={actionStyles.cancel} onClick={() => void confirmCancellation()} disabled={cancelPending || Boolean(cancelState.success)}><CancelIcon />{cancelPending ? "Cancelling…" : "Cancel booking"}</button>
    {booking.reschedulable && <button type="button" className={actionStyles.reschedule} onClick={() => void openReschedule()} disabled={reschedulePending}><CalendarIcon />{reschedulePending ? "Rescheduling…" : "Reschedule"}</button>}
  </div>;
}
