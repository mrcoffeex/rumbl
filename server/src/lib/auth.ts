import jwt from "jsonwebtoken";
import { env } from "./env";

export const AUTH_COOKIE = "rumbl_auth";
export const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_MS = 12 * 60 * 60 * 1000;

export type AuthToken = {
  userId: number;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
};

export function createAuthToken(payload: AuthToken, rememberMe = false): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: rememberMe ? "30d" : "12h" });
}

export function verifyAuthToken(token: string): AuthToken {
  return jwt.verify(token, env.JWT_SECRET) as AuthToken;
}

export function authCookieOptions(rememberMe = false) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: rememberMe ? REMEMBER_MS : SESSION_MS,
    path: "/",
  };
}

export function clearAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function publicUser(user: AuthToken | { id: number; email: string; name: string; role: "USER" | "ADMIN" }) {
  const id = "userId" in user ? user.userId : user.id;
  return {
    id,
    email: user.email,
    name: user.name,
    role: user.role === "ADMIN" ? "admin" : "user",
  };
}

export function publicAccount(user: {
  id: number;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  googleId?: string | null;
  passwordHash?: string | null;
  createdAt?: Date;
}) {
  return {
    ...publicUser(user),
    google: Boolean(user.googleId),
    hasPassword: Boolean(user.passwordHash),
    createdAt: user.createdAt?.toISOString(),
  };
}

export function shouldRememberSession(token?: string) {
  if (!token) return false;
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    return Boolean(decoded?.exp && decoded.exp * 1000 - Date.now() > SESSION_MS);
  } catch {
    return false;
  }
}
