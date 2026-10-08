import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { CustomerProfile } from "@/app/components/customers-manager";
import { requireWorkspace } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";

function iso(value: unknown) {
  return value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function" ? value.toDate().toLocaleDateString("en-IN") : "—";
}

export default async function CustomerProfilePage({ params }: { params: Promise<{ customerUid: string }> }) {
  await connection();
  let principal;
  try { principal = await requireWorkspace("/studio"); } catch { redirect("/access-denied"); }
  const { customerUid } = await params;
  const db = getAdminDb(); const studioId = principal.studioId!;
  const memberRef = db.doc(`studios/${studioId}/members/${customerUid}`);
  const [memberDoc, subscriptionDocs, bookingDocs, incidentDocs] = await Promise.all([
    memberRef.get(),
    db.collection(`studios/${studioId}/subscriptions`).where("customerUid", "==", customerUid).limit(10).get(),
    db.collection(`studios/${studioId}/bookings`).where("customerUid", "==", customerUid).limit(50).get(),
    db.collection(`studios/${studioId}/incidents`).where("customerUid", "==", customerUid).limit(25).get(),
  ]);
  if (!memberDoc.exists || !(memberDoc.data()?.roles ?? []).includes("customer")) notFound();
  const member = memberDoc.data()!; const currentSubscription = subscriptionDocs.docs.find((doc) => ["active", "paused"].includes(String(doc.data().status)))?.data() ?? subscriptionDocs.docs[0]?.data();
  const slots = await Promise.all(bookingDocs.docs.map((doc) => db.doc(`studios/${studioId}/slots/${String(doc.data().slotId ?? "")}`).get()));
  const bookingRows = bookingDocs.docs.map((doc, index) => { const slot = slots[index]?.data(); return { id: doc.id, className: String(slot?.className ?? "Class"), localDate: String(slot?.localDate ?? "—"), status: String(doc.data().status ?? "recorded") }; });
  const attendance = bookingRows.filter((row) => row.status === "attended" || row.status === "no-show");
  const activity = incidentDocs.docs.map((doc) => ({ id: doc.id, label: `Incident: ${String(doc.data().source ?? "recorded")}`, createdAt: iso(doc.data().createdAt) }));
  return <CustomerProfile customer={{ uid: customerUid, name: String(member.displayName ?? "").trim() || String(member.email ?? "Customer"), email: String(member.email ?? ""), status: member.status === "inactive" ? "inactive" : "active", subscription: currentSubscription ? String(currentSubscription.historicalTerms?.planName ?? "Subscription") : "No active subscription", credits: currentSubscription ? Number(currentSubscription.availableCredits ?? 0) : null, pauseStatus: currentSubscription?.status === "paused" ? "Paused" : "Not paused", bookings: bookingRows, attendance, activity }} />;
}
