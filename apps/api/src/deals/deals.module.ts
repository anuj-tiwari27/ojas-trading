import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { DegumDealController, DirectDealController } from './deals.controller';
import { DegumDealService, DirectDealService } from './deals.service';

@Module({
  controllers: [DirectDealController, DegumDealController, AnalyticsController],
  providers: [DirectDealService, DegumDealService, AnalyticsService],
  exports: [AnalyticsService],
})
export class DealsModule {}
