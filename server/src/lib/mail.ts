import { createTransport } from "nodemailer";
import { env } from "./env";
import { writeLog } from "./logging";

export async function sendPasswordResetEmail(to: string, resetUrl: string, userId: number) {
  const subject = "Reset your Rumbl password";
  const text = `Reset your Rumbl password using this link (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`;

  if (!env.SMTP_HOST) {
    await writeLog({
      level: "info",
      category: "auth",
      message: `Password reset link generated for ${to}`,
      meta: { resetUrl, email: to },
      userId,
    });
    console.info(`Password reset for ${to}: ${resetUrl}`);
    return;
  }

  const transporter = createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER || "rumbl@localhost",
    to,
    subject,
    text,
  });
}
