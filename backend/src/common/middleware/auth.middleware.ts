import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "@/config/env";

export interface AuthTokenPayload {
  userId: string;
  isSuperAdmin: boolean;
  // The active hospital context for this session. A user with access to
  // multiple hospitals selects one at login (or switches via a dedicated
  // endpoint that re-issues a token) — the token is what scopes every
  // downstream query, not a client-supplied header, which the client
  // could freely tamper with.
  hospitalId: string | null;
  organizationId: string | null;
  role: string | null; // RoleName, kept as string to avoid import cycle
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
