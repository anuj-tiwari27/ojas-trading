export interface Ref {
  id: string;
  name?: string;
  code?: string;
}

export interface TradeStatus {
  id: string;
  name: string;
  color: string | null;
  isClosed: boolean;
}

export interface Trade {
  id: string;
  tradeNo: string;
  tradeDate: string;
  side: 'PURCHASE' | 'SALE' | 'BACK_TO_BACK';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  quantity: string;
  price: string;
  grossValue: string;
  profit: string;
  marginPct: string;
  remarks?: string | null;
  expectedDelivery?: string | null;
  actualDelivery?: string | null;
  deliveryLocation?: string | null;
  product?: Ref | null;
  customer?: Ref | null;
  vendor?: Ref | null;
  broker?: Ref | null;
  unit?: Ref | null;
  warehouse?: Ref | null;
  currency?: { code: string; symbol?: string } | null;
  status?: TradeStatus | null;
  paymentTerm?: Ref | null;
  timeline?: TimelineEntry[];
  createdAt: string;
}

export interface TimelineEntry {
  id: string;
  event: string;
  title: string;
  detail?: string | null;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
}
