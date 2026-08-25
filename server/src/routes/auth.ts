import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  AUTH_COOKIE,
  authCookieOptions,
  createAdminToken,
} from "../lib/auth";
import { requireAdmin } from "../middleware/auth";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts; try again later" },
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const input = z
    .object({
      username: z.string().trim().min(1).max(100),
      password: z.string().min(1).max(200),
    })
    .parse(req.body);

  const admin = await prisma.admin.findUnique({ where: { username: input.username } });
  if (!admin || !(await bcrypt.compare(input.password, admin.passwordHash))) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = createAdminToken({ adminId: admin.id, username: admin.username });
  res.cookie(AUTH_COOKIE, token, authCookieOptions);
  res.json({ admin: { id: admin.id, username: admin.username } });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: authCookieOptions.secure,
    sameSite: authCookieOptions.sameSite,
    path: "/",
  });
  res.status(204).send();
});

authRouter.get("/me", requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});
