import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  DealSide,
  DegumStatus,
  DirectDealKind,
  DirectDealStatus,
  PaymentStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

// ── Direct Deals (Module C) ─────────────────────────────────────────────────
//   Two parties only: Main party (external) + Self firm. `side` is from the
//   Self firm's perspective. Brokerage is per-deal, per-ton.
export class CreateDirectDealDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() date?: string;
  @ApiPropertyOptional({ enum: DirectDealKind, description: 'PRINCIPAL (Self firm) or BROKERAGE (buyer ↔ seller). Defaults to PRINCIPAL.' })
  @IsOptional() @IsEnum(DirectDealKind) kind?: DirectDealKind;
  @ApiPropertyOptional({ enum: DealSide, description: 'Required for PRINCIPAL deals (Self firm perspective); ignored for BROKERAGE.' })
  @IsOptional() @IsEnum(DealSide) side?: DealSide;
  @ApiPropertyOptional({ description: 'Main (external) party — PRINCIPAL only' })
  @IsOptional() @IsString() mainPartyId?: string;
  @ApiPropertyOptional({ description: 'Our own (self) firm — PRINCIPAL only' })
  @IsOptional() @IsString() selfPartyId?: string;
  @ApiPropertyOptional({ description: 'Buyer (external) party — BROKERAGE only' })
  @IsOptional() @IsString() buyerPartyId?: string;
  @ApiPropertyOptional({ description: 'Seller (external) party — BROKERAGE only' })
  @IsOptional() @IsString() sellerPartyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() productId?: string;

  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) quantity!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) rate!: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() marketRate?: number;
  @ApiPropertyOptional({ description: 'Brokerage ₹/MT — PRINCIPAL only' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) brokerageRate?: number;
  @ApiPropertyOptional({ description: 'Buyer-side brokerage ₹/MT — BROKERAGE only' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) buyerBrokerageRate?: number;
  @ApiPropertyOptional({ description: 'Seller-side brokerage ₹/MT — BROKERAGE only' })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sellerBrokerageRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional({ enum: PaymentStatus }) @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() tankerNo?: string;
  @ApiPropertyOptional({ enum: DirectDealStatus }) @IsOptional() @IsEnum(DirectDealStatus) status?: DirectDealStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
}
export class UpdateDirectDealDto extends PartialType(CreateDirectDealDto) {}

// ── Degum Deals (Module D) ──────────────────────────────────────────────────
//   Two parties only: Main party (external) + Self firm (the middle).
export class CreateDegumDealDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() dealDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shipmentMonth?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() originPort?: string;
  @ApiPropertyOptional({ description: 'Main (external) party' })
  @IsOptional() @IsString() mainPartyId?: string;
  @ApiPropertyOptional({ description: 'Our own (self) firm' })
  @IsOptional() @IsString() selfPartyId?: string;

  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) quantity!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) buyRate!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) sellRate!: number;
  @ApiPropertyOptional({ description: 'Brokerage ₹/MT' })
  @IsOptional() @Type(() => Number) @IsNumber() brokerageRate?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() shipNameReceived?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() vessel?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() paymentDueDate?: string;
  @ApiPropertyOptional({ enum: PaymentStatus }) @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
  @ApiPropertyOptional({ enum: DegumStatus }) @IsOptional() @IsEnum(DegumStatus) status?: DegumStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() remarks?: string;
}
export class UpdateDegumDealDto extends PartialType(CreateDegumDealDto) {}

// ── shared query (filters + sorting; sortBy/sortDir/search from PaginationQueryDto) ──
export class DealQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() paymentStatus?: string;
  @ApiPropertyOptional({ description: 'Direct deals only: BUY / SELL' })
  @IsOptional() @IsString() side?: string;
  @ApiPropertyOptional({ enum: DirectDealKind, description: 'Direct deals only: PRINCIPAL / BROKERAGE' })
  @IsOptional() @IsEnum(DirectDealKind) kind?: DirectDealKind;
  @ApiPropertyOptional() @IsOptional() @IsString() productId?: string;
  @ApiPropertyOptional({ description: 'Filter by Main party id' })
  @IsOptional() @IsString() mainPartyId?: string;
  @ApiPropertyOptional({ description: 'Broker deals only: filter by Buyer party id' })
  @IsOptional() @IsString() buyerPartyId?: string;
  @ApiPropertyOptional({ description: 'Broker deals only: filter by Seller party id' })
  @IsOptional() @IsString() sellerPartyId?: string;
  @ApiPropertyOptional({ description: 'Deal date from (inclusive)' })
  @IsOptional() @IsDateString() dateFrom?: string;
  @ApiPropertyOptional({ description: 'Deal date to (inclusive)' })
  @IsOptional() @IsDateString() dateTo?: string;
}
