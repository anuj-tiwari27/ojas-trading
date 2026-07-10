import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import {
  buildPageMeta,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { RequestUser } from '../common/types/request-user';
import { PrismaService } from '../prisma/prisma.service';
import { AssignRolesDto, CreateUserDto, UpdateUserDto } from './dto/user.dto';

const SAFE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  isActive: true,
  isSuperAdmin: true,
  branchId: true,
  lastLoginAt: true,
  createdAt: true,
  roles: { include: { role: true } },
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async list(user: RequestUser, q: PaginationQueryDto) {
    const where: any = { companyId: user.companyId, deletedAt: null };
    if (q.search) {
      where.OR = [
        { fullName: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: SAFE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, meta: buildPageMeta(total, q.page, q.limit) };
  }

  async get(user: RequestUser, id: string) {
    const row = await this.prisma.user.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      select: SAFE_SELECT,
    });
    if (!row) throw new NotFoundException('User not found');
    return row;
  }

  async create(user: RequestUser, dto: CreateUserDto) {
    const passwordHash = await argon2.hash(dto.password);
    const created = await this.prisma.user.create({
      data: {
        companyId: user.companyId,
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        branchId: dto.branchId,
        roles: {
          create: dto.roleIds.map((roleId) => ({ roleId })),
        },
      },
      select: SAFE_SELECT,
    });
    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'CREATE',
      entityType: 'User',
      entityId: created.id,
      summary: `Created user ${dto.email}`,
    });
    return created;
  }

  async update(user: RequestUser, id: string, dto: UpdateUserDto) {
    await this.get(user, id);
    const data: any = {
      fullName: dto.fullName,
      phone: dto.phone,
      branchId: dto.branchId,
      isActive: dto.isActive,
    };
    if (dto.password) data.passwordHash = await argon2.hash(dto.password);
    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: SAFE_SELECT,
    });
    this.auth.invalidateUser(id); // isActive may have changed
    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      summary: `Updated user`,
    });
    return updated;
  }

  async assignRoles(user: RequestUser, id: string, dto: AssignRolesDto) {
    await this.get(user, id);
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
        skipDuplicates: true,
      }),
    ]);
    this.auth.invalidateUser(id); // permissions changed → drop cached context
    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'PERMISSION_CHANGE',
      entityType: 'User',
      entityId: id,
      summary: `Reassigned roles`,
    });
    return this.get(user, id);
  }

  async deactivate(user: RequestUser, id: string) {
    await this.get(user, id);
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
    this.auth.invalidateUser(id); // revoke cached access immediately
    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'DELETE',
      entityType: 'User',
      entityId: id,
      summary: `Deactivated user`,
    });
    return { deactivated: true };
  }

  async listRoles(user: RequestUser) {
    return this.prisma.role.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }
}
