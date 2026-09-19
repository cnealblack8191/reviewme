import { prisma } from "@/lib/prisma";

interface AuditInput {
  reviewId?: string;
  actorUserId?: string | null;
  actorLabel: string;
  action: string;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
}

export async function recordAudit(input: AuditInput) {
  await prisma.auditEvent.create({
    data: {
      reviewId: input.reviewId,
      actorUserId: input.actorUserId ?? undefined,
      actorLabel: input.actorLabel,
      action: input.action,
      field: input.field,
      oldValue: input.oldValue ?? undefined,
      newValue: input.newValue ?? undefined
    }
  });
}
