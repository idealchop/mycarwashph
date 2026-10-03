import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import type { AppConfig } from "../config/env.js";

/** Minimal CORS for the shop web app origins. */
export function cors(config: AppConfig): RequestHandler {
  return (req, res, next) => {
    const origin = req.header("origin");
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    }
    if (req.method === "OPTIONS") return void res.status(204).end();
    next();
  };
}

/**
 * Per-instance rate limit (express-rate-limit). Cloud Functions scale out, so a
 * shared counter or gateway quota is still needed for the public API (Phase 1).
 */
export function limiter(config: AppConfig, limit: number): RequestHandler {
  if (config.disableRateLimit) return (_req, _res, next) => next();
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { status: 429, code: "rate_limited", title: "Too many requests. Please slow down." },
  });
}
