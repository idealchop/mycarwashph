import type { NextFunction, Request, Response } from 'express';
import { headerValue, verifyRequest, type VerifyOptions } from './verify.js';
import {
  idempotencyBodyHash,
  isIdempotencyKey,
  type IdempotencyStore,
} from './idempotency.js';
import { problem, type Problem } from './problems.js';

export interface RiverRequest extends Request {
  rawBody?: Buffer;
  river?: { keyId: string; caller: string; factor: 'oidc' | 'key' };
}

export function captureRawBody(req: Request, _res: Response, buf: Buffer): void {
  (req as RiverRequest).rawBody = Buffer.from(buf);
}

function sendProblem(res: Response, status: number, code: string): void {
  const body: Problem = problem(status, code);
  res.status(status).type('application/problem+json').json(body);
}

/** Express middleware. Mount after `express.json({ verify: captureRawBody, limit: '16kb' })`. */
export function riverAuth(options: VerifyOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
    const result = await verifyRequest(
      {
        method: req.method,
        pathWithQuery: req.originalUrl,
        headers: req.headers as Record<string, string | string[] | undefined>,
        rawBody: (req as RiverRequest).rawBody ?? '',
        secure: req.secure || headerValue(req.headers as Record<string, string | string[] | undefined>, 'x-forwarded-proto') === 'https',
      },
      options,
    );
    if (!result.ok) {
      sendProblem(res, result.status, result.code);
      return;
    }
    (req as RiverRequest).river = { keyId: result.keyId, caller: result.caller, factor: result.factor };
    next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Idempotency-Key on writes. Same key + same body replays the stored response.
 * A different body is 422. Missing or malformed key is 400.
 * `scope` should include the caller so keys are not global.
 */
export function riverIdempotency(store: IdempotencyStore, scope: (req: Request) => string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      next();
      return;
    }
    const key = headerValue(req.headers as Record<string, string | string[] | undefined>, 'idempotency-key');
    if (!isIdempotencyKey(key)) {
      sendProblem(res, 400, 'invalid_request');
      return;
    }
    const bodyHash = idempotencyBodyHash((req as RiverRequest).rawBody ?? '');
    const id = `${scope(req)}\n${key}`;
    const existing = await store.get(id);
    if (existing) {
      if (existing.bodyHash !== bodyHash) {
        sendProblem(res, 422, 'idempotency_key_reused');
        return;
      }
      res.setHeader('Idempotent-Replayed', 'true');
      res.status(existing.status).type(existing.contentType).send(existing.body);
      return;
    }

    const chunks: Buffer[] = [];
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    res.write = ((chunk: unknown, ...rest: unknown[]) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return originalWrite(chunk as never, ...(rest as never[]));
    }) as typeof res.write;
    res.end = ((chunk: unknown, ...rest: unknown[]) => {
      if (chunk && typeof chunk !== 'function') {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      const body = Buffer.concat(chunks).toString('utf8');
      void store.create(id, {
        bodyHash,
        status: res.statusCode,
        contentType: String(res.getHeader('Content-Type') ?? 'application/json'),
        body,
      });
      return originalEnd(chunk as never, ...(rest as never[]));
    }) as typeof res.end;
    next();
  };
}
