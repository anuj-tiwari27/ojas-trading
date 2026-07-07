import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  companyId: string;
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  diff?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Central audit writer. Failures are swallowed (logged) so that auditing can
 * never break a business operation — but in practice writes are awaited inside
 * the same transaction at call sites that need guaranteed durability.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId: entry.companyId,
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          summary: entry.summary,
          diff: (entry.diff ?? undefined) as Prisma.InputJsonValue | undefined,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log for ${entry.entityType}:${entry.entityId}`,
        err as Error,
      );
    }
  }

  /** Computes a field-level diff between two plain objects. */
  static diff(
    before: Record<string, any>,
    after: Record<string, any>,
    ignore: string[] = ['updatedAt', 'createdAt'],
  ): Record<string, { old: unknown; new: unknown }> {
    const out: Record<string, { old: unknown; new: unknown }> = {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const k of keys) {
      if (ignore.includes(k)) continue;
      const a = before[k];
      const b = after[k];
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        out[k] = { old: a ?? null, new: b ?? null };
      }
    }
    return out;
  }
}
