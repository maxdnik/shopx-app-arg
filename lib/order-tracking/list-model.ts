// Customer tracking rules shared conceptually with usa-shopbox/src/features/orders/customer/list-model.ts.
// Keep projections read-only; carrier scans never promote the whole order.
import {
  type CustomerOrderView, type DeliveryRow, dateLabel, etaHint, isoDate,
  isDirectOrder, purchaseComplete, stageDate, stageOf, statusLabel, validInbound,
} from './view-model';

export type OrderFilter = 'all' | 'active' | 'delivered' | 'cancelled';
export type Tone = 'blue' | 'green' | 'amber' | 'muted';
export type Milestone = { label: string; value: string; hint: string; tone: Tone; eta?: string; etaEnd?: string | null };

export function orderGroup(order: CustomerOrderView): Exclude<OrderFilter, 'all'> {
  if (order.status === 'cancelled' || ['refunded', 'charged_back'].includes(order.paymentStatus || '')) return 'cancelled';
  return order.status === 'delivered' ? 'delivered' : 'active';
}

export function productCount(order: CustomerOrderView) {
  return order.items.reduce((sum, item) => sum + (Number.isFinite(item.qty) && item.qty > 0 ? item.qty : 1), 0);
}

export function storedARS(order: CustomerOrderView): number | null {
  // A missing stored amount is not a zero payment or today's FX conversion.
  const value = order.delivery ? order.delivery.paidARS : order.totalARS;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function searchable(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function filterOrders(orders: CustomerOrderView[], filter: OrderFilter, query: string) {
  const words = searchable(query).replace(/#/g, '').split(/\s+/).filter(Boolean);
  return orders.filter(order => {
    if (filter !== 'all' && orderGroup(order) !== filter) return false;
    const haystack = searchable([order.orderNumber, order._id, ...order.items.map(item => item.title)].join(' '));
    return words.every(word => haystack.includes(word));
  }).sort((a, b) => String(isoDate(b.createdAt) || '').localeCompare(String(isoDate(a.createdAt) || '')));
}

function pendingRows(order: CustomerOrderView) {
  return (order.delivery?.rows || []).filter(row =>
    validInbound(row) && !row.confirmedMiami && row.status !== 'delivered' && !['cancelled', 'returned'].includes(row.status),
  );
}

function eligibleForMiami(order: CustomerOrderView) {
  if (orderGroup(order) !== 'active' || order.status === 'pending_payment' || stageOf(order) >= 3) return false;
  const rows = order.delivery?.rows || [];
  return !rows.length || pendingRows(order).length > 0;
}

function miamiEstimates(order: CustomerOrderView): { start: string; end: string | null; general: boolean; partial: boolean }[] {
  if (!eligibleForMiami(order)) return [];
  const general = isoDate(order.delivery?.estimatedMiamiAt);
  if (general) return [{ start: general, end: null, general: true, partial: false }];
  const candidates = pendingRows(order).filter(row => row.itemIndex !== null && isoDate(row.eta));
  candidates.sort((a, b) => String(a.eta).localeCompare(String(b.eta)));
  return candidates.map(row => {
    const start = isoDate(row.eta)!;
    const end = isoDate(row.etaEnd);
    return { start, end: end && end > start ? end : null, general: false, partial: pendingRows(order).filter(item => item.itemIndex !== null).length > 1 };
  });
}

export function miamiEstimate(order: CustomerOrderView) {
  return miamiEstimates(order)[0] || null;
}

function miamiDay(value: string | Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const number = (key: string) => Number(parts.find(part => part.type === key)?.value);
  return Date.UTC(number('year'), number('month') - 1, number('day'));
}

export function compactEta(start: string, end: string | null = null) {
  const from = new Date(start);
  const to = end ? new Date(end) : from;
  const parts = (date: Date) => new Intl.DateTimeFormat('es-AR', { timeZone: 'America/New_York', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(date);
  const a = parts(from), b = parts(to);
  const get = (p: Intl.DateTimeFormatPart[], type: string) => p.find(item => item.type === type)?.value || '';
  if (miamiDay(from) === miamiDay(to)) return `${get(a, 'day')} ${get(a, 'month')} ${get(a, 'year')}`;
  if (get(a, 'month') === get(b, 'month') && get(a, 'year') === get(b, 'year')) return `${get(a, 'day')} – ${get(b, 'day')} ${get(b, 'month')} ${get(b, 'year')}`;
  return `${dateLabel(start, false, true)} – ${dateLabel(end, false, true)}`;
}

export function listSummary(orders: CustomerOrderView[], now = new Date()) {
  const active = orders.filter(order => orderGroup(order) === 'active');
  const estimates = active.flatMap(order => {
    return miamiEstimates(order).map(eta => ({ ...eta, orderNumber: order.orderNumber || order._id }));
  });
  const upcoming = estimates.filter(eta => miamiDay(eta.end || eta.start) >= miamiDay(now));
  upcoming.sort((a, b) => a.start.localeCompare(b.start));
  return {
    active: active.length,
    miami: active.filter(order => stageOf(order) === 3).length,
    delivered: orders.filter(order => orderGroup(order) === 'delivered').length,
    next: upcoming[0] || null,
    overdue: estimates.length - upcoming.length,
  };
}

export function listStatus(order: CustomerOrderView): { label: string; description: string; tone: Tone; stage: number } {
  const stage = stageOf(order);
  if (order.paymentStatus === 'refunded') return { label: 'Reembolsado', description: 'El pago figura como reembolsado.', tone: 'muted', stage: -1 };
  if (order.paymentStatus === 'charged_back') return { label: 'Pago revertido', description: 'Consultá el detalle de este pedido.', tone: 'muted', stage: -1 };
  if (order.status === 'cancelled') return { label: 'Cancelado', description: 'Este pedido fue cancelado.', tone: 'muted', stage: -1 };
  if (order.status === 'pending_payment') return { label: 'Pendiente de pago', description: 'Falta confirmar el pago para avanzar.', tone: 'amber', stage: 0 };
  if (order.status === 'incident') return { label: 'En revisión', description: 'Hay una incidencia en este pedido. Consultá el detalle.', tone: 'amber', stage };
  const rows = order.delivery?.rows || [];
  if (stage < 3 && rows.some(row => row.review || row.refunded || /exception|failure|returned|incident/.test(row.status))) return { label: 'Seguimiento en revisión', description: 'Hay una novedad en uno de los paquetes. Consultá el detalle.', tone: 'amber', stage };
  if (stage < 3 && rows.length && rows.every(row => row.direct && !row.review && !row.refunded)) return { label: 'Envío directo a Argentina', description: 'Este envío no pasa por el depósito de Miami.', tone: 'blue', stage };
  const descriptions: Record<number, string> = {
    0: 'Estamos preparando la compra de tus productos en USA.',
    1: 'La compra en origen está confirmada. Próximo paso: despacho del vendedor.',
    2: 'Tu paquete está en camino a nuestro depósito en Miami.',
    3: 'Tu pedido llegó al depósito de Miami y está siendo procesado.',
    4: 'Tu pedido está viajando desde Miami hacia Argentina.',
    5: 'Tu pedido llegó al país y está en gestión previa al despacho local.',
    6: 'El correo local tiene tu pedido para la entrega final.',
    7: 'Tu pedido fue entregado. ¡Que lo disfrutes!',
  };
  return {
    label: statusLabel(order),
    description: order.partialShipments?.length && stage < 7 ? 'Este es el estado general. Cada envío parcial tiene su propio seguimiento.' : descriptions[stage] || 'Consultá el detalle de tu pedido.',
    tone: stage === 7 ? 'green' : 'blue', stage,
  };
}

export function orderMilestone(order: CustomerOrderView, now = new Date()): Milestone {
  const status = listStatus(order);
  if (status.stage < 0) return { label: 'Estado del pedido', value: status.label, hint: 'Ver detalles de la orden', tone: 'muted' };
  if (order.status === 'pending_payment') return { label: 'Próximo paso', value: 'Confirmar pago', hint: 'Sin fecha de llegada informada', tone: 'amber' };
  if (status.label === 'Envío directo a Argentina') return { label: 'Destino del envío', value: 'Argentina', hint: 'Seguimiento directo · ver detalles', tone: 'blue' };
  const stage = stageOf(order);
  if (stage >= 3) {
    const labels: Record<number, string> = { 3: 'Recibido en Miami', 4: 'Salida hacia Argentina', 5: 'Arribado a Argentina', 6: 'Despachado al correo local', 7: 'Entregado el' };
    const hints: Record<number, string> = { 3: 'Próximo paso: vuelo a Argentina', 4: 'Próximo paso: arribo a Argentina', 5: 'Próximo paso: envío local', 6: 'Próximo paso: entrega en tu domicilio', 7: 'Entrega confirmada' };
    return { label: labels[stage], value: dateLabel(stageDate(order, stage), false, stage === 3) || 'Fecha no informada', hint: hints[stage], tone: stage === 7 ? 'green' : 'blue' };
  }
  const eta = miamiEstimate(order);
  if (eta) return { label: eta.partial ? 'Próxima llegada a Miami' : 'Llegada estimada a Miami', value: compactEta(eta.start, eta.end), hint: eta.partial ? 'Un paquete · ver el resto en el detalle' : etaHint(eta.start, eta.end, now), tone: miamiDay(eta.end || eta.start) < miamiDay(now) ? 'amber' : 'blue', eta: eta.start, etaEnd: eta.end };
  const delivered = (order.delivery?.rows || []).some(row => validInbound(row) && (row.confirmedMiami || row.status === 'delivered'));
  return { label: 'Llegada estimada a Miami', value: delivered ? 'Recepción por confirmar' : 'Por confirmar', hint: 'Consultá el detalle de cada paquete', tone: 'muted' };
}

export function miniProgress(order: CustomerOrderView) {
  const stage = stageOf(order);
  if (isDirectOrder(order)) return [
    { label: 'Compra confirmada', done: purchaseComplete(order), current: stage === 1 },
    { label: 'Envío directo a Argentina', done: stage >= 5, current: stage >= 1 && stage < 5 },
    { label: 'En Argentina', done: stage >= 5, current: stage === 5 || stage === 6 },
    { label: 'Entregado', done: stage === 7, current: stage === 7 },
  ];
  const transit = !order.partialShipments?.length && (order.delivery?.rows || []).some((row: DeliveryRow) => validInbound(row) && ['in_transit', 'shipped', 'out_for_delivery', 'delivered'].includes(row.status));
  return [
    { label: 'Compra confirmada', done: purchaseComplete(order), current: stage === 1 },
    { label: 'En tránsito en USA', done: stage >= 3, current: stage === 2 && transit },
    { label: 'En depósito Miami', done: stage > 3, current: stage === 3 },
    { label: 'En Argentina', done: stage >= 5, current: stage === 5 || stage === 6 },
  ];
}

