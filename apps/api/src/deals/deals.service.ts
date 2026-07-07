import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/types/request-user';
import { NumberingService } from '../numbering/numbering.service';
import { PrismaService } from '../prisma/prisma.service';
import { Ctx, daysLeft, DealBaseService } from './deal-base.service';
import {
  parseWorkbook,
  requiredHeaders,
  resolveImportRows,
  SPEC_DEGUM,
  SPEC_DIRECT,
} from './deals-io';
import {
  CreateDegumDealDto,
  CreateDirectDealDto,
  UpdateDegumDealDto,
  UpdateDirectDealDto,
} from './dto/deals.dto';

const r4 = (n: number) => Number(n.toFixed(4));
const r3 = (n: number) => Number(n.toFixed(3));

// ═══════════════════════════════════════════════════════════════════════════
//  Module C — Direct Deals
//   Two parties: Main party (external) + Self firm.
//   Value = qty × rate; MTM = (marketRate − rate) × qty; Brokerage = qty × ₹/MT
// ═══════════════════════════════════════════════════════════════════════════
@Injectable()
export class DirectDealService extends DealBaseService {
  protected model = 'directDeal';
  protected entityType = 'DirectDeal';
  protected searchFields = ['dealNo', 'tankerNo', 'remarks'];
  protected include = { mainParty: true, selfParty: true, product: true };
  protected defaultOrderBy = { createdAt: 'desc' as const }; // latest created on top
  protected dateField = 'date';
  protected hasSide = true;
  protected sortableFields = ['dealNo', 'date', 'side', 'quantity', 'rate', 'value', 'marketRate', 'mtm', 'brokerageRate', 'brokerageTotal', 'dueDate', 'paymentStatus', 'status', 'createdAt'];

  constructor(prisma: PrismaService, audit: AuditService, numbering: NumberingService) {
    super(prisma, audit, numbering);
  }

  protected decorate(row: any) {
    return { ...row, daysLeft: daysLeft(row.dueDate) };
  }

  /**
   * Net on-hand (MT) held by a Self firm for one commodity = Σ Direct BUY − Σ Direct SELL.
   * (Degum is back-to-back — its buy leg is sold onward the same instant, so it holds nothing.)
   */
  private async netOnHand(
    companyId: string,
    selfPartyId: string,
    productId: string,
    excludeDealId?: string,
    client: any = this.prisma,
  ): Promise<number> {
    const rows = await client.directDeal.findMany({
      where: {
        companyId,
        deletedAt: null,
        selfPartyId,
        productId,
        ...(excludeDealId ? { id: { not: excludeDealId } } : {}),
      },
      select: { side: true, quantity: true },
    });
    return rows.reduce((n: number, r: any) => n + (r.side === 'BUY' ? 1 : -1) * Number(r.quantity), 0);
  }

  /** Block a Self SELL that would exceed on-hand stock (no overselling / negative holdings). */
  private async assertCanSell(
    companyId: string,
    selfPartyId: string | null | undefined,
    productId: string | null | undefined,
    qty: number,
    excludeDealId?: string,
  ) {
    if (!selfPartyId || !productId) return; // can't assess stock without both — skip
    const available = await this.netOnHand(companyId, selfPartyId, productId, excludeDealId);
    if (qty > available + 1e-6) {
      const product = await this.prisma.product.findFirst({
        where: { id: productId, companyId },
        select: { code: true },
      });
      const code = product?.code ?? 'this commodity';
      throw new BadRequestException(
        `Cannot sell ${r3(qty)} MT of ${code} — only ${r3(available)} MT on hand for this self firm. ` +
          `Record the purchase first, then sell.`,
      );
    }
  }

  async create(user: RequestUser, dto: CreateDirectDealDto, ctx: Ctx) {
    if (dto.side === 'SELL') {
      await this.assertCanSell(user.companyId, dto.selfPartyId, dto.productId, dto.quantity);
    }
    const marketRate = dto.marketRate ?? (await this.resolveMarketRate(user.companyId, dto.productId));
    const brokerageRate = dto.brokerageRate ?? 0;
    const value = r4(dto.quantity * dto.rate);
    const mtm = r4((marketRate - dto.rate) * dto.quantity);
    const brokerageTotal = r4(dto.quantity * brokerageRate);
    const row = await this.prisma.$transaction(async (tx) => {
      const dealNo = await this.numbering.next(user.companyId, 'DIRECT', tx);
      return tx.directDeal.create({
        data: {
          companyId: user.companyId,
          dealNo,
          date: dto.date ? new Date(dto.date) : new Date(),
          side: dto.side,
          mainPartyId: dto.mainPartyId ?? null,
          selfPartyId: dto.selfPartyId ?? null,
          productId: dto.productId ?? null,
          quantity: dto.quantity,
          rate: dto.rate,
          value,
          marketRate,
          mtm,
          brokerageRate,
          brokerageTotal,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          paymentStatus: dto.paymentStatus ?? 'PENDING',
          tankerNo: dto.tankerNo ?? null,
          status: dto.status ?? 'OPEN',
          remarks: dto.remarks ?? null,
          createdById: user.id,
          updatedById: user.id,
        },
      });
    });
    await this.auditWrite(user, 'CREATE', row.id, `Created direct deal ${row.dealNo}`, ctx);
    return this.get(user, row.id);
  }

  async update(user: RequestUser, id: string, dto: UpdateDirectDealDto, ctx: Ctx) {
    const before = await this.get(user, id);
    const qty = dto.quantity ?? Number(before.quantity);
    const rate = dto.rate ?? Number(before.rate);
    const marketRate = dto.marketRate ?? Number(before.marketRate);
    const brokerageRate = dto.brokerageRate ?? Number(before.brokerageRate);
    // Overselling guard on the resulting deal (exclude this deal from the on-hand tally).
    const side = dto.side ?? before.side;
    if (side === 'SELL') {
      const selfPartyId = dto.selfPartyId ?? before.selfPartyId;
      const productId = dto.productId ?? before.productId;
      await this.assertCanSell(user.companyId, selfPartyId, productId, qty, id);
    }
    const row = await this.prisma.directDeal.update({
      where: { id },
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        marketRate,
        value: r4(qty * rate),
        mtm: r4((marketRate - rate) * qty),
        brokerageRate,
        brokerageTotal: r4(qty * brokerageRate),
        updatedById: user.id,
      },
    });
    await this.auditWrite(user, 'UPDATE', id, `Updated direct deal ${before.dealNo}`, ctx, AuditService.diff(before, row));
    return this.get(user, id);
  }

  /**
   * Bulk-create Direct deals from a parsed spreadsheet. All-or-nothing:
   * the whole file is validated first, then inserted in ONE transaction that
   * honours every rule (numbering, computed rollups, and the overselling guard
   * evaluated against running on-hand within the transaction). Any error →
   * nothing is imported.
   */
  async importFile(user: RequestUser, buffer: Buffer | undefined, ctx: Ctx) {
    if (!buffer || !buffer.length) throw new BadRequestException('No file uploaded.');
    const { headers, rows } = parseWorkbook(buffer);
    if (!rows.length) throw new BadRequestException('The file has no data rows.');
    const missing = requiredHeaders('direct').filter(
      (h) => !headers.some((x) => x.trim().toLowerCase() === h.toLowerCase()),
    );
    if (missing.length) throw new BadRequestException(`Missing required column(s): ${missing.join(', ')}`);

    const lk = await this.buildImportLookups(user.companyId);
    const { records, errors } = resolveImportRows(SPEC_DIRECT, headers, rows, lk);
    if (errors.length) {
      throw new BadRequestException({ message: `Import failed — ${errors.length} problem(s) found. Nothing was imported.`, errors });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const rowNo = i + 2;
        const quantity = Number(rec.quantity);
        const rate = Number(rec.rate);
        const marketRate = rec.marketRate != null ? Number(rec.marketRate) : await this.resolveMarketRate(user.companyId, rec.productId);
        const brokerageRate = rec.brokerageRate != null ? Number(rec.brokerageRate) : 0;
        if (rec.side === 'SELL') {
          const avail = await this.netOnHand(user.companyId, rec.selfPartyId, rec.productId, undefined, tx);
          if (quantity > avail + 1e-6) {
            const code = lk.productCodeById.get(rec.productId) ?? 'this commodity';
            throw new BadRequestException(
              `Row ${rowNo}: cannot sell ${r3(quantity)} MT of ${code} — only ${r3(avail)} MT on hand at this point in the file. Nothing was imported.`,
            );
          }
        }
        const dealNo = await this.numbering.next(user.companyId, 'DIRECT', tx);
        const row = await tx.directDeal.create({
          data: {
            companyId: user.companyId,
            dealNo,
            date: rec.date ? new Date(rec.date) : new Date(),
            side: rec.side,
            mainPartyId: rec.mainPartyId ?? null,
            selfPartyId: rec.selfPartyId ?? null,
            productId: rec.productId ?? null,
            quantity,
            rate,
            value: r4(quantity * rate),
            marketRate,
            mtm: r4((marketRate - rate) * quantity),
            brokerageRate,
            brokerageTotal: r4(quantity * brokerageRate),
            dueDate: rec.dueDate ? new Date(rec.dueDate) : null,
            paymentStatus: rec.paymentStatus ?? 'PENDING',
            status: rec.status ?? 'OPEN',
            remarks: rec.remarks ?? null,
            createdById: user.id,
            updatedById: user.id,
          },
        });
        ids.push(row.id);
      }
      return ids;
    });

    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'IMPORT',
      entityType: 'DirectDeal',
      summary: `Imported ${created.length} direct deal(s)`,
      ...ctx,
    });
    return { imported: created.length };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Module D — Degum Deals
//   Two parties: Main party (external) + Self firm (the middle).
// ═══════════════════════════════════════════════════════════════════════════
@Injectable()
export class DegumDealService extends DealBaseService {
  protected model = 'degumDeal';
  protected entityType = 'DegumDeal';
  protected searchFields = ['dealNo', 'vessel', 'originPort', 'shipmentMonth', 'remarks'];
  protected include = { mainParty: true, selfParty: true, product: true };
  protected defaultOrderBy = { createdAt: 'desc' as const }; // latest created on top
  protected dateField = 'dealDate';
  protected sortableFields = ['dealNo', 'dealDate', 'quantity', 'buyRate', 'sellRate', 'buyValue', 'sellValue', 'grossMargin', 'brokerageRate', 'brokerageTotal', 'paymentDueDate', 'paymentStatus', 'status', 'shipmentMonth', 'originPort', 'vessel', 'createdAt'];

  constructor(prisma: PrismaService, audit: AuditService, numbering: NumberingService) {
    super(prisma, audit, numbering);
  }

  protected decorate(row: any) {
    return { ...row, daysLeft: daysLeft(row.paymentDueDate) };
  }

  private compute(qty: number, buyRate: number, sellRate: number, brokerageRate: number) {
    const buyValue = r4(qty * buyRate);
    const sellValue = r4(qty * sellRate);
    return {
      buyValue,
      sellValue,
      grossMargin: r4(sellValue - buyValue),
      brokerageTotal: r4(qty * brokerageRate),
    };
  }

  async create(user: RequestUser, dto: CreateDegumDealDto, ctx: Ctx) {
    const f = this.compute(dto.quantity, dto.buyRate, dto.sellRate, dto.brokerageRate ?? 0);
    const row = await this.prisma.$transaction(async (tx) => {
      const dealNo = await this.numbering.next(user.companyId, 'DEGUM', tx);
      return tx.degumDeal.create({
        data: {
          companyId: user.companyId,
          dealNo,
          dealDate: dto.dealDate ? new Date(dto.dealDate) : new Date(),
          productId: dto.productId ?? null,
          shipmentMonth: dto.shipmentMonth ?? null,
          originPort: dto.originPort ?? null,
          mainPartyId: dto.mainPartyId ?? null,
          selfPartyId: dto.selfPartyId ?? null,
          quantity: dto.quantity,
          buyRate: dto.buyRate,
          sellRate: dto.sellRate,
          brokerageRate: dto.brokerageRate ?? 0,
          ...f,
          shipNameReceived: dto.shipNameReceived ?? false,
          vessel: dto.vessel ?? null,
          paymentDueDate: dto.paymentDueDate ? new Date(dto.paymentDueDate) : null,
          paymentStatus: dto.paymentStatus ?? 'PENDING',
          status: dto.status ?? 'OPEN',
          remarks: dto.remarks ?? null,
          createdById: user.id,
          updatedById: user.id,
        },
      });
    });
    await this.auditWrite(user, 'CREATE', row.id, `Created degum deal ${row.dealNo}`, ctx);
    return this.get(user, row.id);
  }

  async update(user: RequestUser, id: string, dto: UpdateDegumDealDto, ctx: Ctx) {
    const before = await this.get(user, id);
    const qty = dto.quantity ?? Number(before.quantity);
    const buyRate = dto.buyRate ?? Number(before.buyRate);
    const sellRate = dto.sellRate ?? Number(before.sellRate);
    const brokerageRate = dto.brokerageRate ?? Number(before.brokerageRate);
    const f = this.compute(qty, buyRate, sellRate, brokerageRate);
    const row = await this.prisma.degumDeal.update({
      where: { id },
      data: {
        ...dto,
        dealDate: dto.dealDate ? new Date(dto.dealDate) : undefined,
        paymentDueDate: dto.paymentDueDate ? new Date(dto.paymentDueDate) : undefined,
        ...f,
        updatedById: user.id,
      },
    });
    await this.auditWrite(user, 'UPDATE', id, `Updated degum deal ${before.dealNo}`, ctx, AuditService.diff(before, row));
    return this.get(user, id);
  }

  /** Bulk-create Degum deals from a parsed spreadsheet (validate-all then insert in one tx). */
  async importFile(user: RequestUser, buffer: Buffer | undefined, ctx: Ctx) {
    if (!buffer || !buffer.length) throw new BadRequestException('No file uploaded.');
    const { headers, rows } = parseWorkbook(buffer);
    if (!rows.length) throw new BadRequestException('The file has no data rows.');
    const missing = requiredHeaders('degum').filter(
      (h) => !headers.some((x) => x.trim().toLowerCase() === h.toLowerCase()),
    );
    if (missing.length) throw new BadRequestException(`Missing required column(s): ${missing.join(', ')}`);

    const lk = await this.buildImportLookups(user.companyId);
    const { records, errors } = resolveImportRows(SPEC_DEGUM, headers, rows, lk);
    if (errors.length) {
      throw new BadRequestException({ message: `Import failed — ${errors.length} problem(s) found. Nothing was imported.`, errors });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const rec of records) {
        const quantity = Number(rec.quantity);
        const buyRate = Number(rec.buyRate);
        const sellRate = Number(rec.sellRate);
        const brokerageRate = rec.brokerageRate != null ? Number(rec.brokerageRate) : 0;
        const buyValue = r4(quantity * buyRate);
        const sellValue = r4(quantity * sellRate);
        const dealNo = await this.numbering.next(user.companyId, 'DEGUM', tx);
        const row = await tx.degumDeal.create({
          data: {
            companyId: user.companyId,
            dealNo,
            dealDate: rec.dealDate ? new Date(rec.dealDate) : new Date(),
            productId: rec.productId ?? null,
            shipmentMonth: rec.shipmentMonth ?? null,
            originPort: rec.originPort ?? null,
            mainPartyId: rec.mainPartyId ?? null,
            selfPartyId: rec.selfPartyId ?? null,
            quantity,
            buyRate,
            sellRate,
            buyValue,
            sellValue,
            grossMargin: r4(sellValue - buyValue),
            brokerageRate,
            brokerageTotal: r4(quantity * brokerageRate),
            shipNameReceived: !!rec.shipNameReceived,
            vessel: rec.vessel ?? null,
            paymentDueDate: rec.paymentDueDate ? new Date(rec.paymentDueDate) : null,
            paymentStatus: rec.paymentStatus ?? 'PENDING',
            status: rec.status ?? 'OPEN',
            remarks: rec.remarks ?? null,
            createdById: user.id,
            updatedById: user.id,
          },
        });
        ids.push(row.id);
      }
      return ids;
    });

    await this.audit.record({
      companyId: user.companyId,
      actorId: user.id,
      action: 'IMPORT',
      entityType: 'DegumDeal',
      summary: `Imported ${created.length} degum deal(s)`,
      ...ctx,
    });
    return { imported: created.length };
  }
}
