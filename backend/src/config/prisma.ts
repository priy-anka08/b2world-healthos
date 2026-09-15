import { PrismaClient } from "@prisma/client";

// Single shared Prisma client. In serverless environments you'd cache this
// on `globalThis` to avoid exhausting DB connections across hot reloads —
// not needed for a standard long-running Node process, but noted here
// because it's a common footgun when this gets deployed later.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
