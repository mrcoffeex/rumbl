import { createHash, randomBytes } from "node:crypto";
import type { Response } from "express";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import {
  AUTH_COOKIE,
  authCookieOptions,
  clearAuthCookieOptions,
  createAuthToken,
  publicAccount,
  publicUser,
  shouldRememberSession,
  type AuthToken,
} from "../lib/auth";
import { requestIp, writeLog } from "../lib/logging";
import { sendPasswordResetEmail } from "../lib/mail";
import { verifyGoogleIdToken } from "../lib/google";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errors";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts; try again later" },
});

const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many profile updates; try again later" },
});

const emailSchema = z.string().trim().email().max(190).transform((value) => value.toLocaleLowerCase());
const passwordSchema = z.string().min(8).max(200);

function assertAccountActive(user: { status: UserStatus }) {
  if (user.status === UserStatus.DISABLED) {
    throw new HttpError(403, "This account has been disabled. Contact an administrator.");
  }
}

function setSessionCookie(
  res: Response,
  user: { id: number; email: string; name: string; role: "USER" | "ADMIN" },
  rememberMe: boolean,
) {
  const payload: AuthToken = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
  res.cookie(AUTH_COOKIE, createAuthToken(payload, rememberMe), authCookieOptions(rememberMe));
}

authRouter.get("/config", (_req, res) => {
  res.json({ googleClientId: env.GOOGLE_CLIENT_ID || null });
});

authRouter.post("/register", loginLimiter, async (req, res) => {
  const input = z
    .object({
      name: z.string().trim().min(1).max(120),
      email: emailSchema,
      password: passwordSchema,
      rememberMe: z.boolean().optional(),
    })
    .parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new HttpError(409, "An account with that email already exists");

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
      role: "USER",
    },
  });

  await writeLog({
    category: "auth",
    message: `User registered ${user.email}`,
    userId: user.id,
    ip: requestIp(req),
  });
  setSessionCookie(res, user, Boolean(input.rememberMe));
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const input = z
    .object({
      email: emailSchema,
      password: z.string().min(1).max(200),
      rememberMe: z.boolean().optional(),
    })
    .parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    await writeLog({
      level: "warn",
      category: "auth",
      message: `Failed login for unknown email ${input.email}`,
      ip: requestIp(req),
    });
    throw new HttpError(401, "Invalid email or password");
  }
  if (!user.passwordHash) {
    await writeLog({
      level: "warn",
      category: "auth",
      message: `Password login denied for Google account ${user.email}`,
      userId: user.id,
      ip: requestIp(req),
    });
    throw new HttpError(401, "This account uses Google sign-in");
  }
  if (!(await bcrypt.compare(input.password, user.passwordHash))) {
    await writeLog({
      level: "warn",
      category: "auth",
      message: `Failed login for ${user.email}`,
      userId: user.id,
      ip: requestIp(req),
    });
    throw new HttpError(401, "Invalid email or password");
  }
  assertAccountActive(user);

  await writeLog({
    category: "auth",
    message: `User signed in ${user.email}`,
    userId: user.id,
    ip: requestIp(req),
  });
  setSessionCookie(res, user, Boolean(input.rememberMe));
  res.json({ user: publicUser(user) });
});

authRouter.post("/google", loginLimiter, async (req, res) => {
  const input = z
    .object({
      idToken: z.string().min(1),
      rememberMe: z.boolean().optional(),
    })
    .parse(req.body);

  const { googleId, email, name } = await verifyGoogleIdToken(input.idToken);

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId }, { email }] },
  });
  if (user?.passwordHash && !user.googleId) {
    throw new HttpError(409, "That email already has a password account. Sign in with email instead.");
  }
  if (user) assertAccountActive(user);
  if (!user) {
    user = await prisma.user.create({
      data: { email, name, googleId, role: "USER" },
    });
    await writeLog({
      category: "auth",
      message: `User registered with Google ${email}`,
      userId: user.id,
      ip: requestIp(req),
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId },
    });
  }

  await writeLog({
    category: "auth",
    message: `User signed in with Google ${user.email}`,
    userId: user.id,
    ip: requestIp(req),
  });
  setSessionCookie(res, user, Boolean(input.rememberMe));
  res.json({ user: publicUser(user) });
});

authRouter.post("/forgot-password", loginLimiter, async (req, res) => {
  const { email } = z.object({ email: emailSchema }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await writeLog({
      level: "warn",
      category: "auth",
      message: `Password reset denied; no account for ${email}`,
      ip: requestIp(req),
    });
    throw new HttpError(404, "No account found for that email");
  }
  if (user.googleId || !user.passwordHash) {
    await writeLog({
      level: "warn",
      category: "auth",
      message: `Password reset denied for Google account ${email}`,
      userId: user.id,
      ip: requestIp(req),
    });
    throw new HttpError(400, "This account uses Google sign-in. Password reset is not available.");
  }
  assertAccountActive(user);

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const origin = env.CLIENT_ORIGIN.split(",")[0]?.trim() || "http://localhost:5173";
  const resetUrl = `${origin}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, resetUrl, user.id);
  res.json({
    ok: true,
    ...(env.NODE_ENV === "development" ? { resetUrl } : {}),
  });
});

authRouter.post("/reset-password", loginLimiter, async (req, res) => {
  const input = z
    .object({
      token: z.string().min(16),
      password: passwordSchema,
    })
    .parse(req.body);
  const tokenHash = createHash("sha256").update(input.token).digest("hex");
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
    throw new HttpError(400, "This reset link is invalid or has expired");
  }
  if (!reset.user.passwordHash || reset.user.googleId) {
    throw new HttpError(400, "This account uses Google sign-in. Password reset is not available.");
  }
  assertAccountActive(reset.user);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: await bcrypt.hash(input.password, 12) },
    }),
    prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
  ]);
  await writeLog({
    category: "auth",
    message: `Password reset completed for ${reset.user.email}`,
    userId: reset.userId,
    ip: requestIp(req),
  });
  res.json({ ok: true });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE, clearAuthCookieOptions());
  res.status(204).send();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      googleId: true,
      passwordHash: true,
      createdAt: true,
    },
  });
  if (!user) throw new HttpError(401, "Invalid or expired session");
  res.json({ user: publicAccount(user) });
});

authRouter.patch("/me", requireAuth, profileLimiter, async (req, res) => {
  const input = z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      email: emailSchema.optional(),
      currentPassword: z.string().min(1).max(200).optional(),
      password: passwordSchema.optional(),
    })
    .parse(req.body);

  if (!input.name && !input.email && !input.password) {
    throw new HttpError(400, "No changes provided");
  }

  const existing = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!existing) throw new HttpError(401, "Invalid or expired session");
  assertAccountActive(existing);

  if (input.email && input.email !== existing.email) {
    const taken = await prisma.user.findUnique({ where: { email: input.email } });
    if (taken) throw new HttpError(409, "An account with that email already exists");
  }

  if (input.password && existing.passwordHash) {
    if (!input.currentPassword) {
      throw new HttpError(400, "Current password is required");
    }
    if (!(await bcrypt.compare(input.currentPassword, existing.passwordHash))) {
      throw new HttpError(401, "Current password is incorrect");
    }
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      email: input.email,
      passwordHash: input.password ? await bcrypt.hash(input.password, 12) : undefined,
    },
  });

  await writeLog({
    category: "auth",
    message: `Updated profile ${user.email}`,
    userId: user.id,
    ip: requestIp(req),
  });
  setSessionCookie(res, user, shouldRememberSession(req.cookies?.[AUTH_COOKIE]));
  res.json({ user: publicAccount(user) });
});
