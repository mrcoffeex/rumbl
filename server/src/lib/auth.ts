import jwt from "jsonwebtoken";
import { env } from "./env";

export const AUTH_COOKIE = "rumbl_admin";

export type AdminToken = {
  adminId: number;
  username: string;
};

export function createAdminToken(payload: AdminToken): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "12h" });
}

export function verifyAdminToken(token: string): AdminToken {
  return jwt.verify(token, env.JWT_SECRET) as AdminToken;
}

export const authCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 12 * 60 * 60 * 1000,
  path: "/",
};
