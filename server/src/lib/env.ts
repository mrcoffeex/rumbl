import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

const envFiles = [
  path.resolve(__dirname, "../../.env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "server/.env"),
];

const onVercel = Boolean(process.env.VERCEL);
for (const envPath of envFiles) {
  if (existsSync(envPath)) {
    config({ path: envPath, override: !onVercel, quiet: true });
    break;
  }
}

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32).default("development-only-secret-change-me-now"),
  DATABASE_URL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export const clientOrigins = [
  ...env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()),
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "",
].filter((origin, index, all) => origin && all.indexOf(origin) === index);

if (env.NODE_ENV === "production" && !env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be configured in production");
}

if (
  env.NODE_ENV === "production" &&
  env.JWT_SECRET === "development-only-secret-change-me-now"
) {
  throw new Error("JWT_SECRET must be configured in production");
}
