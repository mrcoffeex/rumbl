import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./lib/env";
import { authRouter } from "./routes/auth";
import { adminRouter } from "./routes/admin";
import { publicRouter } from "./routes/public";
import { errorHandler, notFound } from "./middleware/errors";

export const app = express();

if (env.NODE_ENV === "production") app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/public", publicRouter);

app.use(notFound);
app.use(errorHandler);
