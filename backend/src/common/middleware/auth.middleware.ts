import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { createClient } from "redis";
import { env } from "@/config/env";

export interface AuthTokenPayload {
  userId: string;
  isSuperAdmin: boolean;
  hospitalId: string | null;
  organizationId: string | null;
  role: string | null;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

// Lazy Redis client singleton for session revocation checks
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({ url: env.redisUrl });
    redisClient.on("error", (err) => console.error("Redis auth check error:", err));
    await redisClient.connect();
  }
  return redisClient;
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

    // Check Redis deny-list for revoked sessions (deactivated users)
    getRedis()
      .then((redis) => redis.get(`session:revoked:${payload.userId}`))
      .then((revoked) => {
        if (revoked) {
          return res.status(401).json({ error: "Session has been revoked — account deactivated" });
        }
        next();
      })
      .catch(() => {
        // If Redis is down, fail open for MVP — in production,
        // this should fail closed or use a circuit breaker.
        next();
      });
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
