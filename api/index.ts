import type { IncomingMessage, ServerResponse } from "node:http";
import { app } from "../server/src/app";

function restoreApiPath(req: IncomingMessage) {
  const forwarded = req.headers["x-forwarded-uri"];
  if (typeof forwarded === "string" && forwarded.startsWith("/api")) {
    req.url = forwarded;
    return;
  }

  const current = req.url ?? "/";
  if (!current.startsWith("/api")) {
    req.url = current === "/" ? "/api" : `/api${current.startsWith("/") ? current : `/${current}`}`;
  }
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  restoreApiPath(req);
  app(req, res);
}

export const config = { maxDuration: 100, runtime: "nodejs" };
