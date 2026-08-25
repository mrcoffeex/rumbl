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
