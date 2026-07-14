export type Fmt = 'money' | 'num' | 'qty' | 'date' | 'badge' | 'bool' | 'text';
export type FieldType = 'text' | 'number' | 'date' | 'select';

export interface DealColumn {
  key: string; // supports dot-path e.g. "mainParty.name"
  label: string;
  fmt?: Fmt;
}
export interface DealField {
  key: string;
  label: string;
  type: FieldType;
  /** 'parties' = any party; 'self-parties' = only Self firms; 'products' = products */
  ref?: 'parties' | 'self-parties' | 'products';
  options?: { value: string; label: string }[];
  required?: boolean;
  bool?: boolean; // select that maps to boolean
  /** Show this field only when the predicate holds (based on current form values). */
  showWhen?: (form: Record<string, string>) => boolean;
}
export interface RowChip {
  color: string;
  label: string;
}
export interface FilterSpec {
  key: string;
  label: string;
  kind: 'select' | 'product' | 'party';
  options?: { value: string; label: string }[];
}
export interface DealType {
  slug: string;
  label: string;
  endpoint: string;
  idKey: string;
  columns: DealColumn[];
  fields: DealField[];
  /** Filter controls shown in the filter panel. */
  filters?: FilterSpec[];
  /** Server-side sort options (value = a whitelisted scalar column). */
  sorts?: { label: string; value: string }[];
  /** Optional per-row status dot shown at the left of the row. */
  rowChip?: (row: any) => RowChip | null;
  /** Legend shown above the table when rowChip is set. */
  chipLegend?: RowChip[];
}

const SIDE = [
  { value: 'BUY', label: 'Buy' },
  { value: 'SELL', label: 'Sell' },
];
const DIRECT_KIND = [
  { value: 'PRINCIPAL', label: 'Principal (Self firm)' },
  { value: 'BROKERAGE', label: 'Broker (Buyer ↔ Seller)' },
];
const isPrincipal = (f: Record<string, string>) => (f.kind ?? 'PRINCIPAL') === 'PRINCIPAL';
const isBrokerage = (f: Record<string, string>) => f.kind === 'BROKERAGE';
const PAY_STATUS = ['PENDING', 'PARTIAL', 'PAID'].map((v) => ({ value: v, label: v }));
const DEGUM_STATUS = ['OPEN', 'SHIPMENT_CONFIRMED', 'DELIVERED', 'CLOSED'].map((v) => ({ value: v, label: v }));
const YESNO = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

export const DEAL_TYPES: Record<string, DealType> = {
  'direct-deals': {
    slug: 'direct-deals',
    label: 'Direct Deals',
    endpoint: '/direct-deals',
    idKey: 'dealNo',
    // Colour driven by the Due / Delivery Date and days left.
    rowChip: (r: any): RowChip | null => {
      const dl = r.daysLeft; // = Due/Delivery Date − today; null if no due date
      if (dl == null) return { color: '#3b82f6', label: 'No due date set' };
      if (dl < 0) return { color: '#ef4444', label: `Overdue — ${Math.abs(dl)} day(s) past due` };
      if (dl <= 3) return { color: '#f59e0b', label: `Due soon — ${dl} day(s) left` };
      return { color: '#22c55e', label: 'On track — more than 3 days to due date' };
    },
    chipLegend: [
      { color: '#3b82f6', label: 'No due date' },
      { color: '#22c55e', label: 'More than 3 days' },
      { color: '#f59e0b', label: 'Less than 3 days' },
      { color: '#ef4444', label: 'Overdue' },
    ],
    filters: [
      { key: 'side', label: 'Side', kind: 'select', options: SIDE },
      { key: 'status', label: 'Status', kind: 'select', options: ['OPEN', 'CLOSED', 'CANCELLED'].map((v) => ({ value: v, label: v })) },
      { key: 'paymentStatus', label: 'Payment', kind: 'select', options: PAY_STATUS },
      { key: 'productId', label: 'Material', kind: 'product' },
      { key: 'mainPartyId', label: 'Main Party', kind: 'party' },
    ],
    sorts: [
      { label: 'Date', value: 'date' },
      { label: 'Deal ID', value: 'dealNo' },
      { label: 'Qty', value: 'quantity' },
      { label: 'Rate', value: 'rate' },
      { label: 'Value', value: 'value' },
      { label: 'MTM', value: 'mtm' },
      { label: 'Brokerage Total', value: 'brokerageTotal' },
      { label: 'Due Date', value: 'dueDate' },
    ],
    columns: [
      { key: 'dealNo', label: 'Deal ID' },
      { key: 'date', label: 'Date', fmt: 'date' },
      { key: 'kind', label: 'Type', fmt: 'badge' },
      { key: 'side', label: 'Side', fmt: 'badge' },
      { key: 'mainParty.name', label: 'Main Party' },
      { key: 'selfParty.name', label: 'Self Firm' },
      { key: 'buyerParty.name', label: 'Buyer' },
      { key: 'sellerParty.name', label: 'Seller' },
      { key: 'product.code', label: 'Material' },
      { key: 'quantity', label: 'Qty (MT)', fmt: 'qty' },
      { key: 'rate', label: 'Rate', fmt: 'money' },
      { key: 'value', label: 'Value', fmt: 'money' },
      { key: 'marketRate', label: 'Market Rate', fmt: 'money' },
      { key: 'mtm', label: 'MTM', fmt: 'money' },
      { key: 'brokerageRate', label: 'Brokerage ₹/MT', fmt: 'money' },
      { key: 'buyerBrokerageTotal', label: 'Buyer Brokerage', fmt: 'money' },
      { key: 'sellerBrokerageTotal', label: 'Seller Brokerage', fmt: 'money' },
      { key: 'brokerageTotal', label: 'Brokerage Total', fmt: 'money' },
      { key: 'dueDate', label: 'Due', fmt: 'date' },
      { key: 'daysLeft', label: 'Days Left', fmt: 'num' },
      { key: 'paymentStatus', label: 'Payment', fmt: 'badge' },
    ],
    fields: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'kind', label: 'Deal Type', type: 'select', options: DIRECT_KIND },
      // PRINCIPAL — Self firm buys/sells
      { key: 'side', label: 'Buy / Sell (Self firm side)', type: 'select', options: SIDE, required: true, showWhen: isPrincipal },
      { key: 'mainPartyId', label: 'Main Party', type: 'select', ref: 'parties', showWhen: isPrincipal },
      { key: 'selfPartyId', label: 'Self Firm', type: 'select', ref: 'self-parties', showWhen: isPrincipal },
      // BROKERAGE — external buyer ↔ seller, two brokerages
      { key: 'buyerPartyId', label: 'Buyer', type: 'select', ref: 'parties', required: true, showWhen: isBrokerage },
      { key: 'sellerPartyId', label: 'Seller', type: 'select', ref: 'parties', required: true, showWhen: isBrokerage },
      { key: 'productId', label: 'Material', type: 'select', ref: 'products' },
      { key: 'quantity', label: 'Qty (MT)', type: 'number', required: true },
      { key: 'rate', label: 'Rate (₹/MT)', type: 'number', required: true },
      { key: 'marketRate', label: 'Market Rate (₹/MT)', type: 'number', showWhen: isPrincipal },
      { key: 'brokerageRate', label: 'Brokerage (₹/MT)', type: 'number', showWhen: isPrincipal },
      { key: 'buyerBrokerageRate', label: 'Buyer Brokerage (₹/MT)', type: 'number', showWhen: isBrokerage },
      { key: 'sellerBrokerageRate', label: 'Seller Brokerage (₹/MT)', type: 'number', showWhen: isBrokerage },
      { key: 'dueDate', label: 'Due / Delivery Date', type: 'date' },
      { key: 'paymentStatus', label: 'Payment Status', type: 'select', options: PAY_STATUS },
      { key: 'remarks', label: 'Remarks', type: 'text' },
    ],
  },

  'degum-deals': {
    slug: 'degum-deals',
    label: 'Degum Deals',
    endpoint: '/degum-deals',
    idKey: 'dealNo',
    // Colour driven by the Payment Due date and days left.
    rowChip: (r: any): RowChip | null => {
      const dl = r.daysLeft; // = Payment Due date − today; null if no due date
      if (dl == null) return { color: '#3b82f6', label: 'Pending — no payment due date' };
      if (dl < 0) return { color: '#ef4444', label: `Overdue — payment ${Math.abs(dl)} day(s) past due` };
      if (dl <= 3) return { color: '#f59e0b', label: `Due soon — ${dl} day(s) remaining` };
      return { color: '#22c55e', label: 'OK — within payment window' };
    },
    chipLegend: [
      { color: '#3b82f6', label: 'No due date' },
      { color: '#22c55e', label: 'More than 3 days' },
      { color: '#f59e0b', label: 'Less than 3 days' },
      { color: '#ef4444', label: 'Overdue' },
    ],
    filters: [
      { key: 'status', label: 'Status', kind: 'select', options: DEGUM_STATUS },
      { key: 'paymentStatus', label: 'Payment', kind: 'select', options: PAY_STATUS },
      { key: 'productId', label: 'Material', kind: 'product' },
      { key: 'mainPartyId', label: 'Main Party', kind: 'party' },
    ],
    sorts: [
      { label: 'Date', value: 'dealDate' },
      { label: 'Deal ID', value: 'dealNo' },
      { label: 'Qty', value: 'quantity' },
      { label: 'Buy Rate', value: 'buyRate' },
      { label: 'Sell Rate', value: 'sellRate' },
      { label: 'Gross Margin', value: 'grossMargin' },
      { label: 'Payment Due', value: 'paymentDueDate' },
    ],
    columns: [
      { key: 'dealNo', label: 'Deal ID' },
      { key: 'dealDate', label: 'Date', fmt: 'date' },
      { key: 'product.code', label: 'Material' },
      { key: 'shipmentMonth', label: 'Shipment Month' },
      { key: 'originPort', label: 'Origin/Port' },
      { key: 'mainParty.name', label: 'Main Party' },
      { key: 'selfParty.name', label: 'Self Firm' },
      { key: 'quantity', label: 'Qty (MT)', fmt: 'qty' },
      { key: 'buyRate', label: 'Buy Rate', fmt: 'money' },
      { key: 'sellRate', label: 'Sell Rate', fmt: 'money' },
      { key: 'buyValue', label: 'Buy Value', fmt: 'money' },
      { key: 'sellValue', label: 'Sell Value', fmt: 'money' },
      { key: 'grossMargin', label: 'Gross Margin', fmt: 'money' },
      { key: 'brokerageRate', label: 'Brokerage ₹/MT', fmt: 'money' },
      { key: 'brokerageTotal', label: 'Brokerage Total', fmt: 'money' },
      { key: 'shipNameReceived', label: 'Ship Name?', fmt: 'bool' },
      { key: 'vessel', label: 'Vessel' },
      { key: 'paymentDueDate', label: 'Payment Due', fmt: 'date' },
      { key: 'daysLeft', label: 'Days Left', fmt: 'num' },
      { key: 'paymentStatus', label: 'Payment', fmt: 'badge' },
      { key: 'status', label: 'Status', fmt: 'badge' },
    ],
    fields: [
      { key: 'dealDate', label: 'Deal Date', type: 'date' },
      { key: 'productId', label: 'Material (Degum)', type: 'select', ref: 'products' },
      { key: 'shipmentMonth', label: 'Shipment Month', type: 'text' },
      { key: 'originPort', label: 'Origin / Port', type: 'text' },
      { key: 'mainPartyId', label: 'Main Party', type: 'select', ref: 'parties' },
      { key: 'selfPartyId', label: 'Self Firm', type: 'select', ref: 'self-parties' },
      { key: 'quantity', label: 'Qty (MT)', type: 'number', required: true },
      { key: 'buyRate', label: 'Buy Rate (₹/MT)', type: 'number', required: true },
      { key: 'sellRate', label: 'Sell Rate (₹/MT)', type: 'number', required: true },
      { key: 'brokerageRate', label: 'Brokerage (₹/MT)', type: 'number' },
      { key: 'shipNameReceived', label: 'Ship Name Received?', type: 'select', options: YESNO, bool: true },
      { key: 'vessel', label: 'Ship Name / Vessel', type: 'text' },
      { key: 'paymentDueDate', label: 'Payment Due Date', type: 'date' },
      { key: 'paymentStatus', label: 'Payment Status', type: 'select', options: PAY_STATUS },
      { key: 'status', label: 'Status', type: 'select', options: DEGUM_STATUS },
      { key: 'remarks', label: 'Remarks', type: 'text' },
    ],
  },
};

export const DEAL_LIST = Object.values(DEAL_TYPES);
export function findDeal(slug: string) {
  return DEAL_TYPES[slug];
}
