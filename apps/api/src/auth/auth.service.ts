import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/types/request-user';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, isActive: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(email: string, password: string, ctx: LoginContext) {
    const user = await this.validateUser(email, password);
    const tokens = await this.issueTokens(
      user.id,
      user.companyId,
      user.email,
      ctx,
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      summary: `${user.email} logged in`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    const profile = await this.buildRequestUser(user.id);
    return { ...tokens, user: profile };
  }

  async issueTokens(
    userId: string,
    companyId: string,
    email: string,
    ctx: LoginContext,
  ): Promise<AuthTokens> {
    const payload = { sub: userId, companyId, email };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessTtl') as any,
    });
    // refresh token = random opaque id signed; we store only its hash
    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { ...payload, jti },
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshTtl') as any,
      },
    );
    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string, ctx: LoginContext): Promise<AuthTokens> {
    let payload: { sub: string; companyId: string; email: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(refreshToken) },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }
    // rotate: revoke the old, issue a new pair
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(payload.sub, payload.companyId, payload.email, ctx);
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const ok = await argon2.verify(user.passwordHash, currentPassword);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    // revoke all sessions on password change
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      companyId: user.companyId,
      actorId: userId,
      action: 'PASSWORD_CHANGE',
      entityType: 'User',
      entityId: userId,
      summary: 'Password changed',
    });
  }

  /** Loads a user with roles + flattened permission keys for the request ctx. */
  async buildRequestUser(userId: string): Promise<RequestUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    if (!user) return null;

    const roleKeys: string[] = [];
    const permKeys = new Set<string>();
    for (const ur of user.roles) {
      roleKeys.push(ur.role.key);
      for (const rp of ur.role.permissions) permKeys.add(rp.permission.key);
    }
    return {
      id: user.id,
      email: user.email,
      companyId: user.companyId,
      branchId: user.branchId,
      isSuperAdmin: user.isSuperAdmin,
      roles: roleKeys,
      permissions: [...permKeys],
    };
  }
}
