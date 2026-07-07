'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  apiDelete,
  apiGet,
  apiPost,
  type Paginated,
} from '@/lib/api';
import { findResource } from '@/lib/master-config';

export default function MasterResourcePage() {
  const { resource } = useParams<{ resource: string }>();
  const cfg = findResource(resource);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const list = useQuery({
    queryKey: ['master', resource],
    queryFn: () =>
      apiGet<Paginated<any>>(cfg!.endpoint, { limit: 100 }),
    enabled: !!cfg,
  });

  const create = useMutation({
    mutationFn: (payload: Record<string, any>) =>
      apiPost(cfg!.endpoint, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['master', resource] });
      setOpen(false);
      setForm({});
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`${cfg!.endpoint}/${id}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['master', resource] }),
  });

  if (!cfg) return notFound();

  function submit() {
    const payload: Record<string, any> = {};
    for (const f of cfg!.fields) {
      const v = form[f.key];
      if (v === undefined || v === '') continue;
      payload[f.key] = f.type === 'number' ? Number(v) : v;
    }
    create.mutate(payload);
  }

  return (
    <div>
      <Link
        href="/master"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Master Data
      </Link>
      <PageHeader
        title={cfg.label}
        description={`${list.data?.meta.total ?? 0} records`}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              {cfg.columns.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data?.items.map((row) => (
              <TableRow key={row.id}>
                {cfg.columns.map((c) => (
                  <TableCell key={c.key}>{String(row[c.key] ?? '—')}</TableCell>
                ))}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove.mutate(row.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {list.data?.items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={cfg.columns.length + 1}
                  className="h-24 text-center text-muted-foreground"
                >
                  No records yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Add ${cfg.label.replace(/s$/, '')}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cfg.fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>
                {f.label}
                {f.required && <span className="text-destructive"> *</span>}
              </Label>
              {f.type === 'select' ? (
                <Select
                  value={form[f.key] ?? ''}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, [f.key]: e.target.value }))
                  }
                >
                  <option value="">Select…</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  type={f.type ?? 'text'}
                  value={form[f.key] ?? ''}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, [f.key]: e.target.value }))
                  }
                />
              )}
            </div>
          ))}
        </div>
        {create.isError && (
          <p className="mt-3 text-sm text-destructive">
            {(create.error as any)?.response?.data?.message ?? 'Save failed.'}
          </p>
        )}
      </Modal>
    </div>
  );
}
