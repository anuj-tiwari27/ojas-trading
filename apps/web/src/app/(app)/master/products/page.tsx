'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  type Paginated,
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';

interface Product {
  id: string; code: string; name: string; unit: string;
  marketRate: string; marketRateUpdatedAt: string | null;
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ unit: 'MT' });
  const [origRate, setOrigRate] = useState<string>('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const list = useQuery({ queryKey: ['products'], queryFn: () => apiGet<Paginated<Product>>('/products', { limit: 200 }) });

  const save = useMutation({
    mutationFn: async () => {
      let recalculated = 0;
      if (editId) {
        await apiPatch(`/products/${editId}`, { code: form.code, name: form.name, unit: form.unit || 'MT' });
        if (form.marketRate !== '' && Number(form.marketRate) !== Number(origRate)) {
          const res = await apiPut<{ recalculated: number }>(`/products/${editId}/market-rate`, { marketRate: Number(form.marketRate) });
          recalculated = res.recalculated;
        }
      } else {
        await apiPost('/products', { code: form.code, name: form.name, unit: form.unit || 'MT', marketRate: form.marketRate ? Number(form.marketRate) : 0 });
      }
      return recalculated;
    },
    onSuccess: (recalculated) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      if (recalculated) { setMsg(`Rate updated — ${recalculated} deal(s) recalculated.`); setTimeout(() => setMsg(''), 4000); }
      close();
    },
    onError: (e: any) => setErr(e?.response?.data?.message ?? 'Save failed.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  function close() { setOpen(false); setEditId(null); setForm({ unit: 'MT' }); setErr(''); }
  function openCreate() { setForm({ unit: 'MT' }); setEditId(null); setOpen(true); }
  function openEdit(p: Product) {
    setForm({ code: p.code, name: p.name, unit: p.unit, marketRate: String(p.marketRate) });
    setOrigRate(String(p.marketRate));
    setEditId(p.id);
    setOpen(true);
  }

  const columns: ColumnDef<Product, any>[] = [
    { id: 'code', header: 'Code', accessorKey: 'code', enableSorting: false, cell: ({ row }) => <span className="font-medium">{row.original.code}</span> },
    { id: 'name', header: 'Name', accessorKey: 'name', enableSorting: false },
    { id: 'unit', header: 'Unit', accessorKey: 'unit', enableSorting: false },
    { id: 'marketRate', header: 'Market Rate (₹/MT)', enableSorting: false, cell: ({ row }) => formatCurrency(row.original.marketRate) },
    { id: 'marketRateUpdatedAt', header: 'Last Updated', enableSorting: false, cell: ({ row }) => formatDate(row.original.marketRateUpdatedAt) },
    { id: '_actions', header: '', enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)}><Pencil className="size-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => remove.mutate(row.original.id)}><Trash2 className="size-4 text-destructive" /></Button>
        </div>
      ) },
  ];

  return (
    <div>
      <Link href="/master" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Master Data
      </Link>
      <PageHeader
        title="Products & Market Rates"
        description="Editing a rate recalculates MTM across all deals"
        actions={<Button size="sm" onClick={openCreate}><Plus className="size-4" /> Add Product</Button>}
      />
      {msg && <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</div>}

      <DataTable columns={columns} data={list.data?.items ?? []} isLoading={list.isLoading} storageKey="products" />

      <Modal
        open={open}
        onClose={close}
        title={editId ? `Edit ${form.code ?? 'Product'}` : 'Add Product'}
        footer={
          <>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={() => { setErr(''); save.mutate(); }} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {[
            { k: 'code', l: 'Code *' },
            { k: 'name', l: 'Name *' },
            { k: 'unit', l: 'Unit' },
            { k: 'marketRate', l: 'Market Rate (₹/MT)', t: 'number' },
          ].map((f) => (
            <div key={f.k} className="space-y-1.5">
              <Label>{f.l}</Label>
              <Input type={f.t === 'number' ? 'number' : 'text'} value={form[f.k] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.k]: e.target.value }))} />
            </div>
          ))}
        </div>
        {editId && <p className="mt-2 text-xs text-muted-foreground">Changing the market rate will recalculate MTM on every direct deal for this product.</p>}
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
      </Modal>
    </div>
  );
}
