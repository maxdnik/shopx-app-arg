// Customer tracking rules shared conceptually with usa-shopbox/src/features/orders/customer/detail-shipping.ts.
// Keep projections read-only; carrier scans never promote the whole order.
import { customerLocalTracking, type LocalTracking } from './local-tracking';
import { isoDate, stageDate, stageOf, statusLabel, type CustomerOrderView } from './view-model';

export type ShipmentState = {
  label: string;
  at: string | null;
  icon: 'store' | 'truck' | 'warehouse' | 'plane' | 'package' | 'check' | 'clock' | 'alert';
  tone: '' | 'blue' | 'green';
  miamiTime: boolean;
};

/** The highlighted card follows the current order stage, never a historical
 * Miami milestone or an estimated future date. Partial lots cannot promote it. */
export function currentShipmentState(order: CustomerOrderView): ShipmentState {
  const empty: ShipmentState = { label: '', at: null, icon: 'clock', tone: '', miamiTime: false };
  if (order.status === 'cancelled') return { ...empty, label: 'Cancelado' };
  if (order.paymentStatus === 'refunded') return { ...empty, label: 'Reembolsado' };
  if (order.paymentStatus === 'charged_back') return { ...empty, label: 'Pago revertido' };
  if (order.status === 'pending_payment') return { ...empty, label: 'Pendiente de pago' };
  if (order.status === 'incident') return { ...empty, label: 'En revisión', icon: 'alert' };
  const stage = stageOf(order);
  const rows = order.delivery?.rows || [];
  if (stage < 3 && rows.some(row => row.review || row.refunded || /exception|failure|returned|incident/.test(row.status))) {
    return { ...empty, label: 'Seguimiento en revisión', icon: 'alert' };
  }
  if (stage < 3 && rows.length > 0 && rows.every(row => row.direct && !row.review && !row.refunded)) {
    return { ...empty, label: 'Envío directo a Argentina', icon: 'truck', tone: 'blue' };
  }
  const phases: Record<number, Pick<ShipmentState, 'label' | 'icon'>> = {
    0: { label: statusLabel(order), icon: 'clock' },
    1: { label: 'Compra confirmada', icon: 'store' },
    2: { label: 'En tránsito en USA', icon: 'truck' },
    3: { label: 'En depósito Miami', icon: 'warehouse' },
    4: { label: 'Volando a Argentina', icon: 'plane' },
    5: { label: 'Arribado a Argentina', icon: 'package' },
    6: { label: 'En entrega local', icon: 'truck' },
    7: { label: 'Entregado', icon: 'check' },
  };
  const phase = phases[stage];
  if (!phase) return { ...empty, label: 'Estado por confirmar' };
  return {
    ...empty, ...phase,
    // Do not present a per-package scan as the timestamp of the whole order.
    at: stage === 1 || stage >= 3 ? stageDate(order, stage) : null,
    tone: stage === 3 || stage === 7 ? 'green' : 'blue',
    miamiTime: stage === 3,
  };
}

export type LocalDeliveryRow = {
  key: string;
  title: string;
  products: string[];
  carrier: string;
  number: string;
  status: string;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  localTracking: LocalTracking | null;
};

function clean(value?: string) { return String(value || '').trim(); }

function localHistoryDate(history: { status?: string; date?: string }[] | undefined, status: string) {
  const dates = (history || []).filter(row => row.status === status)
    .map(row => isoDate(row.date)).filter((value): value is string => Boolean(value)).sort();
  return dates.at(-1) || null;
}

/** Keep order-level and partial-shipment courier data in their own scopes.
 * A tracking reference is not evidence of dispatch, and delivered in USA is
 * never proof of local delivery in Argentina. This is a read-only projection. */
export function localDeliveryRows(order: CustomerOrderView): LocalDeliveryRow[] {
  const rows: LocalDeliveryRow[] = (order.partialShipments || []).flatMap(shipment => {
    if (shipment.status === 'cancelled') return [];
    const carrier = clean(shipment.localCourierName);
    const number = clean(shipment.localTrackingNumber);
    if (!carrier && !number) return [];
    const delivered = shipment.status === 'delivered';
    const dispatched = shipment.status === 'shipped' || delivered;
    return [{
      key: `partial:${shipment.id}`,
      title: `Envío ${shipment.sequence}${shipment.code ? ` · ${shipment.code}` : ''}`,
      products: shipment.itemIndexes.flatMap(index => {
        const item = Number.isInteger(index) && index >= 0 ? order.items[index] : undefined;
        return item ? [`${item.qty} × ${item.title}`] : [];
      }),
      carrier, number, status: shipment.status,
      localTracking: customerLocalTracking(shipment.localTracking, number, carrier),
      dispatchedAt: dispatched ? localHistoryDate(shipment.history, 'shipped') : null,
      deliveredAt: delivered ? localHistoryDate(shipment.history, 'delivered') : null,
    }];
  });
  const carrier = clean(order.localCourierName);
  const number = clean(order.localTrackingNumber);
  // A general reference repeated on a known partial shipment is not another lot.
  const duplicate = Boolean(number) && rows.some(row => row.number.toUpperCase() === number.toUpperCase());
  if ((carrier || number) && !duplicate && (!rows.length || number)) {
    rows.unshift({
      key: 'order',
      title: order.partialShipments?.length ? 'Seguimiento general de la orden' : 'Correo local',
      products: [], carrier, number, status: order.status,
      localTracking: customerLocalTracking(order.localTracking, number, carrier),
      dispatchedAt: ['shipped', 'delivered'].includes(order.status) ? stageDate(order, 6) : null,
      deliveredAt: order.status === 'delivered' ? stageDate(order, 7) : null,
    });
  }
  return rows;
}

export function localDeliveryLabel(status: string) {
  if (status === 'delivered') return 'Entregado';
  if (status === 'shipped') return 'En entrega local';
  if (status === 'cancelled') return 'Cancelado';
  if (/incident|exception|failure|returned/.test(status)) return 'En revisión';
  return 'Pendiente de despacho';
}


