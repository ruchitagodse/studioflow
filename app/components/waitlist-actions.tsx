"use client";
import { useActionState, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { joinWaitlistAction, withdrawWaitlistAction, type WaitlistActionState } from "@/app/customer/waitlist-actions";
import styles from "./booking.module.css";
const initial: WaitlistActionState = {};
export function WaitlistPromotionAlert({ slotId, entry }: { slotId: string; entry: { status: string; bookingId?: string } | null }) {
  useEffect(() => {
    if (entry?.status !== "promoted" || !entry.bookingId) return;
    const storageKey = `waitlist-promotion-alert-${slotId}-${entry.bookingId}`;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "shown");
    void Swal.fire({ icon: "success", title: "You’re booked!", text: "A place opened up and your waitlist entry was automatically confirmed. One credit has been reserved.", confirmButtonText: "Done", customClass: { popup: styles.swalPopup, confirmButton: styles.swalConfirm } });
  }, [entry?.bookingId, entry?.status, slotId]);
  return null;
}
export function WaitlistActions({ slotId, entry }: { slotId: string; entry: { status: string; position: number } | null }) { const [joinState, joinAction, joining] = useActionState(joinWaitlistAction, initial); const [withdrawState, withdrawAction, withdrawing] = useActionState(withdrawWaitlistAction, initial); const [id] = useState(() => crypto.randomUUID());
  useEffect(() => { if (joinState.success) void Swal.fire({ icon: "success", title: "You’re on the waitlist", text: joinState.success, confirmButtonText: "Done", customClass: { popup: styles.swalPopup, confirmButton: styles.swalConfirm } }); }, [joinState.success]);
  useEffect(() => { if (withdrawState.success) void Swal.fire({ icon: "success", title: "You left the waitlist", text: withdrawState.success, confirmButtonText: "Done", customClass: { popup: styles.swalPopup, confirmButton: styles.swalConfirm } }); }, [withdrawState.success]);
  if (entry?.status === "active") return <form action={withdrawAction} className={styles.compactForm}><p className={styles.actionHint}>You are #{entry.position} on the waitlist. No credit is held.</p><input type="hidden" name="slotId" value={slotId}/><input type="hidden" name="operationId" value={id}/>{withdrawState.error && <p className={styles.error} role="alert">{withdrawState.error}</p>}{withdrawState.success && <p className={styles.success} role="status">{withdrawState.success}</p>}<button disabled={withdrawing}>{withdrawing ? "Leaving…" : "Leave waitlist"}</button></form>; return <form action={joinAction} className={styles.compactForm}><input type="hidden" name="slotId" value={slotId}/><input type="hidden" name="operationId" value={id}/>{joinState.error && <p className={styles.error} role="alert">{joinState.error}</p>}{joinState.success && <p className={styles.success} role="status">{joinState.success}</p>}<button disabled={joining}>{joining ? "Joining…" : "Join waitlist"}</button></form>; }
