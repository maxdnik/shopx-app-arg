// Customer tracking rules shared conceptually with usa-shopbox/src/lib/order-status.ts.
// Keep projections read-only; carrier scans never promote the whole order.
/** Shared order-level state. Carrier scans and tracking numbers alone never
 * advance an entire order; they may describe only one package. */
export const ORDER_STATUSES = ['pending_payment', 'paid', 'pending_processing', 'processing', 'in_miami_warehouse', 'in_transit', 'arrived_argentina', 'shipped', 'delivered', 'cancelled'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];
type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === 'object' ? value as RecordValue : {};
const clean = (value: unknown) => String(value || '').trim().toLowerCase();
const rank: Record<string, number> = { pending_payment: 0, paid: 1, pending_processing: 1, processing: 2, in_miami_warehouse: 3, in_transit: 4, arrived_argentina: 5, shipped: 6, delivered: 7 };
export const ORDER_TRACKING_STEPS: Record<string, string> = { pending_payment: 'pending_payment', paid: 'purchased', pending_processing: 'purchased', processing: 'purchased', in_miami_warehouse: 'miami', in_transit: 'traveling', arrived_argentina: 'argentina', shipped: 'local_delivery', delivered: 'delivered', cancelled: 'cancelled' };
const stepStatus: Record<string, string> = { miami: 'in_miami_warehouse', traveling: 'in_transit', argentina: 'arrived_argentina', local_delivery: 'shipped', delivered: 'delivered' };
export const ORDER_STATUS_LABELS: Record<string, string> = { pending_payment: 'Pendiente de pago', paid: 'Pagado', pending_processing: 'Compra en preparación', processing: 'En camino a Miami', in_miami_warehouse: 'Recibido en Miami', in_transit: 'En tránsito a Argentina', arrived_argentina: 'Arribado a Argentina', shipped: 'En entrega local', delivered: 'Entregado', cancelled: 'Cancelado' };

export function normalizeOrderStatus(value: unknown) {
  const status = clean(value);
  return status === 'arrived_in_argentina' ? 'arrived_argentina' : status;
}

/** Recover a payment-induced regression from the current saved order event.
 * Never take the maximum historical stage: an admin can deliberately correct it.
 * Never revive cancelled/refunded orders or infer dispatch from a label. */
export function resolveOrderStatus(input: unknown): string {
  const order = object(input);
  const status = normalizeOrderStatus(order.status);
  if (['cancelled', 'delivered', 'incident'].includes(status) || ['refunded', 'charged_back', 'cancelled', 'rejected'].includes(clean(order.paymentStatus))) return status;
  if (!['pending_payment', 'paid', 'pending_processing', 'processing'].includes(status)) return status;
  if (status === 'pending_payment' && !order.paidAt && !['approved', 'paid', 'bonified'].includes(clean(order.paymentStatus))) return status;
  const tracking = object(order.tracking);
  const currentStep = clean(tracking.currentStep);
  const history = Array.isArray(tracking.history) ? tracking.history.map(object) : [];
  // Array order is the saved event order, including explicit backward corrections.
  const latest = [...history].reverse().find(row => ORDER_STATUSES.includes(normalizeOrderStatus(row.status) as OrderStatus));
  const latestStatus = normalizeOrderStatus(latest?.status);
  const candidate = currentStep
    ? stepStatus[currentStep] || (currentStep === 'purchased' && latestStatus === 'processing' ? 'processing' : '')
    : latestStatus;
  if (!candidate || (rank[candidate] || 0) <= (rank[status] || 0)) return status;
  if (latest && normalizeOrderStatus(latest.status) !== candidate) return status;
  // An aggregate partial event is valid only while all active lots still cover
  // the full order and have reached at least the proposed stage.
  const partials = Array.isArray(order.partialShipments) ? order.partialShipments.map(object).filter(row => row.status !== 'cancelled') : [];
  if (partials.length) {
    const count = Array.isArray(order.items) ? order.items.length : 0;
    const covered = new Set(partials.flatMap(row => Array.isArray(row.itemIndexes) ? row.itemIndexes.filter(i => Number.isInteger(i) && Number(i) >= 0 && Number(i) < count) : []));
    if (!count || covered.size !== count || partials.some(row => (rank[normalizeOrderStatus(row.status)] || 0) < rank[candidate])) return status;
  }
  return candidate;
}

/** Only an unpaid order may acquire its initial status from a payment event.
 * Apply this predicate in the database too, so a concurrent admin update wins. */
export function paymentOrderTransition(paymentStatus: string) {
  if (paymentStatus === 'approved') return { from: 'pending_payment', to: 'paid' } as const;
  if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(paymentStatus)) return { from: 'pending_payment', to: 'cancelled' } as const;
  return null;
}

