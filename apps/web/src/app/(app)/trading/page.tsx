'use client';

import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Activity, Boxes, Building2, IndianRupee, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';

interface Holding {
  productId: string; code: string; name: string;
  bought: number; sold: number; netQty: number;
  avgBuyRate: number; avgSellRate: number;
  buyValue: number; sellValue: number;
  marketRate: number; costValue: number; marketValue: number;
  unrealisedPnl: number; realisedPnl: number;
}
interface Procurement {
  productId: string; code: string; name: string;
  sellerId: string | null; seller: string;
  qty: number; avgRate: number; value: number; deals: number; lastDate: string | null;
}
interface Summary { commodities: number; netQty: number; costValue: number; marketValue: number; unrealisedPnl: number }
interface Resp { selfParties: { id: string; name: string }[]; summary: Summary; holdings: Holding[]; procurement: Procurement[] }

const rate = (n: number) => `₹${formatNumber(n, 2)}`;
const pnlClass = (n: number) => (n > 0 ? 'text-green-600 font-medium' : n < 0 ? 'text-destructive font-medium' : '');

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone?: 'pos' | 'neg' }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`mt-1 text-2xl font-semibold tracking-tight ${tone === 'pos' ? 'text-green-600' : tone === 'neg' ? 'text-destructive' : ''}`}>{value}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary"><Icon className="size-5" /></div>
      </CardContent>
    </Card>
  );
}

const holdingCols: ColumnDef<Holding, any>[] = [
  { id: 'code', header: 'Commodity', enableSorting: false, cell: ({ row }) => <span className="font-medium">{row.original.code}</span> },
  { id: 'name', header: 'Name', accessorKey: 'name', enableSorting: false, cell: ({ row }) => <span className="text-muted-foreground">{row.original.name}</span> },
  { id: 'bought', header: 'Bought (MT)', enableSorting: false, cell: ({ row }) => formatNumber(row.original.bought, 3) },
  { id: 'sold', header: 'Sold (MT)', enableSorting: false, cell: ({ row }) => formatNumber(row.original.sold, 3) },
  { id: 'net', header: 'Net (MT)', enableSorting: false, cell: ({ row }) => <span className={pnlClass(row.original.netQty)}>{formatNumber(row.original.netQty, 3)}</span> },
  { id: 'avgBuy', header: 'Avg Buy Cost', enableSorting: false, cell: ({ row }) => rate(row.original.avgBuyRate) },
  { id: 'market', header: 'Market Rate', enableSorting: false, cell: ({ row }) => rate(row.original.marketRate) },
  { id: 'costValue', header: 'Cost Value', enableSorting: false, cell: ({ row }) => formatCurrency(row.original.costValue) },
  { id: 'marketValue', header: 'Market Value', enableSorting: false, cell: ({ row }) => formatCurrency(row.original.marketValue) },
  { id: 'unrealised', header: 'Unrealised P&L', enableSorting: false, cell: ({ row }) => <span className={pnlClass(row.original.unrealisedPnl)}>{formatCurrency(row.original.unrealisedPnl)}</span> },
];

const procCols: ColumnDef<Procurement, any>[] = [
  { id: 'code', header: 'Commodity', enableSorting: false, cell: ({ row }) => <span className="font-medium">{row.original.code}</span> },
  { id: 'seller', header: 'Seller', accessorKey: 'seller', enableSorting: false },
  { id: 'qty', header: 'Qty Bought (MT)', enableSorting: false, cell: ({ row }) => formatNumber(row.original.qty, 3) },
  { id: 'avgRate', header: 'Avg Rate ₹/MT', enableSorting: false, cell: ({ row }) => rate(row.original.avgRate) },
  { id: 'value', header: 'Value', enableSorting: false, cell: ({ row }) => formatCurrency(row.original.value) },
  { id: 'deals', header: 'Deals', enableSorting: false, cell: ({ row }) => row.original.deals },
  { id: 'lastDate', header: 'Last Buy', enableSorting: false, cell: ({ row }) => formatDate(row.original.lastDate) },
];

function FeasibilityChecker({ holdings, procurement }: { holdings: Holding[]; procurement: Procurement[] }) {
  const [code, setCode] = useState('');
  const [qty, setQty] = useState('');
  const [sellRate, setSellRate] = useState('');
  const [brokerage, setBrokerage] = useState('');

  const sel = holdings.find((h) => h.code === code);
  // default the sell rate to the market rate when a commodity is picked
  useEffect(() => { if (sel) setSellRate((r) => (r === '' ? String(sel.marketRate || '') : r)); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const result = useMemo(() => {
    if (!sel) return null;
    const q = Number(qty) || 0;
    const r = Number(sellRate) || 0;
    const brk = Number(brokerage) || 0;
    const available = sel.netQty;
    const avgCost = sel.avgBuyRate;
    // Brokerage is income we charge, so it adds to our margin (not a cost we deduct).
    const marginPerMt = r - avgCost + brk;
    const totalMargin = q * marginPerMt;
    const enoughStock = available > 0 && q > 0 && q <= available;
    const shortfall = Math.max(0, q - Math.max(0, available));
    const profitable = marginPerMt > 0;
    const vsMarket = r - sel.marketRate;
    return { q, r, brk, available, avgCost, marginPerMt, totalMargin, enoughStock, shortfall, profitable, vsMarket, market: sel.marketRate };
  }, [sel, qty, sellRate, brokerage]);

  const sources = procurement.filter((p) => sel && p.productId === sel.productId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><TrendingUp className="size-4" /> Feasibility Check</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Pick a commodity and a prospective sale to test margin against your weighted-average cost and on-hand stock.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Commodity</Label>
            <Select value={code} onChange={(e) => { setCode(e.target.value); setSellRate(''); }}>
              <option value="">Select…</option>
              {holdings.map((h) => <option key={h.productId} value={h.code}>{h.code} — net {formatNumber(h.netQty, 1)} MT</option>)}
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Sell Qty (MT)</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Sell Rate (₹/MT)</Label><Input type="number" value={sellRate} onChange={(e) => setSellRate(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Brokerage (₹/MT)</Label><Input type="number" value={brokerage} onChange={(e) => setBrokerage(e.target.value)} /></div>
        </div>

        {!sel ? (
          <p className="text-sm text-muted-foreground">Select a commodity to begin.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Available (Net)" value={`${formatNumber(result!.available, 3)} MT`} tone={result!.available < 0 ? 'neg' : undefined} />
              <Metric label="Avg Buy Cost" value={rate(result!.avgCost)} />
              <Metric label="Market Rate" value={rate(result!.market)} />
              <Metric label="Margin / MT" value={rate(result!.marginPerMt)} tone={result!.marginPerMt >= 0 ? 'pos' : 'neg'} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Metric label="Projected Total Margin" value={formatCurrency(result!.totalMargin)} tone={result!.totalMargin >= 0 ? 'pos' : 'neg'} big />
              <Metric label="Sell Rate vs Market" value={`${result!.vsMarket >= 0 ? '+' : ''}${rate(result!.vsMarket)}`} tone={result!.vsMarket >= 0 ? 'pos' : 'neg'} big />
            </div>

            {result!.q > 0 && (
              <div className={`rounded-md border p-3 text-sm ${result!.enoughStock && result!.profitable ? 'border-green-600/40 bg-green-600/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={result!.enoughStock && result!.profitable ? '#22c55e' : '#f59e0b'}>
                    {result!.enoughStock && result!.profitable ? 'FEASIBLE' : 'REVIEW'}
                  </Badge>
                  <span>
                    {result!.profitable ? `Profitable at ${rate(result!.marginPerMt)}/MT` : `Loss of ${rate(Math.abs(result!.marginPerMt))}/MT vs cost`}
                    {' · '}
                    {result!.enoughStock
                      ? `${formatNumber(result!.available, 1)} MT on hand covers it`
                      : result!.shortfall > 0
                        ? `Short ${formatNumber(result!.shortfall, 1)} MT — would need fresh procurement`
                        : 'No stock on hand'}
                  </span>
                </div>
              </div>
            )}

            {sources.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Sourced from</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {sources.map((s) => (
                    <span key={s.sellerId ?? s.seller} className="rounded-md border border-border px-2 py-1">
                      {s.seller}: <b>{formatNumber(s.qty, 1)} MT</b> @ {rate(s.avgRate)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone, big }: { label: string; value: string; tone?: 'pos' | 'neg'; big?: boolean }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-semibold ${big ? 'text-xl' : 'text-base'} ${tone === 'pos' ? 'text-green-600' : tone === 'neg' ? 'text-destructive' : ''}`}>{value}</p>
    </div>
  );
}

export default function TradingPage() {
  const q = useQuery({ queryKey: ['trading-desk'], queryFn: () => apiGet<Resp>('/trading-desk') });
  const data = q.data;

  return (
    <div>
      <PageHeader title="Trading Desk" description="Self-firm positions, procurement cost & deal feasibility" />

      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[76px]" />)}
        </div>
      ) : data && data.selfParties.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-primary"><Building2 className="size-6" /></div>
            <p className="font-medium">No Self Firm defined yet</p>
            <p className="max-w-md text-sm text-muted-foreground">Mark one of your parties as a “Self Firm” (or create one) to track positions and check trade feasibility here.</p>
            <Link href="/master/parties" className="text-sm font-medium text-primary hover:underline">Go to Parties →</Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Commodities Held" value={formatNumber(data?.summary.commodities ?? 0, 0)} icon={Boxes} />
            <StatCard label="Net On-Hand (MT)" value={formatNumber(data?.summary.netQty ?? 0, 1)} icon={TrendingUp} />
            <StatCard label="Cost Value" value={formatCurrency(data?.summary.costValue ?? 0)} icon={IndianRupee} />
            <StatCard label="Market Value" value={formatCurrency(data?.summary.marketValue ?? 0)} icon={Activity} />
            <StatCard label="Unrealised P&L" value={formatCurrency(data?.summary.unrealisedPnl ?? 0)} icon={Activity} tone={(data?.summary.unrealisedPnl ?? 0) >= 0 ? 'pos' : 'neg'} />
          </div>

          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Self firm(s):</span>
            {(data?.selfParties ?? []).map((p) => <Badge key={p.id} color="#22c55e">{p.name}</Badge>)}
          </div>

          <FeasibilityChecker holdings={data?.holdings ?? []} procurement={data?.procurement ?? []} />

          <div>
            <h2 className="mb-2 text-sm font-semibold">Net Position — Cost vs Market</h2>
            <DataTable columns={holdingCols} data={data?.holdings ?? []} isLoading={q.isLoading} storageKey="trading-holdings" />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold">Procurement — what we hold, from which seller, at what rate</h2>
            <DataTable columns={procCols} data={data?.procurement ?? []} isLoading={q.isLoading} storageKey="trading-procurement" />
          </div>
        </div>
      )}
    </div>
  );
}
