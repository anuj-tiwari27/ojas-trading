import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequestUser } from '../common/types/request-user';
import {
  UpdateCompanyDto,
  UpdateNumberSequenceDto,
  UpsertSettingDto,
} from './dto/settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  private ctx(req: Request) {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  // Company + financial year
  @Get('company')
  @RequirePermissions('settings:read')
  getCompany(@CurrentUser() user: RequestUser) {
    return this.settings.getCompany(user);
  }

  @Patch('company')
  @RequirePermissions('settings:update')
  updateCompany(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateCompanyDto,
    @Req() req: Request,
  ) {
    return this.settings.updateCompany(user, dto, this.ctx(req));
  }

  // Document numbering
  @Get('number-sequences')
  @RequirePermissions('settings:read')
  listSequences(@CurrentUser() user: RequestUser) {
    return this.settings.listNumberSequences(user);
  }

  @Patch('number-sequences/:key')
  @RequirePermissions('settings:update')
  updateSequence(
    @Param('key') key: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateNumberSequenceDto,
    @Req() req: Request,
  ) {
    return this.settings.updateNumberSequence(user, key.toUpperCase(), dto, this.ctx(req));
  }

  // Generic JSON sections: tax / templates / branding / notifications
  @Get()
  @RequirePermissions('settings:read')
  all(@CurrentUser() user: RequestUser) {
    return this.settings.getAllSettings(user);
  }

  @Get('section/:key')
  @RequirePermissions('settings:read')
  getSection(@Param('key') key: string, @CurrentUser() user: RequestUser) {
    return this.settings.getSetting(user, key);
  }

  @Put('section/:key')
  @RequirePermissions('settings:update')
  putSection(
    @Param('key') key: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpsertSettingDto,
    @Req() req: Request,
  ) {
    return this.settings.putSetting(user, key, dto, this.ctx(req));
  }
}
