import { format } from 'date-fns';

export function formatCurrency(value: number | string, currency = 'INR') {
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(isNaN(n) ? 0 : n);
}

export function formatNumber(value: number | string, digits = 2) {
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: digits,
  }).format(isNaN(n) ? 0 : n);
}

export function formatDate(value?: string | Date | null, pattern = 'dd MMM yyyy') {
  if (!value) return '—';
  try {
    return format(new Date(value), pattern);
  } catch {
    return '—';
  }
}

export function formatDateTime(value?: string | Date | null) {
  return formatDate(value, 'dd MMM yyyy, HH:mm');
}

export function formatPct(value: number | string) {
  const n = typeof value === 'string' ? Number(value) : value;
  return `${(isNaN(n) ? 0 : n).toFixed(2)}%`;
}
