// ═══════════════════════════════════════════════════════════════════════════
//  Deals import / export — single source of truth for columns.
//  Each column knows how to render itself for EXPORT and (optionally) how to be
//  parsed back on IMPORT. Computed columns (value, mtm, totals) have no `imp`
//  descriptor, so they are ignored on import and recomputed by the service.
// ═══════════════════════════════════════════════════════════════════════════
import * as XLSX from 'xlsx';

export type ImportKind = 'string' | 'number' | 'date' | 'enum' | 'bool' | 'party' | 'self' | 'product';

export interface DealColSpec {
  header: string;
  get: (row: any) => any; // export value
  imp?: {
    key: string; // target field on the create payload / resolved id
    kind: ImportKind;
    required?: boolean;
    enum?: string[];
  };
}

const n = (v: any) => (v == null ? '' : Number(v));
const d = (v: any): string => {
  if (!v) return '';
  const dt = new Date(v);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
};

const PAY = ['PENDING', 'PARTIAL', 'PAID'];

export const SPEC_DIRECT: DealColSpec[] = [
  { header: 'Deal ID', get: (r) => r.dealNo },
  { header: 'Date', get: (r) => d(r.date), imp: { key: 'date', kind: 'date' } },
  { header: 'Side', get: (r) => r.side, imp: { key: 'side', kind: 'enum', required: true, enum: ['BUY', 'SELL'] } },
  { header: 'Main Party', get: (r) => r.mainParty?.name ?? '', imp: { key: 'mainPartyId', kind: 'party', required: true } },
  { header: 'Self Firm', get: (r) => r.selfParty?.name ?? '', imp: { key: 'selfPartyId', kind: 'self' } },
  { header: 'Material', get: (r) => r.product?.code ?? '', imp: { key: 'productId', kind: 'product', required: true } },
  { header: 'Qty (MT)', get: (r) => n(r.quantity), imp: { key: 'quantity', kind: 'number', required: true } },
  { header: 'Rate', get: (r) => n(r.rate), imp: { key: 'rate', kind: 'number', required: true } },
  { header: 'Value', get: (r) => n(r.value) },
  { header: 'Market Rate', get: (r) => n(r.marketRate), imp: { key: 'marketRate', kind: 'number' } },
  { header: 'MTM', get: (r) => n(r.mtm) },
  { header: 'Brokerage /MT', get: (r) => n(r.brokerageRate), imp: { key: 'brokerageRate', kind: 'number' } },
  { header: 'Brokerage Total', get: (r) => n(r.brokerageTotal) },
  { header: 'Due Date', get: (r) => d(r.dueDate), imp: { key: 'dueDate', kind: 'date' } },
  { header: 'Payment', get: (r) => r.paymentStatus, imp: { key: 'paymentStatus', kind: 'enum', enum: PAY } },
  { header: 'Status', get: (r) => r.status, imp: { key: 'status', kind: 'enum', enum: ['OPEN', 'CLOSED', 'CANCELLED'] } },
  { header: 'Remarks', get: (r) => r.remarks ?? '', imp: { key: 'remarks', kind: 'string' } },
];

// Broker rows are DirectDeals with kind=BROKERAGE: no side / main party / self firm,
// and value / market rate / MTM are always 0 — so they get their own sheet shape.
// Export only: no `imp` descriptors, so importing a broker sheet is not yet supported.
export const SPEC_BROKER: DealColSpec[] = [
  { header: 'Deal ID', get: (r) => r.dealNo },
  { header: 'Date', get: (r) => d(r.date) },
  { header: 'Buyer', get: (r) => r.buyerParty?.name ?? '' },
  { header: 'Seller', get: (r) => r.sellerParty?.name ?? '' },
  { header: 'Material', get: (r) => r.product?.code ?? '' },
  { header: 'Qty (MT)', get: (r) => n(r.quantity) },
  { header: 'Rate', get: (r) => n(r.rate) },
  { header: 'Buyer Brokerage /MT', get: (r) => n(r.buyerBrokerageRate) },
  { header: 'Seller Brokerage /MT', get: (r) => n(r.sellerBrokerageRate) },
  { header: 'Buyer Brokerage', get: (r) => n(r.buyerBrokerageTotal) },
  { header: 'Seller Brokerage', get: (r) => n(r.sellerBrokerageTotal) },
  { header: 'Brokerage Total', get: (r) => n(r.brokerageTotal) },
  { header: 'Due Date', get: (r) => d(r.dueDate) },
  { header: 'Payment', get: (r) => r.paymentStatus },
  { header: 'Status', get: (r) => r.status },
  { header: 'Remarks', get: (r) => r.remarks ?? '' },
];

export const SPEC_DEGUM: DealColSpec[] = [
  { header: 'Deal ID', get: (r) => r.dealNo },
  { header: 'Date', get: (r) => d(r.dealDate), imp: { key: 'dealDate', kind: 'date' } },
  { header: 'Material', get: (r) => r.product?.code ?? '', imp: { key: 'productId', kind: 'product', required: true } },
  { header: 'Shipment Month', get: (r) => r.shipmentMonth ?? '', imp: { key: 'shipmentMonth', kind: 'string' } },
  { header: 'Origin/Port', get: (r) => r.originPort ?? '', imp: { key: 'originPort', kind: 'string' } },
  { header: 'Main Party', get: (r) => r.mainParty?.name ?? '', imp: { key: 'mainPartyId', kind: 'party', required: true } },
  { header: 'Self Firm', get: (r) => r.selfParty?.name ?? '', imp: { key: 'selfPartyId', kind: 'self' } },
  { header: 'Qty (MT)', get: (r) => n(r.quantity), imp: { key: 'quantity', kind: 'number', required: true } },
  { header: 'Buy Rate', get: (r) => n(r.buyRate), imp: { key: 'buyRate', kind: 'number', required: true } },
  { header: 'Sell Rate', get: (r) => n(r.sellRate), imp: { key: 'sellRate', kind: 'number', required: true } },
  { header: 'Buy Value', get: (r) => n(r.buyValue) },
  { header: 'Sell Value', get: (r) => n(r.sellValue) },
  { header: 'Gross Margin', get: (r) => n(r.grossMargin) },
  { header: 'Brokerage /MT', get: (r) => n(r.brokerageRate), imp: { key: 'brokerageRate', kind: 'number' } },
  { header: 'Brokerage Total', get: (r) => n(r.brokerageTotal) },
  { header: 'Ship Name?', get: (r) => (r.shipNameReceived ? 'Yes' : 'No'), imp: { key: 'shipNameReceived', kind: 'bool' } },
  { header: 'Vessel', get: (r) => r.vessel ?? '', imp: { key: 'vessel', kind: 'string' } },
  { header: 'Payment Due', get: (r) => d(r.paymentDueDate), imp: { key: 'paymentDueDate', kind: 'date' } },
  { header: 'Payment', get: (r) => r.paymentStatus, imp: { key: 'paymentStatus', kind: 'enum', enum: PAY } },
  { header: 'Status', get: (r) => r.status, imp: { key: 'status', kind: 'enum', enum: ['OPEN', 'SHIPMENT_CONFIRMED', 'DELIVERED', 'CLOSED'] } },
  { header: 'Remarks', get: (r) => r.remarks ?? '', imp: { key: 'remarks', kind: 'string' } },
];

export type DealSpecKey = 'direct' | 'broker' | 'degum';

export const SPECS: Record<DealSpecKey, DealColSpec[]> = { direct: SPEC_DIRECT, broker: SPEC_BROKER, degum: SPEC_DEGUM };

const SHEET_NAME: Record<DealSpecKey, string> = {
  direct: 'Direct Deals',
  broker: 'Brokerage Deals',
  degum: 'Degum Deals',
};

// ── Workbook build (export) ──────────────────────────────────────────────────
export function buildDealWorkbook(type: DealSpecKey, rows: any[]): Buffer {
  const cols = SPECS[type];
  const aoa = [cols.map((c) => c.header), ...rows.map((r) => cols.map((c) => c.get(r)))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols.map((c) => ({ wch: Math.max(10, c.header.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME[type]);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ── Workbook parse (import) — handles .xlsx and .csv ─────────────────────────
export function parseWorkbook(buffer: Buffer): { headers: string[]; rows: Record<string, any>[] } {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { headers: [], rows: [] };
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false });
  if (!aoa.length) return { headers: [], rows: [] };
  const headers = (aoa[0] || []).map((h) => String(h ?? '').trim());
  const rows = aoa.slice(1).map((arr) => {
    const o: Record<string, any> = {};
    headers.forEach((h, i) => (o[h] = arr[i] ?? null));
    return o;
  });
  return { headers, rows };
}

// ── Row validation + resolution ──────────────────────────────────────────────
export interface ImportLookups {
  partyByName: Map<string, { id: string; isSelf: boolean }>;
  productByCode: Map<string, { id: string }>;
  selfParties: { id: string; name: string }[];
}
export interface ImportError {
  row: number;
  message: string;
}

const norm = (s: any) => String(s ?? '').trim().toLowerCase();

/** Validate/parse every row against the spec. Returns aligned records + all errors. */
export function resolveImportRows(
  spec: DealColSpec[],
  headers: string[],
  rows: Record<string, any>[],
  lk: ImportLookups,
): { records: Record<string, any>[]; errors: ImportError[] } {
  // map each spec column to the actual header string present in the file (case-insensitive)
  const headerFor = new Map<string, string | null>();
  for (const c of spec) {
    const found = headers.find((h) => norm(h) === norm(c.header));
    headerFor.set(c.header, found ?? null);
  }

  const errors: ImportError[] = [];
  const records: Record<string, any>[] = [];

  rows.forEach((raw, i) => {
    const rowNo = i + 2; // +1 for header row, +1 for 1-based
    const rec: Record<string, any> = {};
    const push = (m: string) => errors.push({ row: rowNo, message: m });

    for (const c of spec) {
      if (!c.imp) continue;
      const hdr = headerFor.get(c.header);
      const rawVal = hdr ? raw[hdr] : null;
      const blank = rawVal == null || String(rawVal).trim() === '';

      if (blank) {
        if (c.imp.required) push(`"${c.header}" is required`);
        continue;
      }

      switch (c.imp.kind) {
        case 'string':
          rec[c.imp.key] = String(rawVal).trim();
          break;
        case 'number': {
          const num = Number(String(rawVal).replace(/,/g, '').trim());
          if (!Number.isFinite(num)) push(`"${c.header}" must be a number (got "${rawVal}")`);
          else if (num < 0) push(`"${c.header}" cannot be negative`);
          else rec[c.imp.key] = num;
          break;
        }
        case 'date': {
          const dt = rawVal instanceof Date ? rawVal : new Date(String(rawVal));
          if (Number.isNaN(dt.getTime())) push(`"${c.header}" is not a valid date (got "${rawVal}")`);
          else rec[c.imp.key] = dt.toISOString();
          break;
        }
        case 'enum': {
          const up = String(rawVal).trim().toUpperCase().replace(/\s+/g, '_');
          if (c.imp.enum && !c.imp.enum.includes(up)) push(`"${c.header}" must be one of ${c.imp.enum.join(', ')} (got "${rawVal}")`);
          else rec[c.imp.key] = up;
          break;
        }
        case 'bool':
          rec[c.imp.key] = /^(y|yes|true|1)$/i.test(String(rawVal).trim());
          break;
        case 'party': {
          const hit = lk.partyByName.get(norm(rawVal));
          if (!hit) push(`Party "${rawVal}" not found`);
          else rec[c.imp.key] = hit.id;
          break;
        }
        case 'product': {
          const hit = lk.productByCode.get(norm(rawVal));
          if (!hit) push(`Material "${rawVal}" not found`);
          else rec[c.imp.key] = hit.id;
          break;
        }
        case 'self': {
          const hit = lk.partyByName.get(norm(rawVal));
          if (!hit) push(`Self firm "${rawVal}" not found`);
          else if (!hit.isSelf) push(`"${rawVal}" is not a Self firm`);
          else rec[c.imp.key] = hit.id;
          break;
        }
      }
    }

    // default the Self firm when the column is blank and exactly one self firm exists
    if (!rec.selfPartyId) {
      if (lk.selfParties.length === 1) rec.selfPartyId = lk.selfParties[0].id;
      else if (lk.selfParties.length === 0) push(`No Self firm exists — create one before importing`);
      else push(`"Self Firm" is required (multiple self firms exist)`);
    }

    records.push(rec);
  });

  return { records, errors };
}

/** Headers that must be present in the uploaded file for a given deal type. */
export function requiredHeaders(type: 'direct' | 'degum'): string[] {
  return SPECS[type].filter((c) => c.imp?.required).map((c) => c.header);
}
