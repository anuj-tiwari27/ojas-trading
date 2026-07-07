import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateCompanyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() legalName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gstin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pincode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;

  @ApiPropertyOptional({ description: 'FY start month (1=Jan … 4=Apr)', minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  financialYearStartMonth?: number;
}

export class UpdateNumberSequenceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() prefix?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10)
  padding?: number;

  @ApiPropertyOptional({ description: 'Next number to issue', minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  nextValue?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  resetYearly?: boolean;
}

export class UpsertSettingDto {
  @ApiPropertyOptional({ description: 'Arbitrary JSON value for this setting section' })
  @IsObject()
  value!: Record<string, any>;
}
