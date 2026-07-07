'use client';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Settings2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PageMeta } from '@/lib/api';
import { cn } from '@/lib/utils';

// Allow columns to carry per-cell / per-header class names via `meta`.
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    cellClassName?: string;
    headerClassName?: string;
  }
}

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  meta?: PageMeta;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  /** localStorage key to persist column visibility */
  storageKey?: string;
}

function headerLabel(col: any): string {
  const h = col.columnDef?.header;
  return typeof h === 'string' && h ? h : col.id;
}

export function DataTable<T>({
  columns,
  data,
  meta,
  onPageChange,
  onRowClick,
  isLoading,
  storageKey,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // restore persisted visibility
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(`cols:${storageKey}`);
      if (raw) setColumnVisibility(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(`cols:${storageKey}`, JSON.stringify(columnVisibility));
    } catch {
      /* ignore */
    }
  }, [columnVisibility, storageKey]);

  // close menu on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const hideable = table
    .getAllLeafColumns()
    .filter((c) => !c.id.startsWith('_'));

  return (
    <div className="rounded-lg border border-border bg-background">
      {/* toolbar: column chooser top-right */}
      <div className="flex items-center justify-end border-b border-border px-3 py-2">
        <div className="relative" ref={menuRef}>
          <Button variant="outline" size="sm" onClick={() => setMenuOpen((o) => !o)}>
            <Settings2 className="size-4" /> Columns
          </Button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 max-h-80 w-56 overflow-auto rounded-md border border-border bg-background p-1 shadow-lg">
              <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground">
                <span>Show columns</span>
                <button
                  className="hover:text-foreground"
                  onClick={() => table.toggleAllColumnsVisible(true)}
                >
                  Reset
                </button>
              </div>
              {hideable.map((col) => (
                <label
                  key={col.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                    className="size-3.5"
                  />
                  {headerLabel(col)}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-h-[calc(100vh-20rem)] overflow-auto">
        <Table className="table-sticky">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={(header.column.columnDef.meta as any)?.headerClassName}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown className="size-3" />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={(cell.column.columnDef.meta as any)?.cellClassName}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {meta && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm">
          <p className="text-muted-foreground">
            {meta.total === 0
              ? '0 results'
              : `${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!meta.hasPrev} onClick={() => onPageChange?.(meta.page - 1)}>
              <ChevronLeft className="size-4" /> Prev
            </Button>
            <span className="text-muted-foreground">
              Page {meta.page} / {meta.totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={!meta.hasNext} onClick={() => onPageChange?.(meta.page + 1)}>
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
