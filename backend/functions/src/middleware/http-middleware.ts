import type { RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
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
    // Deployed functions are private: only the App Hosting /api proxy can call them,
    // and it passes the browser's IP in X-Mycarwash-Client-Ip (otherwise every user
    // would share the proxy's IP). req.ip can be undefined in the functions emulator.
    keyGenerator: (req) => {
      const ip = req.header("x-mycarwash-client-ip")?.trim() || req.ip || req.header("x-forwarded-for")?.split(",")[0]?.trim();
      return ip ? ipKeyGenerator(ip) : "unknown";
    },
    message: { status: 429, code: "rate_limited", title: "Too many requests. Please slow down." },
  });
}
