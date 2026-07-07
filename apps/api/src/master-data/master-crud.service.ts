import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import {
  buildPageMeta,
  Paginated,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { RequestUser } from '../common/types/request-user';
import { PrismaService } from '../prisma/prisma.service';

export interface CrudContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Generic, tenant-scoped, soft-delete + audit-aware CRUD engine used by every
 * master-data resource. The Prisma model name and its searchable text fields
 * are passed per call, so one service powers all lookups consistently.
 */
@Injectable()
export class MasterCrudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private delegate(model: string): any {
    const d = (this.prisma as any)[model];
    if (!d) throw new NotFoundException(`Unknown resource "${model}"`);
    return d;
  }

  async list(
    model: string,
    user: RequestUser,
    q: PaginationQueryDto,
    searchable: string[],
    include?: Record<string, any>,
  ): Promise<Paginated<any>> {
    const where: Record<string, any> = {
      companyId: user.companyId,
      deletedAt: null,
    };
    if (q.search && searchable.length) {
      where.OR = searchable.map((f) => ({
        [f]: { contains: q.search, mode: 'insensitive' },
      }));
    }
    const orderBy = q.sortBy
      ? { [q.sortBy]: q.sortDir }
      : { createdAt: 'desc' };

    const delegate = this.delegate(model);
    const [items, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy,
        skip: q.skip,
        take: q.limit,
        include,
      }),
      delegate.count({ where }),
    ]);
    return { items, meta: buildPageMeta(total, q.page, q.limit) };
  }

  async get(
    model: string,
    user: RequestUser,
    id: string,
    include?: Record<string, any>,
  ) {
    const row = await this.delegate(model).findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include,
    });
    if (!row) throw new NotFoundException(`${model} not found`);
    return row;
  }

  async create(
    model: string,
    entityType: string,
    user: RequestUser,
    data: Record<string, any>,
    ctx: CrudContext,
  ) {
    const row = await this.delegate(model).create({
      data: { ...data, companyId: user.companyId },
    });
    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'CREATE',
      entityType,
      entityId: row.id,
      summary: `Created ${entityType} ${row.name ?? row.code ?? row.id}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return row;
  }

  async update(
    model: string,
    entityType: string,
    user: RequestUser,
    id: string,
    data: Record<string, any>,
    ctx: CrudContext,
  ) {
    const before = await this.get(model, user, id);
    const row = await this.delegate(model).update({
      where: { id },
      data,
    });
    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'UPDATE',
      entityType,
      entityId: id,
      summary: `Updated ${entityType}`,
      diff: AuditService.diff(before, row),
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return row;
  }

  async remove(
    model: string,
    entityType: string,
    user: RequestUser,
    id: string,
    ctx: CrudContext,
  ) {
    await this.get(model, user, id);
    const row = await this.delegate(model).update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'DELETE',
      entityType,
      entityId: id,
      summary: `Soft-deleted ${entityType}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return row;
  }
}
