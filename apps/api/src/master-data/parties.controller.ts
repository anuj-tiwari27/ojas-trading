import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequestUser } from '../common/types/request-user';
import { CreatePartyDto, PartyQueryDto, UpdatePartyDto } from './dto/party.dto';
import { PartiesService } from './parties.service';

@ApiTags('Master Data — Parties')
@ApiBearerAuth()
@Controller('parties')
export class PartiesController {
  constructor(private readonly parties: PartiesService) {}

  private ctx(req: Request) {
    return {
      ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  @Get()
  @RequirePermissions('party:read')
  list(@CurrentUser() user: RequestUser, @Query() q: PartyQueryDto) {
    return this.parties.list(user, q, q.type, q.isSelf);
  }

  @Get(':id')
  @RequirePermissions('party:read')
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.parties.get(user, id);
  }

  @Post()
  @RequirePermissions('party:create')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePartyDto, @Req() req: Request) {
    return this.parties.create(user, dto, this.ctx(req));
  }

  @Patch(':id')
  @RequirePermissions('party:update')
  update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdatePartyDto,
    @Req() req: Request,
  ) {
    return this.parties.update(user, id, dto, this.ctx(req));
  }

  @Delete(':id')
  @RequirePermissions('party:delete')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser, @Req() req: Request) {
    return this.parties.remove(user, id, this.ctx(req));
  }
}
