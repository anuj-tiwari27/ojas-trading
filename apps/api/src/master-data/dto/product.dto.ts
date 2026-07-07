import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'CDSBO' })
  @IsString()
  @MaxLength(32)
  code!: string;

  @ApiProperty({ example: 'Crude Degummed SBO' })
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ default: 'MT' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ description: 'Current market rate ₹/MT' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  marketRate?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class UpdateMarketRateDto {
  @ApiProperty({ description: 'New market rate ₹/MT — recalculates MTM everywhere' })
  @Type(() => Number)
  @IsNumber()
  marketRate!: number;
}
