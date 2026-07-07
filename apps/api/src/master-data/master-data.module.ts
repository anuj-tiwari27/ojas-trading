import { Module } from '@nestjs/common';
import { MasterCrudService } from './master-crud.service';
import { PartiesController } from './parties.controller';
import { PartiesService } from './parties.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [PartiesController, ProductsController],
  providers: [MasterCrudService, PartiesService, ProductsService],
  exports: [MasterCrudService, PartiesService, ProductsService],
})
export class MasterDataModule {}
