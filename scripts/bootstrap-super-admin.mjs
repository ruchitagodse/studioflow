import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const uidArgument = process.argv.findIndex((argument) => argument === "--uid");
const uid = process.argv.find((argument) => argument.startsWith("--uid="))?.slice(6)
  ?? (uidArgument >= 0 ? process.argv[uidArgument + 1] : undefined);
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!uid) throw new Error("A Firebase Auth UID is required. Run: npm run bootstrap:super-admin -- --uid=<Firebase Auth UID>");
if (!projectId || !clientEmail || !privateKey) throw new Error("FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY must be set in .env.local.");

const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const user = await getAuth(app).getUser(uid);
if (user.disabled) throw new Error("The Firebase Auth user is disabled and cannot receive Super Admin authority.");

await getFirestore(app).doc(`platformAdmins/${uid}`).set({
  status: "active",
  email: user.email ?? null,
  grantedAt: FieldValue.serverTimestamp(),
  grantedBy: "controlled-bootstrap",
});

console.log(`Active Super Admin authority granted to ${uid}.`);
