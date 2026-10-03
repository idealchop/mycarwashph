import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "../lib/errors.js";

/** Renders errors as RFC 7807 application/problem+json. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const isHttp = err instanceof HttpError;
  const isJsonSyntax = err instanceof SyntaxError && "body" in err;
  const status = isHttp ? err.status : isJsonSyntax ? 400 : 500;
  if (status >= 500) console.error("Unhandled error", err);
  res
    .status(status)
    .type("application/problem+json")
    .json({
      type: `https://mycarwash.ph/problems/${isHttp ? err.code : isJsonSyntax ? "bad_json" : "internal"}`,
      title: isHttp ? err.message : isJsonSyntax ? "Request body is not valid JSON." : "Something went wrong.",
      status,
      code: isHttp ? err.code : isJsonSyntax ? "bad_json" : "internal",
      ...(isHttp && err.details !== undefined ? { errors: err.details } : {}),
      instance: req.originalUrl,
    });
};

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "not_found", "Route not found."));
};
