/** HTTP error rendered as RFC 7807 application/problem+json by the error middleware. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, "bad_request", message, details);
export const unauthorized = (message = "Sign in required.") => new HttpError(401, "unauthorized", message);
export const forbidden = (message = "You do not have access to this shop.") =>
  new HttpError(403, "forbidden", message);
export const notFound = (message = "Not found.") => new HttpError(404, "not_found", message);
export const conflict = (message: string, code = "conflict") => new HttpError(409, code, message);
export const unprocessable = (message: string, code = "unprocessable") =>
  new HttpError(422, code, message);
