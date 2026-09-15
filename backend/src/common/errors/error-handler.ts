import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public statusCode: number, message: string, public details?: unknown) {
    super(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", issues: err.issues });
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  req.log?.error({ err }, "Unhandled error");
  // Never leak stack traces / internals to the client — this handles PHI too.
  return res.status(500).json({ error: "Internal server error" });
}
