import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequestUser } from '../common/types/request-user';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Everything the dashboard needs in a single request. */
  @Get('overview')
  @RequirePermissions('dashboard:read')
  overview(@CurrentUser() user: RequestUser) {
    return this.dashboard.overview(user.companyId);
  }

  @Get('summary')
  @RequirePermissions('dashboard:read')
  summary(@CurrentUser() user: RequestUser) {
    return this.dashboard.summary(user.companyId);
  }

  @Get('product-exposure')
  @RequirePermissions('dashboard:read')
  productExposure(@CurrentUser() user: RequestUser) {
    return this.dashboard.productExposure(user.companyId);
  }

  @Get('daily-mtm')
  @RequirePermissions('dashboard:read')
  dailyMtm(@CurrentUser() user: RequestUser) {
    return this.dashboard.dailyMtm(user.companyId);
  }

  @Get('payment-status')
  @RequirePermissions('dashboard:read')
  paymentStatus(@CurrentUser() user: RequestUser) {
    return this.dashboard.paymentStatus(user.companyId);
  }

  @Get('upcoming-due')
  @RequirePermissions('dashboard:read')
  upcomingDue(@CurrentUser() user: RequestUser) {
    return this.dashboard.upcomingDue(user.companyId);
  }

  @Get('recent-activity')
  @RequirePermissions('dashboard:read')
  recent(@CurrentUser() user: RequestUser) {
    return this.dashboard.recentActivity(user.companyId);
  }
}
