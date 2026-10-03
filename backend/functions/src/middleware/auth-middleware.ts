import type { RequestHandler } from "express";
import type { TokenVerifier } from "../auth/token-verifier.js";
import { unauthorized } from "../lib/errors.js";
import { setContext } from "./context.js";

/** Verifies the Firebase ID token in `Authorization: Bearer <token>`. */
export function requireAuth(verifier: TokenVerifier): RequestHandler {
  return async (req, res, next) => {
    const header = req.header("authorization") ?? "";
    const match = /^Bearer (.+)$/i.exec(header);
    if (!match) return next(unauthorized());
    try {
      setContext(res, { user: await verifier.verify(match[1]!) });
      next();
    } catch {
      next(unauthorized("Your session has expired. Please sign in again."));
    }
  };
}
