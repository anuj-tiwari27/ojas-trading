'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Boxes,
  Handshake,
  IndianRupee,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format';

interface Summary {
  totalTradeValue: number;
  totalMarketValue: number;
  netMtm: number;
  openContracts: number;
  pendingPayments: number;
  overduePayments: number;
  brokerageEarned: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'pos' | 'neg';
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p
            className={`mt-1 text-2xl font-semibold tracking-tight ${
              tone === 'pos' ? 'text-green-600' : tone === 'neg' ? 'text-destructive' : ''
            }`}
          >
            {value}
          </p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  // One request instead of six — the API runs all six queries in parallel and
  // returns them together, so the browser makes a single round-trip.
  const dash = useQuery({
    queryKey: ['dash', 'overview'],
    queryFn: () => apiGet<{
      summary: Summary;
      exposure: { code: string; name: string; qty: number; marketValue: number; netMtm: number }[];
      mtm: { day: string; mtm: number }[];
      paymentStatus: { status: string; count: number; color: string }[];
      upcoming: { type: string; dealNo: string; party: string; product: string; qty: number; amount: number; due: string; daysLeft: number; paymentStatus: string }[];
      recent: { id: string; summary: string; action: string; createdAt: string }[];
    }>('/dashboard/overview'),
  });
  const L = dash.isLoading;
  const summary = { data: dash.data?.summary, isLoading: L };
  const exposure = { data: dash.data?.exposure, isLoading: L };
  const mtm = { data: dash.data?.mtm, isLoading: L };
  const pay = { data: dash.data?.paymentStatus, isLoading: L };
  const recent = { data: dash.data?.recent, isLoading: L };
  const upcoming = { data: dash.data?.upcoming, isLoading: L };

  const s = summary.data;

  const dueTone = (dl: number) => (dl < 0 ? 'text-destructive font-medium' : dl <= 3 ? 'text-amber-600 font-medium' : 'text-foreground');
  const dueLabel = (dl: number) => (dl < 0 ? `${Math.abs(dl)}d overdue` : dl === 0 ? 'due today' : `${dl}d left`);

  return (
    <div>
      <PageHeader title="Dashboard" description="Real-time trading overview — MTM, positions & payments" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.isLoading || !s ? (
          Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[76px]" />)
        ) : (
          <>
            <StatCard label="Total Trade Value" value={formatCurrency(s.totalTradeValue)} icon={IndianRupee} />
            <StatCard label="Total Market Value" value={formatCurrency(s.totalMarketValue)} icon={TrendingUp} />
            <StatCard label="Net MTM" value={formatCurrency(s.netMtm)} icon={Activity} tone={s.netMtm >= 0 ? 'pos' : 'neg'} />
            <StatCard label="Brokerage Earned" value={formatCurrency(s.brokerageEarned)} icon={Handshake} tone="pos" />
            <StatCard label="Open Contracts" value={formatNumber(s.openContracts, 0)} icon={Boxes} />
            <StatCard label="Pending Payments" value={formatNumber(s.pendingPayments, 0)} icon={Wallet} />
            <StatCard label="Overdue Payments" value={formatNumber(s.overduePayments, 0)} icon={AlertTriangle} tone={s.overduePayments > 0 ? 'neg' : undefined} />
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily MTM Trend (60 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mtm.data ?? []}>
                  <defs>
                    <linearGradient id="mtm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tickFormatter={(v) => formatDate(v, 'dd MMM')} fontSize={11} stroke="#94a3b8" />
                  <YAxis fontSize={11} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(v) => formatDate(v)} />
                  <Area type="monotone" dataKey="mtm" stroke="#3b82f6" fill="url(#mtm)" name="MTM" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pay.data ?? []} dataKey="count" nameKey="status" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {(pay.data ?? []).map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1 text-xs">
              {(pay.data ?? []).map((d) => (
                <div key={d.status} className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.status.replace(/_/g, ' ')}</span>
                  <span className="ml-auto font-medium">{d.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming due payments — nearest first */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Upcoming Due Payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Due Date</th>
                  <th className="px-4 py-2 font-semibold">In</th>
                  <th className="px-4 py-2 font-semibold">Deal</th>
                  <th className="px-4 py-2 font-semibold">Type</th>
                  <th className="px-4 py-2 font-semibold">Party</th>
                  <th className="px-4 py-2 font-semibold">Material</th>
                  <th className="px-4 py-2 text-right font-semibold">Qty (MT)</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2 font-semibold">Payment</th>
                </tr>
              </thead>
              <tbody>
                {(upcoming.data ?? []).map((r) => (
                  <tr key={`${r.type}-${r.dealNo}`} className="border-t border-border">
                    <td className="whitespace-nowrap px-4 py-2">{formatDate(r.due)}</td>
                    <td className={`whitespace-nowrap px-4 py-2 ${dueTone(r.daysLeft)}`}>{dueLabel(r.daysLeft)}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-medium">{r.dealNo}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{r.type}</td>
                    <td className="whitespace-nowrap px-4 py-2">{r.party}</td>
                    <td className="whitespace-nowrap px-4 py-2">{r.product}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{formatNumber(r.qty, 3)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{formatCurrency(r.amount)}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <Badge color={r.paymentStatus === 'PAID' ? '#22c55e' : r.paymentStatus === 'PARTIAL' ? '#f59e0b' : '#94a3b8'}>{r.paymentStatus}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {upcoming.isLoading && <div className="p-4"><Skeleton className="h-24" /></div>}
            {!upcoming.isLoading && (upcoming.data ?? []).length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">No upcoming payments due. 🎉</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Product Exposure */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Product Exposure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(exposure.data ?? []).slice(0, 8).map((p) => {
            const max = Math.max(...(exposure.data ?? []).map((x) => Math.abs(x.marketValue)), 1);
            return (
              <div key={p.code}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>
                    <span className="font-medium">{p.code}</span>{' '}
                    <span className="text-muted-foreground">· {formatNumber(p.qty, 0)} MT</span>
                  </span>
                  <span className={p.netMtm >= 0 ? 'text-green-600' : 'text-destructive'}>MTM {formatCurrency(p.netMtm)}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${(Math.abs(p.marketValue) / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
          {exposure.isLoading && <Skeleton className="h-32" />}
          {exposure.data?.length === 0 && <p className="text-sm text-muted-foreground">No exposure yet.</p>}
        </CardContent>
      </Card>

      {/* Recent Activity — moved to the bottom */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {(recent.data ?? []).map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1 inline-block size-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p>{a.summary ?? a.action}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</p>
                </div>
              </li>
            ))}
            {recent.isLoading && <Skeleton className="h-32" />}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
