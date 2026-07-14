import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const num = (v: any) => Number(v ?? 0);
const r4 = (n: number) => Number(n.toFixed(4));
const r3 = (n: number) => Number(n.toFixed(3));

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Trading Desk ────────────────────────────────────────────────────────────
  // A feasibility cockpit for the Self firm: per-commodity net position with
  // weighted-average buy cost vs current market rate, plus a procurement ladder
  // showing how much we hold from which seller and at what rate.
  //   Buy legs  : Direct (side BUY, seller = Main party) + Degum (buy @ buyRate)
  //   Sell legs : Direct (side SELL) + Degum (sell @ sellRate)
  async tradingDesk(companyId: string) {
    const selfParties = await this.prisma.party.findMany({
      where: { companyId, deletedAt: null, isSelf: true },
    });
    const selfIds = new Set(selfParties.map((p) => p.id));
    const empty = { commodities: 0, netQty: 0, costValue: 0, marketValue: 0, unrealisedPnl: 0 };
    if (selfIds.size === 0) {
      return { selfParties: [], summary: empty, holdings: [], procurement: [] };
    }

    const [direct, degum, products] = await Promise.all([
      this.prisma.directDeal.findMany({
        where: { companyId, deletedAt: null, kind: 'PRINCIPAL', selfPartyId: { in: [...selfIds] } },
        include: { product: true, mainParty: true },
      }),
      this.prisma.degumDeal.findMany({
        where: { companyId, deletedAt: null, selfPartyId: { in: [...selfIds] } },
        include: { product: true, mainParty: true },
      }),
      this.prisma.product.findMany({ where: { companyId, deletedAt: null } }),
    ]);
    const marketRate = new Map(products.map((p) => [p.id, num(p.marketRate)]));

    const H = new Map<string, any>(); // per commodity
    const ensureH = (pid?: string | null, code?: string | null, name?: string | null) => {
      const key = pid ?? '__none__';
      let h = H.get(key);
      if (!h) {
        h = { productId: pid, code: code ?? '—', name: name ?? '—', bought: 0, sold: 0, buyQty: 0, buyAmt: 0, sellQty: 0, sellAmt: 0, buyValue: 0, sellValue: 0 };
        H.set(key, h);
      }
      return h;
    };

    const P = new Map<string, any>(); // per commodity + seller (procurement ladder)
    const addBuy = (pid: any, code: any, name: any, sellerId: any, sellerName: any, qty: number, rate: number, date: any) => {
      const h = ensureH(pid, code, name);
      h.bought += qty; h.buyQty += qty; h.buyAmt += qty * rate; h.buyValue += qty * rate;
      const key = `${pid ?? '—'}|${sellerId ?? '—'}`;
      let p = P.get(key);
      if (!p) {
        p = { productId: pid, code: code ?? '—', name: name ?? '—', sellerId: sellerId ?? null, seller: sellerName ?? '—', qty: 0, amt: 0, value: 0, deals: 0, lastDate: null as Date | null };
        P.set(key, p);
      }
      p.qty += qty; p.amt += qty * rate; p.value += qty * rate; p.deals += 1;
      if (date && (!p.lastDate || date > p.lastDate)) p.lastDate = date;
    };
    const addSell = (pid: any, code: any, name: any, qty: number, rate: number) => {
      const h = ensureH(pid, code, name);
      h.sold += qty; h.sellQty += qty; h.sellAmt += qty * rate; h.sellValue += qty * rate;
    };

    for (const d of direct) {
      const qty = num(d.quantity), rate = num(d.rate);
      if (d.side === 'BUY') addBuy(d.productId, d.product?.code, d.product?.name, d.mainPartyId, d.mainParty?.name, qty, rate, d.date);
      else addSell(d.productId, d.product?.code, d.product?.name, qty, rate);
    }
    for (const d of degum) {
      const qty = num(d.quantity);
      addBuy(d.productId, d.product?.code, d.product?.name, d.mainPartyId, d.mainParty?.name, qty, num(d.buyRate), d.dealDate);
      addSell(d.productId, d.product?.code, d.product?.name, qty, num(d.sellRate));
    }

    const holdings = [...H.values()]
      .map((h) => {
        const netQty = r3(h.bought - h.sold);
        const mr = h.productId ? (marketRate.get(h.productId) ?? 0) : 0;
        // No buy legs → reference the market rate (not ₹0) so a stray short can't
        // report a phantom full-market-value loss. (Overselling is blocked at write time.)
        const avgBuyRate = h.buyQty ? r4(h.buyAmt / h.buyQty) : mr;
        const avgSellRate = h.sellQty ? r4(h.sellAmt / h.sellQty) : 0;
        const costValue = r4(netQty * avgBuyRate);
        const marketValue = r4(netQty * mr);
        return {
          productId: h.productId, code: h.code, name: h.name,
          bought: r3(h.bought), sold: r3(h.sold), netQty,
          avgBuyRate, avgSellRate,
          buyValue: r4(h.buyValue), sellValue: r4(h.sellValue),
          marketRate: mr, costValue, marketValue,
          unrealisedPnl: r4(netQty * (mr - avgBuyRate)),
          realisedPnl: r4(Math.min(h.bought, h.sold) * (avgSellRate - avgBuyRate)),
        };
      })
      .sort((a, b) => Math.abs(b.netQty) - Math.abs(a.netQty));

    const procurement = [...P.values()]
      .map((p) => ({
        productId: p.productId, code: p.code, name: p.name,
        sellerId: p.sellerId, seller: p.seller,
        qty: r3(p.qty), avgRate: p.qty ? r4(p.amt / p.qty) : 0, value: r4(p.value),
        deals: p.deals, lastDate: p.lastDate,
      }))
      .sort((a, b) => b.qty - a.qty);

    const summary = holdings.reduce(
      (a, h) => ({
        commodities: a.commodities + (h.netQty !== 0 ? 1 : 0),
        netQty: r3(a.netQty + h.netQty),
        costValue: r4(a.costValue + h.costValue),
        marketValue: r4(a.marketValue + h.marketValue),
        unrealisedPnl: r4(a.unrealisedPnl + h.unrealisedPnl),
      }),
      { ...empty },
    );

    return {
      selfParties: selfParties.map((p) => ({ id: p.id, name: p.name })),
      summary,
      holdings,
      procurement,
    };
  }
}
