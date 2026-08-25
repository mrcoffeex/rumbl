import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32).default("development-only-secret-change-me-now"),
  DATABASE_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);

if (
  env.NODE_ENV === "production" &&
  env.JWT_SECRET === "development-only-secret-change-me-now"
) {
  throw new Error("JWT_SECRET must be configured in production");
}
