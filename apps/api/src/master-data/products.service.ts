import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  buildPageMeta,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { RequestUser } from '../common/types/request-user';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto,
  UpdateMarketRateDto,
  UpdateProductDto,
} from './dto/product.dto';

export interface Ctx {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: RequestUser, q: PaginationQueryDto) {
    const where: Prisma.ProductWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
    };
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: 'insensitive' } },
        { name: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: q.sortBy ? { [q.sortBy]: q.sortDir } : { code: 'asc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, meta: buildPageMeta(total, q.page, q.limit) };
  }

  async get(user: RequestUser, id: string) {
    const row = await this.prisma.product.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    });
    if (!row) throw new NotFoundException('Product not found');
    return row;
  }

  async create(user: RequestUser, dto: CreateProductDto, ctx: Ctx) {
    const row = await this.prisma.product.create({
      data: {
        companyId: user.companyId,
        code: dto.code,
        name: dto.name,
        unit: dto.unit ?? 'MT',
        marketRate: dto.marketRate ?? 0,
        marketRateUpdatedAt: dto.marketRate != null ? new Date() : null,
        notes: dto.notes,
      },
    });
    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'CREATE',
      entityType: 'Product',
      entityId: row.id,
      summary: `Created product ${row.code} — ${row.name}`,
      ...ctx,
    });
    return row;
  }

  async update(user: RequestUser, id: string, dto: UpdateProductDto, ctx: Ctx) {
    const before = await this.get(user, id);
    const data: Prisma.ProductUpdateInput = { ...dto };
    if (dto.marketRate != null && Number(dto.marketRate) !== Number(before.marketRate)) {
      data.marketRateUpdatedAt = new Date();
    }
    const row = await this.prisma.product.update({ where: { id }, data });
    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'UPDATE',
      entityType: 'Product',
      entityId: id,
      summary: `Updated product ${row.code}`,
      diff: AuditService.diff(before, row),
      ...ctx,
    });
    if (dto.marketRate != null && Number(dto.marketRate) !== Number(before.marketRate)) {
      await this.recomputeMtm(user.companyId, id, Number(dto.marketRate));
    }
    return row;
  }

  /** Set a new market rate and cascade MTM recalculation across all deals. */
  async updateMarketRate(
    user: RequestUser,
    id: string,
    dto: UpdateMarketRateDto,
    ctx: Ctx,
  ) {
    const before = await this.get(user, id);
    const rate = Number(dto.marketRate);
    const row = await this.prisma.product.update({
      where: { id },
      data: { marketRate: rate, marketRateUpdatedAt: new Date() },
    });
    const affected = await this.recomputeMtm(user.companyId, id, rate);
    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'RATE_UPDATE',
      entityType: 'Product',
      entityId: id,
      summary: `Market rate ${before.marketRate} → ${rate} for ${row.code}; recalculated ${affected} deal(s)`,
      ...ctx,
    });
    return { product: row, recalculated: affected };
  }

  /**
   * Recompute stored MTM rollups for all Direct Deals referencing this product:
   *   mtm = (marketRate − rate) × qty   (workbook convention)
   */
  private async recomputeMtm(
    companyId: string,
    productId: string,
    rate: number,
  ): Promise<number> {
    const r = new Prisma.Decimal(rate);
    const affected = await this.prisma.$executeRaw`
      UPDATE "direct_deals"
      SET "marketRate" = ${r},
          "mtm" = (${r} - "rate") * "quantity"
      WHERE "companyId" = ${companyId}
        AND "productId" = ${productId}
        AND "deletedAt" IS NULL`;
    return Number(affected);
  }

  async remove(user: RequestUser, id: string, ctx: Ctx) {
    await this.get(user, id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'DELETE',
      entityType: 'Product',
      entityId: id,
      summary: `Soft-deleted product`,
      ...ctx,
    });
    return { deleted: true };
  }
}
