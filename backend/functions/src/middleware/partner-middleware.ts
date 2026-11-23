import type { Request, RequestHandler, Response } from "express";
import type { ApiScope } from "../models/types.js";
import { headerValue, isIdempotencyKey, problem, riverAuth, type RiverRequest } from "../river/bridge-kit/index.js";
import type { RiverAuthConfig } from "../river/config.js";
import { getPartner, setContext } from "./context.js";

/** Max request body on /v1 (River Bridge contract). */
export const MAX_BODY_BYTES = 16 * 1024;

function sendProblem(res: Response, status: number, code: string) {
  res.status(status).type("application/problem+json").json(problem(status, code));
}

/** 413 for bodies over 16 KB. Uses the raw bytes (Cloud Functions pre-parses JSON and keeps req.rawBody). */
export function limitBody(max = MAX_BODY_BYTES): RequestHandler {
  return (req, res, next) => {
    const raw = (req as RiverRequest).rawBody;
    const declared = Number(req.header("content-length") ?? 0);
    if ((raw && raw.length > max) || declared > max) return sendProblem(res, 413, "payload_too_large");
    next();
  };
}

/**
 * Both River Bridge factors on every /v1 call (except /v1/health): a Google OIDC ID
 * token from an allowlisted service account with aud = this API's origin, and the
 * X-River-Signature HMAC with a single-use nonce. Verification is the vendored
 * bridge-kit (src/river/bridge-kit), unchanged. No config = fail closed (401).
 * Failures are generic problem+json; the reason is only in the audit log.
 */
export function riverPartnerAuth(config: RiverAuthConfig | undefined): RequestHandler {
  if (!config) {
    return (req, res) => {
      console.log(JSON.stringify({ severity: "WARNING", message: "river_auth", at: new Date().toISOString(), method: req.method, path: req.path, result: "deny", status: 401, reason: "not_configured" }));
      sendProblem(res, 401, "unauthorized");
    };
  }
  const verify = riverAuth({
    audience: config.audience,
    secrets: config.secrets,
    allowedEmails: config.allowedEmails,
    oidc: config.oidc,
    nonces: config.nonces,
    // No API-key fallback: factor 1 is always a Google OIDC token (the mcw_ key is gone).
    allowKeyFallback: false,
    requireHttps: config.requireHttps,
    onAudit: config.onAudit,
  });
  return (req, res, next) => {
    void verify(req as Request, res, (err?: unknown) => {
      if (err) return next(err);
      const river = (req as RiverRequest).river!;
      setContext(res, { partner: { id: config.clientId, scopes: config.scopes, caller: river.caller, keyId: river.keyId } });
      next();
    });
  };
}

export function requireScope(scope: ApiScope): RequestHandler {
  return (_req, res, next) => {
    if (!getPartner(res).scopes.includes(scope)) return sendProblem(res, 403, "forbidden");
    next();
  };
}

/** Idempotency-Key on every write: 8–128 of A-Za-z0-9_.:- (400 otherwise). */
export function requireIdempotencyKey(): RequestHandler {
  return (req, res, next) => {
    const key = headerValue(req.headers as Record<string, string | string[] | undefined>, "idempotency-key");
    if (!isIdempotencyKey(key)) return sendProblem(res, 400, "invalid_request");
    next();
  };
}
