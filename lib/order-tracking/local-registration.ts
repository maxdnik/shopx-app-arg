// Customer tracking rules shared conceptually with usa-shopbox/src/features/orders/customer/local-registration.ts.
// Keep projections read-only; carrier scans never promote the whole order.
import { isoDate } from './view-model';

/** Format only a recorded local event. The server's stored dispatch/history
 * timestamp is a registration time, not a live carrier scan. Never substitute
 * an order update, payment, USA event or estimate for a missing local date. */
export function localRegistrationDate(value: unknown) {
  const iso = isoDate(value);
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || '';
  return `${part('day')}/${part('month')}/${part('year')} · ${part('hour')}:${part('minute')} hs (Argentina)`;
}

