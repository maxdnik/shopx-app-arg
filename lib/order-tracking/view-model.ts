// Customer tracking rules shared conceptually with usa-shopbox/src/features/orders/customer/view-model.ts.
// Keep projections read-only; carrier scans never promote the whole order.
import { resolveOrderStatus } from "./order-status";
import type { LocalTracking } from "./local-tracking";

export type DeliveryRow = {
  key: string; itemIndex: number | null; title: string; store: string;
  carrier: string; number: string; url: string; status: string;
  eta: string | null; etaEnd: string | null; deliveredAt: string | null;
  eventAt: string | null; checkedAt: string | null;
  confirmedMiami: boolean; review: boolean; refunded: boolean; direct: boolean;
};
export type CustomerDelivery = {
  rows: DeliveryRow[];
  estimatedMiamiAt: string | null;
  paidARS: number | null;
  purchases: { purchased: boolean; at: string | null }[];
};
export type CustomerOrderView = {
  _id: string; orderNumber?: string; status: string; totalUSD: number;
  totalARS?: number; paidAt?: string | null; paymentStatus?: string;
  createdAt?: string | null; updatedAt?: string | null;
  delivery?: CustomerDelivery;
  items: { title: string; image?: string; qty: number; priceUSD: number; estimatedUSD?: number; selections?: Record<string, unknown> }[];
  pricingBreakdown?: { key?: string; label: string; amount: number }[];
  buyer?: { fullName?: string; address?: string; city?: string; province?: string; postalCode?: string };
  localCourierName?: string; localTrackingNumber?: string; localTracking?: LocalTracking | null;
  tracking?: { currentStep?: string; lastUpdatedAt?: string | null; miamiAt?: string | null; transitAt?: string | null; arrivedArgentinaAt?: string | null; localDeliveryAt?: string | null; deliveredAt?: string | null; history?: { step?: string; status?: string; date?: string | null }[] };
  partialShipments?: { id: string; code: string; sequence: number; itemIndexes: number[]; status: string; usaTrackingNumber?: string; localTrackingNumber?: string; localCourierName?: string; localTracking?: LocalTracking | null; history?: { status?: string; label?: string; description?: string; date?: string }[]; createdAt?: string; updatedAt?: string }[];
};
export function isoDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function money(value: number, currency = 'USD') {
  return `${currency === 'ARS' ? 'AR$' : currency} ${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function dateLabel(value: unknown, time = false, miami = false): string {
  const iso = isoDate(value);
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: time ? '2-digit' : 'long', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } as const : {}), timeZone: miami ? 'America/New_York' : 'America/Argentina/Buenos_Aires' }).format(new Date(iso));
}
export function publicTrackingUrl(carrier: string, number: string) {
  if (!/^[a-z0-9 -]{5,60}$/i.test(number)) return '';
  const name = carrier.toLowerCase().replace(/[^a-z]/g, '');
  const tracking = encodeURIComponent(number);
  if (name === 'ups' || name === 'unitedparcelservice') return `https://www.ups.com/track?tracknum=${tracking}`;
  if (name === 'usps' || name === 'unitedstatespostalservice') return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
  if (name.startsWith('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
  return '';
}
function miamiDay(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/New_York' }).formatToParts(value);
  const part = (key: string) => Number(parts.find(p => p.type === key)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day')) / 86400000;
}
export function etaText(start: unknown, end?: unknown) {
  const from = dateLabel(start, false, true);
  const to = dateLabel(end, false, true);
  return !from ? 'Por confirmar' : to && to !== from ? `${from} – ${to}` : from;
}
export function etaHint(start: unknown, end?: unknown, now = new Date()) {
  const from = isoDate(start);
  if (!from) return 'Todavía no hay una fecha informada';
  const validEnd = isoDate(end);
  const to = validEnd && validEnd > from ? validEnd : from;
  const delta = miamiDay(new Date(to)) - miamiDay(now);
  if (delta < 0) return 'Fecha estimada vencida · por confirmar';
  if (to !== from) return 'Ventana estimada · horario de Miami';
  return delta === 0 ? 'Estimado para hoy · Miami' : delta === 1 ? 'Estimado para mañana · Miami' : `Estimado en ${delta} días · Miami`;
}
const STAGES: Record<string, number> = { in_miami_warehouse: 3, in_transit: 4, arrived_argentina: 5, arrived_in_argentina: 5, shipped: 6, delivered: 7 };
const MOVING = new Set(['in_transit', 'shipped', 'out_for_delivery', 'delivered']);
export function validInbound(row: DeliveryRow) { return !row.review && !row.refunded && !row.direct; }
export function isDirectOrder(order: CustomerOrderView) {
  const rows = order.delivery?.rows || [];
  return !order.partialShipments?.length && rows.length > 0
    && rows.every(row => row.direct && !row.review && !row.refunded)
    && (rows.some(row => row.itemIndex === null) || order.items.every((_item, index) => rows.some(row => row.itemIndex === index)));
}
export function purchaseComplete(order: CustomerOrderView) {
  if (['pending_payment', 'cancelled'].includes(order.status)) return false;
  if (STAGES[order.status]) return true;
  return order.items.length > 0 && order.items.every((_item, index) => {
    const purchase = order.delivery?.purchases[index];
    return purchase?.purchased || Boolean(purchase?.at) || order.delivery?.rows.some(row => row.itemIndex === index && validInbound(row) && MOVING.has(row.status));
  });
}
export function stageOf(order: CustomerOrderView) {
  const status = resolveOrderStatus(order);
  if (status === 'cancelled') return -1;
  if (status === 'pending_payment') return 0;
  if (STAGES[status]) return STAGES[status];
  // Partial shipment progress never promotes the whole order.
  if (!order.partialShipments?.length && order.delivery?.rows.some(row => validInbound(row) && MOVING.has(row.status))) return 2;
  return purchaseComplete(order) ? 1 : 0;
}
export function paid(order: CustomerOrderView) {
  return Boolean(order.paidAt) || ['approved', 'paid', 'bonified'].includes(order.paymentStatus || '') || ['paid', 'pending_processing', 'processing', ...Object.keys(STAGES)].includes(order.status);
}
export function statusLabel(order: CustomerOrderView) {
  if (order.paymentStatus === 'refunded') return 'Reembolsado';
  if (order.paymentStatus === 'charged_back') return 'Pago revertido';
  if (order.status === 'pending_payment') return 'Pendiente de pago';
  if (order.status === 'incident') return 'En revisión';
  if (order.partialShipments?.length && stageOf(order) === 0) return 'Envíos en preparación';
  const labels: Record<number, string> = { '-1': 'Cancelado', 0: 'Compra en preparación', 1: 'Compra confirmada', 2: 'En tránsito en USA', 3: 'En depósito Miami', 4: 'En tránsito a Argentina', 5: 'Arribado a Argentina', 6: 'En entrega local', 7: 'Entregado' };
  return labels[stageOf(order)];
}
export function stageDate(order: CustomerOrderView, stage: number): string | null {
  if (stage === 1) {
    const dates = order.delivery?.purchases.map(p => p.at) || [];
    return dates.length === order.items.length && dates.length > 0 && dates.every(Boolean) ? [...dates].sort().at(-1) || null : null;
  }
  const tracking = order.tracking || {};
  const fields: Record<number, unknown> = { 3: tracking.miamiAt, 4: tracking.transitAt, 5: tracking.arrivedArgentinaAt, 6: tracking.localDeliveryAt, 7: order.status === 'delivered' ? tracking.deliveredAt : null };
  if (isoDate(fields[stage])) return isoDate(fields[stage]);
  if (stage > stageOf(order)) return null;
  const names: Record<number, string> = { 3: 'miami', 4: 'traveling', 5: 'argentina', 6: 'local_delivery', 7: 'delivered' };
  return isoDate([...(tracking.history || [])].reverse().find(row => row.step === names[stage] && isoDate(row.date))?.date);
}
export function shipmentLabel(row: DeliveryRow) {
  if (row.refunded) return 'Compra reembolsada';
  if (row.review) return 'Seguimiento en revisión';
  if (row.direct) return row.status === 'delivered' ? 'Entrega directa en Argentina' : 'Envío directo a Argentina';
  if (row.confirmedMiami) return 'Entregado a Fast Track';
  const labels: Record<string, string> = { delivered: 'Entrega informada por transportista', in_transit: 'En tránsito', shipped: 'Despachado', out_for_delivery: 'En reparto en USA', pre_transit: 'Etiqueta creada', ordered: 'Compra confirmada', delivery_exception: 'Novedad en el envío', exception: 'Novedad en el envío', failure: 'Novedad en el envío', returned: 'Devuelto al vendedor', cancelled: 'Envío cancelado' };
  return labels[row.status] || 'Pendiente de actualización';
}
export function miamiSummary(order: CustomerOrderView) {
  const title = 'Llegada estimada a depósito Miami';
  if (stageOf(order) >= 3) return { title: 'Recibido en depósito Miami', value: dateLabel(stageDate(order, 3), false, true) || 'Recepción confirmada', hint: 'Según el estado registrado de tu orden' };
  if (order.status === 'cancelled') return { title, value: 'Orden cancelada', hint: 'Sin llegada prevista' };
  if (order.status === 'pending_payment') return { title, value: 'Por confirmar', hint: 'Primero necesitamos confirmar el pago' };
  const all = order.delivery?.rows || [];
  if (all.length && all.every(row => row.direct || row.refunded || row.review)) return { title, value: 'Por confirmar', hint: 'Consultá el detalle de cada envío' };
  if (order.delivery?.estimatedMiamiAt) return { title, value: etaText(order.delivery.estimatedMiamiAt), hint: `Estimación general · ${etaHint(order.delivery.estimatedMiamiAt)}` };
  const pending = all.filter(row => row.itemIndex !== null && validInbound(row) && !row.confirmedMiami && row.status !== 'delivered');
  const dated = pending.filter(row => row.eta).sort((a, b) => String(a.eta).localeCompare(String(b.eta)));
  if (dated.length) return { title: pending.length > 1 ? 'Próxima llegada estimada a Miami' : title, value: etaText(dated[0].eta, dated[0].etaEnd), hint: pending.length > 1 ? `${dated.length} de ${pending.length} paquetes con fecha · ver detalle` : etaHint(dated[0].eta, dated[0].etaEnd) };
  if (all.some(row => validInbound(row) && (row.confirmedMiami || row.status === 'delivered'))) return { title, value: 'Recepción por confirmar', hint: 'Hay entregas informadas. Ver detalle por paquete.' };
  return { title, value: 'Por confirmar', hint: 'La fecha aparecerá cuando esté informada' };
}
export function variantLabels(selections?: Record<string, unknown>) {
  const names: Record<string, string> = { size: 'Talle', talla: 'Talle', talle: 'Talle', color: 'Color', colour: 'Color', style: 'Modelo' };
  return Object.entries(selections || {}).flatMap(([key, value]) => typeof value === 'string' || typeof value === 'number' ? [`${names[key.toLowerCase()] || key}: ${value}`] : []);
}

