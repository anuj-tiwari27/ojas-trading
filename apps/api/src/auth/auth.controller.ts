import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequestUser } from '../common/types/request-user';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private ctx(req: Request) {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, this.ctx(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, this.ctx(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
    return { loggedOut: true };
  }

  // no-store so the browser never serves a cached /auth/me (a stale 304 lets the
  // route guard think an expired session is valid → dashboard⇄login redirect loop).
  @ApiBearerAuth()
  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@CurrentUser() user: RequestUser) {
    return user;
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { changed: true };
  }
}
