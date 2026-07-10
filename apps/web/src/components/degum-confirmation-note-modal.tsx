'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, FileText, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiGet } from '@/lib/api';
import { formatNumber } from '@/lib/format';

interface Company {
  name: string; legalName?: string | null; addressLine?: string | null;
  city?: string | null; state?: string | null; pincode?: string | null;
  phone?: string | null; email?: string | null; gstin?: string | null;
}

// A broker's "Confirmation Note" for a Degum deal — models the client's sample
// JDM/2627062002. Seller/commodity/shipment/qty/brokerage are pulled from the
// deal; the terms & specification are editable before download.
interface CNData {
  firmName: string; firmAddress: string; firmEmail: string; firmPhone: string;
  confirmationNo: string; date: string;
  sellerName: string; sellerAddress: string;
  buyerName: string; buyerAddress: string;
  commodity: string; specification: string;
  port: string; payment: string; shipment: string; lifting: string;
  quantity: string; tolerance: string; quantityWords: string;
  price: string; brokerage: string;
  otherTerms: string; // one clause per line
}

const DEFAULT_TERMS = [
  'Any change in duty, tariff, additional duty, Govt. policies etc. on Buyer’s account.',
  'Loading must take place under a surveyor’s supervision, failing which we do not take responsibility for any quality issues at the loading port or elsewhere.',
  'This contract is entered into subject to the General Terms & Conditions for the purpose of Oils & Fats & the By-laws of the Indian Vegetable Oil Processors Association, Mumbai. Further, we have brought about this contract in our capacity as Broker (Agent) for both the Seller & the Buyer and hence it is subject to the Law of Agency & other contents of the Indian Contract Act 1872. As we are acting only as Broker, we will not be liable and/or responsible whatsoever for non-performance of contract.',
].join('\n');

const DEFAULT_LIFTING =
  '10 days from PHO date or from the date of receipt of tank terminal details, whichever is later.';

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function dmy(v?: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Indian-style number-to-words for a whole number (used for the quantity). */
function inWords(value: number): string {
  const n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number): string => (x < 20 ? a[x] : (b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '')));
  const three = (x: number): string => {
    const h = Math.floor(x / 100), r = x % 100;
    return (h ? a[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? two(r) : '');
  };
  let rem = n;
  const parts: string[] = [];
  const crore = Math.floor(rem / 10000000); rem %= 10000000;
  const lakh = Math.floor(rem / 100000); rem %= 100000;
  const thousand = Math.floor(rem / 1000); rem %= 1000;
  if (crore) parts.push(two(crore) + ' Crore');
  if (lakh) parts.push(two(lakh) + ' Lakh');
  if (thousand) parts.push(two(thousand) + ' Thousand');
  if (rem) parts.push(three(rem));
  return parts.join(' ').trim();
}

function cnStyle(): string {
  return `
  .dc { box-sizing: border-box; width: 190mm; margin: 0 auto; padding: 8mm 10mm; background: #fff; color: #000;
        font-family: 'Times New Roman', Georgia, serif; font-size: 12px; line-height: 1.35; }
  .dc * { box-sizing: border-box; }
  .dc-firm { text-align: center; }
  .dc-firm h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 1px; }
  .dc-firm .addr { font-size: 8.5px; margin-top: 3px; line-height: 1.3; }
  .dc-rule { border-bottom: 2px solid #000; margin: 5px 0 7px; }
  .dc-head { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; }
  .dc-intro { font-size: 10.5px; font-weight: 700; margin: 5px 0 6px; text-transform: uppercase; }
  table.dc-kv { width: 100%; border-collapse: collapse; border: 1.5px solid #000; }
  table.dc-kv td { border: 1px solid #000; padding: 3px 7px; vertical-align: top; font-size: 11px; text-transform: uppercase; }
  table.dc-kv td.k { width: 148px; font-weight: 700; }
  table.dc-kv td.v { font-weight: 700; }
  .dc-kv .party { font-weight: 700; font-style: italic; }
  .dc-kv .nominee { font-weight: 400; font-style: italic; padding-left: 14px; }
  table.dc-terms { width: 100%; border-collapse: collapse; }
  table.dc-terms td { border: none; padding: 1px 4px 3px; vertical-align: top; font-size: 10.5px; font-weight: 400; text-transform: uppercase; }
  table.dc-terms td.num { width: 22px; text-align: right; font-weight: 700; }
  .dc-foot { margin-top: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .dc-sign { margin-top: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
  .dc-sign .sig-space { height: 46px; }
  @media print { body { margin: 0; } .dc { width: auto; box-shadow: none; padding: 6mm 8mm; } }
  `;
}

function partyBlock(name: string, address: string): string {
  const addr = String(address ?? '')
    .split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => `<div class="party">${esc(l)}</div>`).join('');
  return `<div class="party">${esc(name || '—')}</div>${addr}<div class="nominee">&/OR THEIR NOMINEE</div>`;
}

function cnBody(d: CNData): string {
  const kv = (k: string, v: string) => `<tr><td class="k">${esc(k)}</td><td class="v">${v}</td></tr>`;
  const qtyLine = [
    [d.quantity && `${esc(d.quantity)} MTs`, esc(d.tolerance)].filter(Boolean).join(' '),
    d.quantityWords ? `(${esc(d.quantityWords)})` : '',
  ].filter(Boolean).join(' &nbsp; ');
  const terms = d.otherTerms.split('\n').map((t) => t.trim()).filter(Boolean);
  const termsHtml = terms.length
    ? `<table class="dc-terms">${terms.map((t, i) => `<tr><td class="num">${i + 1}</td><td>${esc(t)}</td></tr>`).join('')}</table>`
    : '—';
  const firmLine = [
    d.firmAddress && `Address: ${d.firmAddress}`,
    d.firmEmail && `Email Id: ${d.firmEmail}`,
    d.firmPhone && `Mo No: ${d.firmPhone}`,
  ].filter(Boolean).map(esc).join(' &nbsp;|&nbsp; ');

  return `
  <div class="dc">
    <div class="dc-firm">
      <h1>${esc(d.firmName || 'Ojas Trading')}</h1>
      ${firmLine ? `<div class="addr">${firmLine}</div>` : ''}
    </div>
    <div class="dc-rule"></div>
    <div class="dc-head">
      <span>Confirmation Note No.: ${esc(d.confirmationNo || '—')}</span>
      <span>DATED ${esc(d.date || '—')}.</span>
    </div>
    <div class="dc-intro">Under your instruction and order, we confirm having concluded on account of the parties
      mentioned below for following transaction on following terms &amp; conditions:</div>
    <table class="dc-kv">
      ${kv('Sellers', partyBlock(d.sellerName, d.sellerAddress))}
      ${kv('Buyers', partyBlock(d.buyerName, d.buyerAddress))}
      ${kv('Commodity', esc(d.commodity || '—'))}
      ${kv('Specification', esc(d.specification || '—'))}
      ${kv('Port', esc(d.port || '—'))}
      ${kv('Payment', esc(d.payment || '—'))}
      ${kv('Shipment', esc(d.shipment || '—'))}
      ${kv('Lifting', esc(d.lifting || '—'))}
      ${kv('Quantity', qtyLine || '—')}
      ${kv('Approx Parity Price (Rs.)', esc(d.price || '—'))}
      ${kv('Other Terms', termsHtml)}
      ${kv('Brokerage', esc(d.brokerage || '—'))}
    </table>
    <div class="dc-foot">Our detailed confirmation note no. ${esc(d.confirmationNo || '—')} dated ${esc(d.date || '—')} follows.</div>
    <div class="dc-sign"><div class="sig-space"></div>${esc(d.firmName || 'Ojas Trading')}</div>
  </div>`;
}

function printNote(d: CNData) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.confirmationNo || 'confirmation-note')}</title><style>${cnStyle()}</style></head><body>${cnBody(d)}</body></html>`;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  iframe.srcdoc = html;
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => iframe.remove(), 1500);
    }
  };
  document.body.appendChild(iframe);
}

export function DegumConfirmationNoteModal({
  open,
  onClose,
  deal,
}: {
  open: boolean;
  onClose: () => void;
  deal: any | null;
}) {
  const companyQ = useQuery({
    queryKey: ['settings', 'company'],
    queryFn: () => apiGet<Company>('/settings/company'),
    enabled: open,
  });

  const initial = useMemo<CNData>(() => {
    const c = companyQ.data;
    const firmName = c?.legalName || c?.name || 'Ojas Trading';
    const firmAddress = [c?.addressLine, c?.city, [c?.state, c?.pincode].filter(Boolean).join('-')].filter(Boolean).join(', ');
    const firmEmail = c?.email ?? '';
    const firmPhone = c?.phone ?? '';

    const d = deal ?? {};
    const seller = d.mainParty ?? {};
    const commodity = (d.product?.name ?? d.product?.code ?? '').toUpperCase();
    const qty = d.quantity != null ? Number(d.quantity) : null;
    const sellRate = d.sellRate != null ? Number(d.sellRate) : null;

    return {
      firmName,
      firmAddress,
      firmEmail,
      firmPhone,
      confirmationNo: d.dealNo ?? '',
      date: dmy(d.dealDate),
      sellerName: seller.name ?? '',
      sellerAddress: [seller.city, seller.state].filter(Boolean).join(', '),
      buyerName: '',
      buyerAddress: '',
      commodity,
      specification: '',
      port: d.originPort ?? '',
      payment: '',
      shipment: d.shipmentMonth ? `${d.shipmentMonth} Shipment` : '',
      lifting: DEFAULT_LIFTING,
      quantity: qty != null ? formatNumber(qty, qty % 1 ? 3 : 0) : '',
      tolerance: '±2% at Seller’s option',
      quantityWords: qty != null ? `${inWords(qty)} MTs` : '',
      price: sellRate != null ? `Rs. ${formatNumber(sellRate, 2)} per MT` : '',
      brokerage: d.brokerageRate != null ? `Rs. ${formatNumber(Number(d.brokerageRate), 0)}/- PMT (plus applicable GST)` : '',
      otherTerms: DEFAULT_TERMS,
    };
  }, [deal, companyQ.data]);

  const [data, setData] = useState<CNData>(initial);
  useEffect(() => setData(initial), [initial]);

  if (!open || !deal) return null;

  // Plain function (not a nested component) so inputs keep focus while typing.
  const field = (label: string, k: keyof CNData, placeholder?: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={data[k]} placeholder={placeholder} onChange={(e) => setData((s) => ({ ...s, [k]: e.target.value }))} />
    </div>
  );
  const area = (label: string, k: keyof CNData, rows = 3, placeholder?: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea rows={rows} value={data[k]} placeholder={placeholder} onChange={(e) => setData((s) => ({ ...s, [k]: e.target.value }))} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-6xl flex-col rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4" /> Confirmation Note · {deal.dealNo}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-2">
          {/* Editable fields */}
          <div className="space-y-4 overflow-y-auto border-r border-border p-5">
            <p className="text-xs text-muted-foreground">
              Seller, commodity, shipment, quantity &amp; brokerage are pulled from the deal. Add the buyer
              and terms below, then download.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {field('Confirmation Note No.', 'confirmationNo')}
              {field('Date', 'date', 'dd.mm.yyyy')}
            </div>

            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Sellers</p>
              {field('Name', 'sellerName')}
              <div className="mt-3">{area('Address', 'sellerAddress', 2, 'One line per row')}</div>
            </div>

            <div className="rounded-md border border-dashed border-border p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Buyers (onward — not stored on the deal)</p>
              {field('Name', 'buyerName')}
              <div className="mt-3">{area('Address', 'buyerAddress', 2, 'One line per row')}</div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {field('Commodity', 'commodity')}
              {field('Specification', 'specification', 'e.g. FFA below 1%, acceptable with a single rebate 1-2%')}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {field('Port', 'port', 'e.g. Ex Tank Kandla')}
              {field('Payment', 'payment', 'e.g. Advance Payment')}
              {field('Shipment', 'shipment', 'e.g. August 2026 Shipment')}
              {field('Brokerage', 'brokerage')}
            </div>

            {area('Lifting', 'lifting', 2)}

            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Quantity &amp; Price</p>
              <div className="grid grid-cols-2 gap-3">
                {field('Quantity (MT)', 'quantity')}
                {field('Tolerance', 'tolerance')}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3">
                {field('Quantity in words', 'quantityWords')}
                {field('Approx Parity Price', 'price', 'e.g. Rs. 1202 per 10 kgs + Duty / IGST')}
              </div>
            </div>

            {area('Other Terms (one clause per line)', 'otherTerms', 6)}
          </div>

          {/* Live preview */}
          <div className="overflow-y-auto bg-muted/40 p-5">
            <div className="origin-top scale-[0.92] rounded-md border border-border bg-white shadow-sm">
              <div dangerouslySetInnerHTML={{ __html: `<style>${cnStyle()}</style>${cnBody(data)}` }} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => printNote(data)}>
            <Download className="size-4" /> Download / Print
          </Button>
        </div>
      </div>
    </div>
  );
}
