import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "../lib/errors.js";

/** body-parser errors carry a 4xx `status` and a `type` such as "entity.too.large". */
function parserError(err: unknown): { status: number; code: string; title: string } | null {
  const e = err as { status?: unknown; type?: unknown };
  if (typeof e?.status !== "number" || e.status < 400 || e.status >= 500 || typeof e.type !== "string") return null;
  if (e.status === 413) return { status: 413, code: "payload_too_large", title: "Request body is too large." };
  if (e.type === "entity.parse.failed") return { status: 400, code: "bad_json", title: "Request body is not valid JSON." };
  return { status: e.status, code: "bad_request", title: "The request body could not be read." };
}

/** Renders errors as RFC 7807 application/problem+json. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const isHttp = err instanceof HttpError;
  const parsed = isHttp ? null : parserError(err);
  const status = isHttp ? err.status : parsed ? parsed.status : 500;
  if (status >= 500) console.error("Unhandled error", err);
  res
    .status(status)
    .type("application/problem+json")
    .json({
      type: `https://mycarwash.ph/problems/${isHttp ? err.code : parsed ? parsed.code : "internal"}`,
      title: isHttp ? err.message : parsed ? parsed.title : "Something went wrong.",
      status,
      code: isHttp ? err.code : parsed ? parsed.code : "internal",
      ...(isHttp && err.details !== undefined ? { errors: err.details } : {}),
      instance: req.originalUrl,
    });
};

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "not_found", "Route not found."));
};
