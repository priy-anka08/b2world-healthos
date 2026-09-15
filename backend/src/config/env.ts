import "dotenv/config";

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "4000", 10),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  aiServiceUrl: process.env.AI_SERVICE_URL ?? "http://localhost:8000",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
