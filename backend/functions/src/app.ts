import express from "express";
import { brand } from "./config/brand.js";

/** Phase 0 scaffold: health endpoint only. Business routes arrive in the next milestone. */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: `${brand.slug}-api` });
  });
  return app;
}
