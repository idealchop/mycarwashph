import type { RequestHandler } from "express";
import { hashSecret, safeEqualHex } from "../lib/crypto.js";
import { forbidden, HttpError, unauthorized } from "../lib/errors.js";
import type { ApiClient, ApiScope } from "../models/types.js";
import { parseApiKey } from "../services/api-clients-service.js";
import { paths } from "../services/paths.js";
import type { DocStore } from "../store/doc-store.js";
import { getApiClient, setContext } from "./context.js";

/** Authenticates a server-to-server API client (River Mobile backend) by API key. */
export function requireApiClient(store: DocStore, pepper: string): RequestHandler {
  return async (req, res, next) => {
    try {
      const header = req.header("authorization") ?? "";
      const key = /^Bearer (.+)$/i.exec(header)?.[1];
      const parsed = key ? parseApiKey(key) : null;
      if (!parsed) throw unauthorized("Missing or malformed API key.");
      const client = await store.get<ApiClient>(paths.apiClient(parsed.clientId));
      if (!client || client.status !== "active" || !safeEqualHex(client.secretHash, hashSecret(parsed.secret, pepper))) {
        throw unauthorized("Invalid API key.");
      }
      setContext(res, { apiClient: client });
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireScope(scope: ApiScope): RequestHandler {
  return (_req, res, next) => {
    const client = getApiClient(res);
    if (!client.scopes.includes(scope)) return next(forbidden(`API client lacks the ${scope} scope.`));
    next();
  };
}

export function requireIdempotencyKey(): RequestHandler {
  return (req, _res, next) => {
    const key = req.header("idempotency-key");
    if (!key || key.length < 8 || key.length > 128) {
      return next(new HttpError(400, "idempotency_key_required", "Send an Idempotency-Key header (8 to 128 characters)."));
    }
    next();
  };
}
