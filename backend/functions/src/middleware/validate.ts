import type { RequestHandler } from "express";
import type { z } from "zod";
import { badRequest } from "../lib/errors.js";

/** Parses req.body with a Zod schema and replaces it with the parsed value. */
export function validateBody<S extends z.ZodType>(schema: S): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return next(
        badRequest(
          "Some fields are missing or invalid.",
          result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        ),
      );
    }
    req.body = result.data;
    next();
  };
}
