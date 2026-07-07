import { NotFoundException } from '@nestjs/common';
import { buildPageMeta, Paginated } from '../dto/pagination.dto';

/**
 * Minimal shape every Prisma model delegate exposes. We keep this loosely typed
 * (any) on purpose so a single base can serve every entity while still giving
 * callers strong types at the service layer.
 */
export interface PrismaDelegate {
  findMany: (args?: any) => Promise<any[]>;
  findFirst: (args?: any) => Promise<any | null>;
  count: (args?: any) => Promise<number>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
}

export interface FindAllOptions {
  page: number;
  limit: number;
  skip: number;
  where?: Record<string, any>;
  orderBy?: Record<string, any> | Record<string, any>[];
  include?: Record<string, any>;
  select?: Record<string, any>;
}

/**
 * Tenant-scoped, soft-delete-aware repository base.
 *
 *  • All reads are automatically scoped to `companyId` and exclude soft-deleted
 *    rows unless `withDeleted` is passed.
 *  • Deletes are soft (set `deletedAt`); use `restore` to undo.
 */
export abstract class BaseRepository<T = any> {
  protected constructor(
    protected readonly model: PrismaDelegate,
    protected readonly entityName: string,
  ) {}

  protected tenantWhere(companyId: string, extra?: Record<string, any>) {
    return { companyId, deletedAt: null, ...extra };
  }

  async findAll(
    companyId: string,
    opts: FindAllOptions,
  ): Promise<Paginated<T>> {
    const where = { ...this.tenantWhere(companyId), ...(opts.where ?? {}) };
    const [items, total] = await Promise.all([
      this.model.findMany({
        where,
        orderBy: opts.orderBy ?? { createdAt: 'desc' },
        skip: opts.skip,
        take: opts.limit,
        include: opts.include,
        select: opts.select,
      }),
      this.model.count({ where }),
    ]);
    return { items, meta: buildPageMeta(total, opts.page, opts.limit) };
  }

  async findById(
    companyId: string,
    id: string,
    include?: Record<string, any>,
  ): Promise<T> {
    const row = await this.model.findFirst({
      where: this.tenantWhere(companyId, { id }),
      include,
    });
    if (!row) throw new NotFoundException(`${this.entityName} not found`);
    return row as T;
  }

  async create(data: Record<string, any>): Promise<T> {
    return (await this.model.create({ data })) as T;
  }

  async update(
    companyId: string,
    id: string,
    data: Record<string, any>,
  ): Promise<T> {
    await this.findById(companyId, id); // ensures tenant ownership + existence
    return (await this.model.update({ where: { id }, data })) as T;
  }

  /** Soft delete — never removes the row. */
  async softDelete(companyId: string, id: string): Promise<T> {
    await this.findById(companyId, id);
    return (await this.model.update({
      where: { id },
      data: { deletedAt: new Date() },
    })) as T;
  }

  async restore(companyId: string, id: string): Promise<T> {
    const row = await this.model.findFirst({
      where: { companyId, id },
    });
    if (!row) throw new NotFoundException(`${this.entityName} not found`);
    return (await this.model.update({
      where: { id },
      data: { deletedAt: null },
    })) as T;
  }
}
