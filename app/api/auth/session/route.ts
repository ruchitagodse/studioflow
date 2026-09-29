import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuth, FirebaseConfigurationError } from "@/lib/firebase/admin";
import { sessionCookieName } from "@/lib/auth/server";

const sessionSchema = z.object({ idToken: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const { idToken } = sessionSchema.parse(await request.json());
    const auth = getAdminAuth(); const decoded = await auth.verifyIdToken(idToken); const user = await auth.getUser(decoded.uid);
    if (user.disabled) return NextResponse.json({ message: "This account is inactive." }, { status: 403 });
    const expiresIn = Number(process.env.FIREBASE_SESSION_DAYS ?? 5) * 24 * 60 * 60 * 1000;
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookieName, sessionCookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: Math.floor(expiresIn / 1000) });
    if (process.env.NODE_ENV !== "production") console.error("StudioFlow session issued.", { uid: user.uid, secure: false });
    return response;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("StudioFlow session issuance failed.", error);
    const message = error instanceof FirebaseConfigurationError ? "Firebase is not configured for this environment." : "Unable to establish a secure session.";
    return NextResponse.json({ message }, { status: 401 });
  }
}

export async function DELETE() { const response = NextResponse.json({ ok: true }); response.cookies.set(sessionCookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 }); return response; }
