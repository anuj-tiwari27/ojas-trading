import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import {
  buildPageMeta,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { RequestUser } from '../common/types/request-user';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('audit:read')
  async list(
    @CurrentUser() user: RequestUser,
    @Query() q: PaginationQueryDto,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
  ) {
    const where: Record<string, any> = { companyId: user.companyId };
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, meta: buildPageMeta(total, q.page, q.limit) };
  }
}
