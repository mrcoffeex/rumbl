import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { clientOrigins, env } from "./lib/env";
import { authRouter } from "./routes/auth";
import { sessionRouter } from "./routes/sessions";
import { adminRouter } from "./routes/admin";
import { publicRouter } from "./routes/public";
import { errorHandler, notFound } from "./middleware/errors";
import { optionalAuth } from "./middleware/auth";
import { trafficLogger } from "./middleware/traffic";
import { checkDatabase } from "./lib/database";

export const app = express();

if (env.NODE_ENV === "production") app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: clientOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(optionalAuth);
app.use(trafficLogger);
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);

app.get("/api/health", async (_req, res) => {
  const connected = await checkDatabase();
  res.status(connected ? 200 : 503).json({
    status: connected ? "ok" : "unavailable",
    database: connected ? "connected" : "disconnected",
  });
});
app.use("/api/auth", authRouter);
app.use("/api/sessions", sessionRouter);
app.use("/api/admin", adminRouter);
app.use("/api/public", publicRouter);

app.use(notFound);
app.use(errorHandler);
