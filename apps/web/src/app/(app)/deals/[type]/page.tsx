'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import {
  ArrowDownUp,
  Download,
  FileDown,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { notFound, useParams } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { ContractNoteModal } from '@/components/contract-note-modal';
import { DataTable } from '@/components/data-table';
import { DegumConfirmationNoteModal } from '@/components/degum-confirmation-note-modal';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { api, apiDelete, apiGet, apiPatch, apiPost, type Paginated } from '@/lib/api';
import { findDeal, type DealType, type Fmt } from '@/lib/deal-config';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';

function getPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function toDateInput(v: any): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function rowToForm(cfg: DealType, row: any): Record<string, string> {
  const f: Record<string, string> = {};
  for (const fld of cfg.fields) {
    const v = row[fld.key];
    if (v == null) continue;
    f[fld.key] = fld.type === 'date' ? toDateInput(v) : String(v);
  }
  return f;
}

function badgeColor(v: string): string | null {
  const m: Record<string, string> = {
    OPEN: '#3b82f6', HOLD: '#94a3b8', EXIT: '#ef4444',
    DELIVERED: '#22c55e', CLOSED: '#22c55e', COMPLETE: '#22c55e',
    PAID: '#22c55e', PENDING: '#f59e0b', PARTIAL: '#f59e0b',
    PAYMENT_DUE: '#f59e0b', AWAITING_SHIP_NAME: '#94a3b8',
    CANCELLED: '#ef4444', BUY: '#6366f1', SELL: '#8b5cf6',
    PRINCIPAL: '#0891b2', BROKERAGE: '#c026d3',
    SHIP_NAME_GIVEN: '#0ea5e9', IN_TRANSIT: '#0ea5e9', SCHEDULED: '#94a3b8', LOADED: '#6366f1',
    SHIPMENT_CONFIRMED: '#0ea5e9',
  };
  return m[v] ?? null;
}

function renderCell(value: any, fmt?: Fmt) {
  if (value == null || value === '') return <span className="text-muted-foreground">—</span>;
  switch (fmt) {
    case 'money': return formatCurrency(value);
    case 'num': return formatNumber(value, 0);
    case 'qty': return formatNumber(value, 3);
    case 'date': return formatDate(value);
    case 'bool': return value ? 'Yes' : 'No';
    case 'badge': return <Badge color={badgeColor(String(value))}>{String(value).replace(/_/g, ' ')}</Badge>;
    default: return String(value);
  }
}

export default function DealTypePage() {
  const { type } = useParams<{ type: string }>();
  const cfg = findDeal(type);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filterLabels, setFilterLabels] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [contractRow, setContractRow] = useState<any | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported?: number; message?: string; errors?: { row: number; message: string }[] } | null>(null);

  const params = useMemo(() => {
    const p: Record<string, any> = {};
    if (search) p.search = search;
    if (sortBy) { p.sortBy = sortBy; p.sortDir = sortDir; }
    for (const [k, v] of Object.entries(filters)) if (v) p[k] = v;
    return p;
  }, [search, sortBy, sortDir, filters]);

  const list = useQuery({
    queryKey: ['deal', type, page, params],
    queryFn: () => apiGet<Paginated<any>>(cfg!.endpoint, { page, limit: 25, ...params }),
    enabled: !!cfg,
  });

  const save = useMutation({
    mutationFn: (payload: any) =>
      editing ? apiPatch(`${cfg!.endpoint}/${editing.id}`, payload) : apiPost(cfg!.endpoint, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deal', type] }); closeModal(); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`${cfg!.endpoint}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal', type] }),
  });

  function setFilter(key: string, value: string, label?: string) {
    setFilters((s) => ({ ...s, [key]: value }));
    if (label !== undefined) setFilterLabels((s) => ({ ...s, [key]: label }));
    setPage(1);
  }
  function clearFilters() { setFilters({}); setFilterLabels({}); setPage(1); }
  const activeFilters = Object.values(filters).filter(Boolean).length;

  function openCreate() { setEditing(null); setForm(type === 'direct-deals' ? { kind: 'PRINCIPAL' } : {}); setOpen(true); }
  function openEdit(row: any) { setEditing(row); setForm(rowToForm(cfg!, row)); setOpen(true); }
  function closeModal() { setOpen(false); setEditing(null); setForm({}); }

  async function doExport() {
    setExporting(true);
    try {
      const res = await api.get(`${cfg!.endpoint}/export`, { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${type}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setImportResult({ message: 'Export failed.' });
    } finally { setExporting(false); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post(`${cfg!.endpoint}/import`, fd);
      const payload = (res.data?.data ?? res.data) as { imported: number };
      setImportResult({ imported: payload.imported });
      qc.invalidateQueries({ queryKey: ['deal', type] });
    } catch (err: any) {
      const d = err?.response?.data;
      setImportResult({ message: d?.message ?? 'Import failed.', errors: d?.errors });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const columns = useMemo<ColumnDef<any, any>[]>(() => {
    if (!cfg) return [];
    const cols: ColumnDef<any, any>[] = cfg.columns.map((c) => ({
      id: c.key,
      header: c.label,
      accessorFn: (row: any) => getPath(row, c.key),
      cell: ({ getValue }) => renderCell(getValue(), c.fmt),
      enableSorting: false,
    }));
    cols.push({
      id: '_actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Delete" onClick={(e) => { e.stopPropagation(); remove.mutate(row.original.id); }}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
          <Button variant="ghost" size="icon" title="Contract note" onClick={(e) => { e.stopPropagation(); setContractRow(row.original); }}>
            <FileDown className="size-4" />
          </Button>
        </div>
      ),
    });
    if (cfg.rowChip) {
      cols.unshift({
        id: '_chip',
        header: '',
        enableSorting: false,
        meta: { cellClassName: 'relative p-0', headerClassName: 'p-0' },
        cell: ({ row }) => {
          const chip = cfg.rowChip!(row.original);
          return (
            <>
              {chip && <span title={chip.label} aria-label={chip.label} className="absolute inset-y-0 left-0 w-2" style={{ background: chip.color }} />}
              <span className="block w-7" aria-hidden />
            </>
          );
        },
      });
    }
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);

  if (!cfg) return notFound();

  function submit() {
    const payload: Record<string, any> = {};
    // Only submit fields currently visible — a hidden field (e.g. the other
    // deal-type's inputs) must not leak a stale value into the payload.
    for (const f of cfg!.fields) {
      if (f.showWhen && !f.showWhen(form)) continue;
      const v = form[f.key];
      if (v === undefined || v === '') continue;
      if (f.bool) payload[f.key] = v === 'true';
      else if (f.type === 'number') payload[f.key] = Number(v);
      else payload[f.key] = v;
    }
    save.mutate(payload);
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
      <PageHeader
        title={cfg.label}
        description={`${list.data?.meta.total ?? 0} records · filter, sort, import & export`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Import
            </Button>
            <Button variant="outline" size="sm" onClick={doExport} disabled={exporting}>
              <Download className="size-4" /> {exporting ? 'Exporting…' : 'Export'}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" /> New {cfg.label}
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search…" className="pl-8" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Button variant={showFilters || activeFilters ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters((v) => !v)}>
          <Filter className="size-4" /> Filters{activeFilters ? ` (${activeFilters})` : ''}
        </Button>
        <div className="flex items-center gap-1">
          <Select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }} className="h-9 w-40">
            <option value="">Sort: default</option>
            {(cfg.sorts ?? []).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          <Button variant="outline" size="icon" title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            onClick={() => { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); setPage(1); }}>
            <ArrowDownUp className="size-4" />
          </Button>
        </div>
        {cfg.chipLegend && (
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {cfg.chipLegend.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3.5 rounded-sm" style={{ background: c.color }} />
                {c.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {showFilters && (
        <div className="mb-3 rounded-lg border border-border bg-card p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(cfg.filters ?? []).map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                {f.kind === 'select' ? (
                  <Select value={filters[f.key] ?? ''} onChange={(e) => setFilter(f.key, e.target.value)}>
                    <option value="">All</option>
                    {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                ) : (
                  <Combobox
                    endpoint={f.kind === 'product' ? '/products' : '/parties'}
                    value={filters[f.key] ?? ''}
                    selectedLabel={filterLabels[f.key]}
                    onChange={(id, item) => setFilter(f.key, id, f.kind === 'product' ? `${item.code} — ${item.name}` : item.name)}
                    mapLabel={(it) => (f.kind === 'product' ? `${it.code} — ${it.name}` : it.name)}
                    placeholder="All"
                  />
                )}
              </div>
            ))}
            <div className="space-y-1">
              <Label className="text-xs">Date from</Label>
              <Input type="date" value={filters.dateFrom ?? ''} onChange={(e) => setFilter('dateFrom', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date to</Label>
              <Input type="date" value={filters.dateTo ?? ''} onChange={(e) => setFilter('dateTo', e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters} disabled={!activeFilters}>
              <X className="size-4" /> Clear filters
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={list.data?.items ?? []}
        meta={list.data?.meta}
        isLoading={list.isLoading}
        onPageChange={setPage}
        storageKey={`deal-${type}`}
      />

      <Modal
        open={open}
        onClose={closeModal}
        title={editing ? `Edit ${cfg.label}` : `New ${cfg.label}`}
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cfg.fields.filter((f) => !f.showWhen || f.showWhen(form)).map((f) => {
            const rel = editing?.[f.key.replace(/Id$/, '')];
            const selectedLabel = !rel ? undefined : f.ref === 'products' ? `${rel.code} — ${rel.name}` : rel.name;
            return (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                {f.type === 'select' && f.ref ? (
                  <Combobox
                    endpoint={f.ref === 'products' ? '/products' : '/parties'}
                    params={f.ref === 'self-parties' ? { isSelf: 'true' } : undefined}
                    value={form[f.key] ?? ''}
                    selectedLabel={selectedLabel}
                    onChange={(id) => setForm((s) => ({ ...s, [f.key]: id }))}
                    mapLabel={(it) => (f.ref === 'products' ? `${it.code} — ${it.name}` : it.name)}
                    placeholder={f.ref === 'self-parties' ? 'Select self firm…' : 'Search & select…'}
                  />
                ) : f.type === 'select' ? (
                  <Select value={form[f.key] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}>
                    <option value="">Select…</option>
                    {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                ) : (
                  <Input
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    value={form[f.key] ?? ''}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            );
          })}
        </div>
        {save.isError && (
          <p className="mt-3 text-sm text-destructive">
            {(save.error as any)?.response?.data?.message ?? 'Save failed.'}
          </p>
        )}
      </Modal>

      {type === 'degum-deals' ? (
        <DegumConfirmationNoteModal open={!!contractRow} onClose={() => setContractRow(null)} deal={contractRow} />
      ) : (
        <ContractNoteModal open={!!contractRow} onClose={() => setContractRow(null)} deal={contractRow} dealType={type} />
      )}

      {/* Import result */}
      <Modal
        open={!!importResult}
        onClose={() => setImportResult(null)}
        title="Import result"
        footer={<Button onClick={() => setImportResult(null)}>Close</Button>}
      >
        {importResult?.imported != null ? (
          <p className="text-sm">
            <span className="font-semibold text-green-600">Imported {importResult.imported} {cfg.label.toLowerCase()}.</span>
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">{importResult?.message ?? 'Import failed.'}</p>
            {importResult?.errors && importResult.errors.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-card"><tr>
                    <th className="px-3 py-1.5 text-left text-xs font-semibold uppercase text-muted-foreground">Row</th>
                    <th className="px-3 py-1.5 text-left text-xs font-semibold uppercase text-muted-foreground">Problem</th>
                  </tr></thead>
                  <tbody>
                    {importResult.errors.map((e, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5 tabular-nums">{e.row}</td>
                        <td className="px-3 py-1.5">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Nothing was imported — fix the file and try again.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
