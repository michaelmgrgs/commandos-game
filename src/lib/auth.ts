import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const COOKIE_NAME = "cc_admin_session";
const SECRET = process.env.ADMIN_SESSION_SECRET || "dev-secret-change-me";

export type AdminSession = {
  adminId: string;
  name: string;
  role: string;
};

export function signAdminSession(payload: AdminSession): string {
  return jwt.sign(payload, SECRET, { expiresIn: "12h" });
}

export function setAdminSessionCookie(token: string): void {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export function clearAdminSessionCookie(): void {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

/**
 * Reads and verifies the admin session cookie for the current request.
 * Returns null if there's no cookie, or it's invalid/expired — callers
 * should treat that as "not logged in" and return a 401.
 */
export function getAdminSession(): AdminSession | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET) as AdminSession;
  } catch {
    return null;
  }
}
