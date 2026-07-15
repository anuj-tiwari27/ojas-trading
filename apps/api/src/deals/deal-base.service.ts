import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { buildPageMeta } from '../common/dto/pagination.dto';
import { RequestUser } from '../common/types/request-user';
import { NumberingService } from '../numbering/numbering.service';
import { PrismaService } from '../prisma/prisma.service';
import { ImportLookups } from './deals-io';
import { DealQueryDto } from './dto/deals.dto';

export interface Ctx {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Whole-number days between today and a future date (null-safe). */
export function daysLeft(date?: Date | null): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/**
 * Shared tenant-scoped, soft-delete + audit aware base for every deal module.
 * Concrete services add their own create/update with field computation.
 */
export abstract class DealBaseService {
  protected abstract model: string; // Prisma delegate name
  protected abstract entityType: string;
  protected abstract searchFields: string[];
  protected include: Record<string, any> = {};
  protected defaultOrderBy: Record<string, any> = { createdAt: 'desc' };
  /** Scalar column used for the dateFrom/dateTo range filter (per deal type). */
  protected dateField = 'createdAt';
  /** Whether this deal type has a `side` column (Direct only). */
  protected hasSide = false;
  /** Whether this deal type has broker mode — a `kind` plus buyer/seller parties (Direct only). */
  protected hasBrokerMode = false;
  /** Columns the client is allowed to sort by (guards against Prisma 500s). */
  protected sortableFields: string[] = ['createdAt'];

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly audit: AuditService,
    protected readonly numbering: NumberingService,
  ) {}

  protected delegate(): any {
    return (this.prisma as any)[this.model];
  }

  /** Hook to add computed read-only fields (e.g. daysLeft). */
  protected decorate(row: any): any {
    return row;
  }

  protected async resolveMarketRate(
    companyId: string,
    productId?: string | null,
  ): Promise<number> {
    if (!productId) return 0;
    const p = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
      select: { marketRate: true },
    });
    return p ? Number(p.marketRate) : 0;
  }

  /** Name/code → id maps + self-firm list, used to resolve import rows. */
  protected async buildImportLookups(
    companyId: string,
  ): Promise<ImportLookups & { productCodeById: Map<string, string> }> {
    const [parties, products] = await Promise.all([
      this.prisma.party.findMany({
        where: { companyId, deletedAt: null },
        select: { id: true, name: true, isSelf: true },
      }),
      this.prisma.product.findMany({
        where: { companyId, deletedAt: null },
        select: { id: true, code: true },
      }),
    ]);
    const partyByName = new Map(parties.map((p) => [p.name.trim().toLowerCase(), { id: p.id, isSelf: p.isSelf }]));
    const productByCode = new Map(products.map((p) => [p.code.trim().toLowerCase(), { id: p.id }]));
    const productCodeById = new Map(products.map((p) => [p.id, p.code]));
    const selfParties = parties.filter((p) => p.isSelf).map((p) => ({ id: p.id, name: p.name }));
    return { partyByName, productByCode, productCodeById, selfParties };
  }

  /** Build the tenant-scoped where clause from the query filters. */
  protected buildWhere(user: RequestUser, q: DealQueryDto, extraWhere: any = {}) {
    const where: any = {
      companyId: user.companyId,
      deletedAt: null,
      ...extraWhere,
    };
    if (q.status) where.status = q.status;
    if (q.paymentStatus) where.paymentStatus = q.paymentStatus;
    if (q.side && this.hasSide) where.side = q.side;
    if (q.productId) where.productId = q.productId;
    if (q.mainPartyId) where.mainPartyId = q.mainPartyId;
    if (this.hasBrokerMode) {
      if (q.kind) where.kind = q.kind;
      if (q.buyerPartyId) where.buyerPartyId = q.buyerPartyId;
      if (q.sellerPartyId) where.sellerPartyId = q.sellerPartyId;
    }
    if (q.dateFrom || q.dateTo) {
      const range: any = {};
      if (q.dateFrom) range.gte = new Date(q.dateFrom);
      if (q.dateTo) {
        const to = new Date(q.dateTo);
        to.setHours(23, 59, 59, 999); // inclusive end-of-day
        range.lte = to;
      }
      where[this.dateField] = range;
    }
    if (q.search && this.searchFields.length) {
      where.OR = this.searchFields.map((f) => ({
        [f]: { contains: q.search, mode: 'insensitive' },
      }));
    }
    return where;
  }

  /** Whitelisted orderBy (falls back to the default when sortBy isn't allowed). */
  protected buildOrderBy(q: DealQueryDto) {
    const dir = q.sortDir === 'asc' ? 'asc' : 'desc';
    return q.sortBy && this.sortableFields.includes(q.sortBy)
      ? { [q.sortBy]: dir }
      : this.defaultOrderBy;
  }

  async list(user: RequestUser, q: DealQueryDto, extraWhere: any = {}) {
    const where = this.buildWhere(user, q, extraWhere);
    const [items, total] = await Promise.all([
      this.delegate().findMany({
        where,
        include: this.include,
        orderBy: this.buildOrderBy(q),
        skip: q.skip,
        take: q.limit,
      }),
      this.delegate().count({ where }),
    ]);
    return {
      items: items.map((r: any) => this.decorate(r)),
      meta: buildPageMeta(total, q.page, q.limit),
    };
  }

  /** All rows matching the filters (no pagination) — used for export. */
  async exportAll(user: RequestUser, q: DealQueryDto, extraWhere: any = {}) {
    const where = this.buildWhere(user, q, extraWhere);
    const rows = await this.delegate().findMany({
      where,
      include: this.include,
      orderBy: this.buildOrderBy(q),
    });
    return rows.map((r: any) => this.decorate(r));
  }

  async get(user: RequestUser, id: string) {
    const row = await this.delegate().findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: this.include,
    });
    if (!row) throw new NotFoundException(`${this.entityType} not found`);
    return this.decorate(row);
  }

  async remove(user: RequestUser, id: string, ctx: Ctx) {
    await this.get(user, id);
    await this.delegate().update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: user.id },
    });
    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'DELETE',
      entityType: this.entityType,
      entityId: id,
      summary: `Soft-deleted ${this.entityType}`,
      ...ctx,
    });
    return { deleted: true };
  }

  protected async auditWrite(
    user: RequestUser,
    action: 'CREATE' | 'UPDATE',
    id: string,
    summary: string,
    ctx: Ctx,
    diff?: Record<string, unknown>,
  ) {
    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action,
      entityType: this.entityType,
      entityId: id,
      summary,
      diff,
      ...ctx,
    });
  }
}
