import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const num = (v: any) => Number(v ?? 0);

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All dashboard data in ONE response. The six queries run in parallel
   * server-side (fast, intra-region), so the browser makes a single
   * round-trip instead of six — a big win on high-latency links.
   */
  async overview(companyId: string) {
    const [summary, exposure, mtm, paymentStatus, upcoming, recent] = await Promise.all([
      this.summary(companyId),
      this.productExposure(companyId),
      this.dailyMtm(companyId),
      this.paymentStatus(companyId),
      this.upcomingDue(companyId),
      this.recentActivity(companyId),
    ]);
    return { summary, exposure, mtm, paymentStatus, upcoming, recent };
  }

  /** Module A headline KPIs (Direct + Degum deals only). */
  async summary(companyId: string) {
    const base = { companyId, deletedAt: null };
    const [directAgg, degumAgg, openDirect, openDegum] = await Promise.all([
      this.prisma.directDeal.aggregate({
        where: base,
        _sum: { value: true, mtm: true, brokerageTotal: true },
      }),
      this.prisma.degumDeal.aggregate({
        where: base,
        _sum: { buyValue: true, sellValue: true, brokerageTotal: true },
      }),
      this.prisma.directDeal.count({ where: { ...base, status: 'OPEN' } }),
      this.prisma.degumDeal.count({ where: { ...base, status: { in: ['OPEN', 'SHIPMENT_CONFIRMED'] } } }),
    ]);

    const now = new Date();
    const [pendingPayDirect, pendingPayDegum, overdueDirect, overdueDegum] = await Promise.all([
      this.prisma.directDeal.count({ where: { ...base, paymentStatus: { not: 'PAID' } } }),
      this.prisma.degumDeal.count({ where: { ...base, paymentStatus: { not: 'PAID' } } }),
      this.prisma.directDeal.count({ where: { ...base, paymentStatus: { not: 'PAID' }, dueDate: { lt: now } } }),
      this.prisma.degumDeal.count({ where: { ...base, paymentStatus: { not: 'PAID' }, paymentDueDate: { lt: now } } }),
    ]);

    const directMarketValue = num(directAgg._sum.value) + num(directAgg._sum.mtm);

    return {
      totalTradeValue: num(directAgg._sum.value) + num(degumAgg._sum.buyValue),
      totalMarketValue: directMarketValue + num(degumAgg._sum.sellValue),
      netMtm: num(directAgg._sum.mtm),
      openContracts: openDirect + openDegum,
      pendingPayments: pendingPayDirect + pendingPayDegum,
      overduePayments: overdueDirect + overdueDegum,
      brokerageEarned: num(directAgg._sum.brokerageTotal) + num(degumAgg._sum.brokerageTotal),
    };
  }

  /** Product exposure: qty traded, market value, net MTM per product (Direct + Degum). */
  async productExposure(companyId: string) {
    const base = { companyId, deletedAt: null };
    const [direct, degum, products] = await Promise.all([
      this.prisma.directDeal.findMany({ where: { ...base, kind: 'PRINCIPAL' }, select: { productId: true, quantity: true, value: true, mtm: true } }),
      this.prisma.degumDeal.findMany({ where: base, select: { productId: true, quantity: true, sellValue: true, grossMargin: true } }),
      // include soft-deleted products so referenced products still resolve a name
      this.prisma.product.findMany({ where: { companyId } }),
    ]);
    const byId = new Map(products.map((p) => [p.id, p]));
    const agg = new Map<string, { qty: number; marketValue: number; netMtm: number }>();
    const ensure = (pid: string) => {
      let a = agg.get(pid);
      if (!a) { a = { qty: 0, marketValue: 0, netMtm: 0 }; agg.set(pid, a); }
      return a;
    };
    for (const d of direct) {
      if (!d.productId) continue;
      const a = ensure(d.productId);
      a.qty += num(d.quantity);
      a.marketValue += num(d.value) + num(d.mtm);
      a.netMtm += num(d.mtm);
    }
    for (const d of degum) {
      if (!d.productId) continue;
      const a = ensure(d.productId);
      a.qty += num(d.quantity);
      a.marketValue += num(d.sellValue);
      a.netMtm += num(d.grossMargin);
    }
    return [...agg.entries()]
      .filter(([, a]) => a.qty !== 0)
      .map(([productId, a]) => {
        const p = byId.get(productId);
        const code = p ? (p.deletedAt ? `${p.code} (deleted)` : p.code) : 'Unknown';
        return {
          productId,
          code,
          name: p?.name ?? 'Unknown product',
          marketRate: num(p?.marketRate),
          qty: a.qty,
          marketValue: a.marketValue,
          netMtm: a.netMtm,
        };
      })
      .sort((a, b) => b.qty - a.qty);
  }

  /** Daily MTM trend (Direct Deals) over the last 60 days. */
  async dailyMtm(companyId: string) {
    const rows = await this.prisma.$queryRaw<{ day: Date; mtm: number }[]>`
      SELECT date_trunc('day', "date") AS day,
             COALESCE(SUM("mtm"),0)::float8 AS mtm
      FROM "direct_deals"
      WHERE "companyId" = ${companyId} AND "deletedAt" IS NULL
        AND "kind" = 'PRINCIPAL'
        AND "date" >= (now() - interval '60 days')
      GROUP BY 1 ORDER BY 1 ASC;`;
    return rows.map((r) => ({ day: r.day, mtm: Number(r.mtm) }));
  }

  /** Payment-status distribution across Direct + Degum deals. */
  async paymentStatus(companyId: string) {
    const base = { companyId, deletedAt: null };
    const [direct, degum] = await Promise.all([
      this.prisma.directDeal.groupBy({ by: ['paymentStatus'], where: base, _count: { _all: true } }),
      this.prisma.degumDeal.groupBy({ by: ['paymentStatus'], where: base, _count: { _all: true } }),
    ]);
    const counts: Record<string, number> = { PENDING: 0, PARTIAL: 0, PAID: 0 };
    for (const g of [...direct, ...degum]) counts[g.paymentStatus] += g._count._all;
    const colors: Record<string, string> = { PAID: '#22c55e', PARTIAL: '#f59e0b', PENDING: '#94a3b8' };
    return Object.entries(counts).map(([status, count]) => ({ status, count, color: colors[status] }));
  }

  /** Direct + Degum deals with an unpaid, approaching due date — nearest first. */
  async upcomingDue(companyId: string, limit = 12) {
    const base = { companyId, deletedAt: null };
    const [direct, degum] = await Promise.all([
      this.prisma.directDeal.findMany({
        where: { ...base, paymentStatus: { not: 'PAID' }, dueDate: { not: null } },
        include: { mainParty: true, product: true },
      }),
      this.prisma.degumDeal.findMany({
        where: { ...base, paymentStatus: { not: 'PAID' }, paymentDueDate: { not: null } },
        include: { mainParty: true, product: true },
      }),
    ]);
    const now = Date.now();
    const rows = [
      ...direct.map((d) => ({ type: 'Direct', dealNo: d.dealNo, party: d.mainParty?.name ?? '—', product: d.product?.code ?? '—', qty: num(d.quantity), amount: num(d.value), due: d.dueDate as Date, paymentStatus: d.paymentStatus })),
      ...degum.map((d) => ({ type: 'Degum', dealNo: d.dealNo, party: d.mainParty?.name ?? '—', product: d.product?.code ?? '—', qty: num(d.quantity), amount: num(d.buyValue), due: d.paymentDueDate as Date, paymentStatus: d.paymentStatus })),
    ]
      .map((r) => ({ ...r, daysLeft: Math.ceil((new Date(r.due).getTime() - now) / 86_400_000) }))
      .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
      .slice(0, limit);
    return rows;
  }

  async recentActivity(companyId: string, limit = 15) {
    return this.prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
