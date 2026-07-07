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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequestUser } from '../common/types/request-user';
import { DegumDealService, DirectDealService } from './deals.service';
import { buildDealWorkbook } from './deals-io';
import {
  CreateDegumDealDto,
  CreateDirectDealDto,
  DealQueryDto,
  UpdateDegumDealDto,
  UpdateDirectDealDto,
} from './dto/deals.dto';

function ctx(req: Request) {
  return {
    ipAddress: (req.headers['x-forwarded-for'] as string) ?? req.ip,
    userAgent: req.headers['user-agent'],
  };
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function sendWorkbook(res: Response, buf: Buffer, filename: string) {
  res.set({
    'Content-Type': XLSX_MIME,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': String(buf.length),
  });
  res.end(buf);
}

@ApiTags('Deals — Direct Deals')
@ApiBearerAuth()
@Controller('direct-deals')
export class DirectDealController {
  constructor(private readonly svc: DirectDealService) {}
  @Get() @RequirePermissions('directdeal:read')
  list(@CurrentUser() u: RequestUser, @Query() q: DealQueryDto) { return this.svc.list(u, q); }

  @Get('export') @RequirePermissions('directdeal:read')
  async export(@CurrentUser() u: RequestUser, @Query() q: DealQueryDto, @Res() res: Response) {
    const rows = await this.svc.exportAll(u, q);
    sendWorkbook(res, buildDealWorkbook('direct', rows), 'direct-deals.xlsx');
  }

  @Post('import') @RequirePermissions('directdeal:create')
  @UseInterceptors(FileInterceptor('file'))
  import(@CurrentUser() u: RequestUser, @UploadedFile() file: any, @Req() r: Request) {
    return this.svc.importFile(u, file?.buffer, ctx(r));
  }

  @Get(':id') @RequirePermissions('directdeal:read')
  get(@Param('id') id: string, @CurrentUser() u: RequestUser) { return this.svc.get(u, id); }
  @Post() @RequirePermissions('directdeal:create')
  create(@CurrentUser() u: RequestUser, @Body() dto: CreateDirectDealDto, @Req() r: Request) { return this.svc.create(u, dto, ctx(r)); }
  @Patch(':id') @RequirePermissions('directdeal:update')
  update(@Param('id') id: string, @CurrentUser() u: RequestUser, @Body() dto: UpdateDirectDealDto, @Req() r: Request) { return this.svc.update(u, id, dto, ctx(r)); }
  @Delete(':id') @RequirePermissions('directdeal:delete')
  remove(@Param('id') id: string, @CurrentUser() u: RequestUser, @Req() r: Request) { return this.svc.remove(u, id, ctx(r)); }
}

@ApiTags('Deals — Degum Deals')
@ApiBearerAuth()
@Controller('degum-deals')
export class DegumDealController {
  constructor(private readonly svc: DegumDealService) {}
  @Get() @RequirePermissions('degum:read')
  list(@CurrentUser() u: RequestUser, @Query() q: DealQueryDto) { return this.svc.list(u, q); }

  @Get('export') @RequirePermissions('degum:read')
  async export(@CurrentUser() u: RequestUser, @Query() q: DealQueryDto, @Res() res: Response) {
    const rows = await this.svc.exportAll(u, q);
    sendWorkbook(res, buildDealWorkbook('degum', rows), 'degum-deals.xlsx');
  }

  @Post('import') @RequirePermissions('degum:create')
  @UseInterceptors(FileInterceptor('file'))
  import(@CurrentUser() u: RequestUser, @UploadedFile() file: any, @Req() r: Request) {
    return this.svc.importFile(u, file?.buffer, ctx(r));
  }

  @Get(':id') @RequirePermissions('degum:read')
  get(@Param('id') id: string, @CurrentUser() u: RequestUser) { return this.svc.get(u, id); }
  @Post() @RequirePermissions('degum:create')
  create(@CurrentUser() u: RequestUser, @Body() dto: CreateDegumDealDto, @Req() r: Request) { return this.svc.create(u, dto, ctx(r)); }
  @Patch(':id') @RequirePermissions('degum:update')
  update(@Param('id') id: string, @CurrentUser() u: RequestUser, @Body() dto: UpdateDegumDealDto, @Req() r: Request) { return this.svc.update(u, id, dto, ctx(r)); }
  @Delete(':id') @RequirePermissions('degum:delete')
  remove(@Param('id') id: string, @CurrentUser() u: RequestUser, @Req() r: Request) { return this.svc.remove(u, id, ctx(r)); }
}
