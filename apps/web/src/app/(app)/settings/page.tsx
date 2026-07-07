'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiGet, apiPatch, apiPut } from '@/lib/api';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'company', label: 'Company' },
  { id: 'numbering', label: 'Document Numbering' },
  { id: 'tax', label: 'Tax' },
  { id: 'templates', label: 'Templates' },
  { id: 'branding', label: 'Branding' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Saved({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-sm text-green-600">
      <Check className="size-4" /> Saved
    </span>
  );
}

// ── Company + Financial Year ──────────────────────────────────────────────────
function CompanyTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settings', 'company'], queryFn: () => apiGet<any>('/settings/company') });
  const [form, setForm] = useState<Record<string, any>>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (q.data) setForm(q.data); }, [q.data]);

  const save = useMutation({
    mutationFn: () => apiPatch('/settings/company', {
      name: form.name, legalName: form.legalName, gstin: form.gstin, pan: form.pan, cin: form.cin,
      email: form.email, phone: form.phone, addressLine: form.addressLine, city: form.city,
      state: form.state, pincode: form.pincode, country: form.country,
      financialYearStartMonth: Number(form.financialYearStartMonth) || 4,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings', 'company'] }); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  const set = (k: string, v: any) => setForm((s) => ({ ...s, [k]: v }));
  const F = ({ k, label }: { k: string; label: string }) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Company Settings</CardTitle>
        <div className="flex items-center gap-3"><Saved show={saved} /><Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button></div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <F k="name" label="Display Name" />
        <F k="legalName" label="Legal Name" />
        <F k="gstin" label="GSTIN" />
        <F k="pan" label="PAN" />
        <F k="cin" label="CIN" />
        <F k="email" label="Email" />
        <F k="phone" label="Phone" />
        <div className="space-y-1.5">
          <Label>Financial Year Starts</Label>
          <Select value={String(form.financialYearStartMonth ?? 4)} onChange={(e) => set('financialYearStartMonth', e.target.value)}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
        </div>
        <F k="addressLine" label="Address" />
        <F k="city" label="City" />
        <F k="state" label="State" />
        <F k="pincode" label="Pincode" />
        <F k="country" label="Country" />
      </CardContent>
    </Card>
  );
}

// ── Document Numbering ────────────────────────────────────────────────────────
function NumberingTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settings', 'sequences'], queryFn: () => apiGet<any[]>('/settings/number-sequences') });
  const [rows, setRows] = useState<any[]>([]);
  const [savedKey, setSavedKey] = useState('');
  useEffect(() => { if (q.data) setRows(q.data); }, [q.data]);

  const save = useMutation({
    mutationFn: (r: any) => apiPatch(`/settings/number-sequences/${r.key}`, {
      prefix: r.prefix, padding: Number(r.padding), nextValue: Number(r.nextValue), resetYearly: !!r.resetYearly,
    }),
    onSuccess: (_d, r) => { qc.invalidateQueries({ queryKey: ['settings', 'sequences'] }); setSavedKey(r.key); setTimeout(() => setSavedKey(''), 2500); },
  });

  const upd = (i: number, k: string, v: any) => setRows((s) => s.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  return (
    <Card>
      <CardHeader><CardTitle>Document Numbering</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Controls how deal numbers are generated. Format: <code>PREFIX[-FY]-00001</code>.</p>
        <div className="overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card">
              <tr>{['Module', 'Prefix', 'Padding', 'Next #', 'Reset Yearly', 'Preview', ''].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{r.label}</td>
                  <td className="px-3 py-2"><Input className="h-8 w-20" value={r.prefix} onChange={(e) => upd(i, 'prefix', e.target.value)} /></td>
                  <td className="px-3 py-2"><Input type="number" className="h-8 w-16" value={r.padding} onChange={(e) => upd(i, 'padding', e.target.value)} /></td>
                  <td className="px-3 py-2"><Input type="number" className="h-8 w-20" value={r.nextValue} onChange={(e) => upd(i, 'nextValue', e.target.value)} /></td>
                  <td className="px-3 py-2 text-center"><input type="checkbox" className="size-4" checked={!!r.resetYearly} onChange={(e) => upd(i, 'resetYearly', e.target.checked)} /></td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">{r.prefix}{r.resetYearly ? '-' + (r.yearLabel ?? 'YY-YY') : ''}-{String(r.nextValue).padStart(Number(r.padding) || 1, '0')}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => save.mutate(r)} disabled={save.isPending}>{savedKey === r.key ? 'Saved' : 'Save'}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Generic JSON section (tax / branding) ────────────────────────────────────
function SectionForm({
  section, title, fields,
}: {
  section: string; title: string;
  fields: { k: string; label: string; type?: 'number' | 'text' | 'color' }[];
}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settings', section], queryFn: () => apiGet<any>(`/settings/section/${section}`) });
  const [val, setVal] = useState<Record<string, any>>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (q.data) setVal(q.data); }, [q.data]);

  const save = useMutation({
    mutationFn: () => {
      const value: Record<string, any> = {};
      for (const f of fields) value[f.k] = f.type === 'number' ? Number(val[f.k] ?? 0) : (val[f.k] ?? '');
      return apiPut(`/settings/section/${section}`, { value });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings', section] }); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <div className="flex items-center gap-3"><Saved show={saved} /><Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button></div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.k} className="space-y-1.5">
            <Label>{f.label}</Label>
            {f.type === 'color' ? (
              <div className="flex items-center gap-2">
                <input type="color" className="h-9 w-12 rounded border border-input" value={val[f.k] ?? '#1e293b'} onChange={(e) => setVal((s) => ({ ...s, [f.k]: e.target.value }))} />
                <Input value={val[f.k] ?? ''} onChange={(e) => setVal((s) => ({ ...s, [f.k]: e.target.value }))} />
              </div>
            ) : (
              <Input type={f.type === 'number' ? 'number' : 'text'} value={val[f.k] ?? ''} onChange={(e) => setVal((s) => ({ ...s, [f.k]: e.target.value }))} />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Templates ─────────────────────────────────────────────────────────────────
function TemplatesTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settings', 'templates'], queryFn: () => apiGet<any>('/settings/section/templates') });
  const [val, setVal] = useState<Record<string, any>>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (q.data) setVal(q.data); }, [q.data]);

  const save = useMutation({
    mutationFn: () => apiPut('/settings/section/templates', { value: val }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings', 'templates'] }); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  const tpl = (key: string, label: string) => (
    <div key={key} className="rounded-md border border-border p-3">
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <div className="space-y-2">
        <div className="space-y-1"><Label>Subject</Label>
          <Input value={val[key]?.subject ?? ''} onChange={(e) => setVal((s) => ({ ...s, [key]: { ...s[key], subject: e.target.value } }))} /></div>
        <div className="space-y-1"><Label>Body</Label>
          <Textarea value={val[key]?.body ?? ''} onChange={(e) => setVal((s) => ({ ...s, [key]: { ...s[key], body: e.target.value } }))} /></div>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Notification Templates</CardTitle>
        <div className="flex items-center gap-3"><Saved show={saved} /><Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button></div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Placeholders like <code>{'{party}'}</code>, <code>{'{dealNo}'}</code>, <code>{'{amount}'}</code>, <code>{'{dueDate}'}</code> are substituted when notifications are sent (email / WhatsApp ready).</p>
        {tpl('paymentDue', 'Payment Due')}
        {tpl('deliveryDue', 'Delivery Due')}
        {tpl('shipName', 'Ship Name Received')}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('company');
  return (
    <div>
      <PageHeader title="Settings" description="Company, numbering, tax, templates & branding" />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'company' && <CompanyTab />}
      {tab === 'numbering' && <NumberingTab />}
      {tab === 'tax' && (
        <SectionForm section="tax" title="Tax Settings" fields={[
          { k: 'defaultGstPct', label: 'Default GST %', type: 'number' },
          { k: 'igstPct', label: 'IGST %', type: 'number' },
          { k: 'tdsPct', label: 'TDS %', type: 'number' },
          { k: 'tcsPct', label: 'TCS %', type: 'number' },
          { k: 'brokerageDefaultPerMt', label: 'Default Brokerage ₹/MT', type: 'number' },
        ]} />
      )}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'branding' && (
        <SectionForm section="branding" title="Branding" fields={[
          { k: 'displayName', label: 'Display Name', type: 'text' },
          { k: 'primaryColor', label: 'Primary Color', type: 'color' },
          { k: 'logoUrl', label: 'Logo URL', type: 'text' },
        ]} />
      )}
    </div>
  );
}
