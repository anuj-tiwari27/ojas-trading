import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequestUser } from '../common/types/request-user';
import { AnalyticsService } from './analytics.service';

@ApiTags('Position & Analytics')
@ApiBearerAuth()
@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('trading-desk')
  @RequirePermissions('position:read')
  tradingDesk(@CurrentUser() user: RequestUser) {
    return this.analytics.tradingDesk(user.companyId);
  }
}
