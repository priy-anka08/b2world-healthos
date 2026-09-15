import { prisma } from "@/config/prisma";

interface AuditParams {
  hospitalId?: string | null;
  userId?: string | null;
  action: string; // "patient.view", "invoice.refund", "ai_copilot.query", ...
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

// Fire-and-forget by design: an audit write should never block or fail the
// primary request. In production, back this with a durable queue (e.g. the
// request is written to Redis/Kafka first, a worker persists to Postgres)
// so a DB hiccup can't silently drop audit trail entries.
export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        hospitalId: params.hospitalId ?? undefined,
        userId: params.userId ?? undefined,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        metadata: params.metadata as never,
        ipAddress: params.ipAddress,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to write audit log", err);
  }
}
