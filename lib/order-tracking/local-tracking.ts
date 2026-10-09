// Customer tracking rules shared conceptually with usa-shopbox/src/lib/local-tracking/types.ts.
// Keep projections read-only; carrier scans never promote the whole order.
export type LocalTrackingEvent = {
  date: string;
  branch: string;
  event: string;
  status: string;
};

export type LocalTracking = {
  provider: 'correo_argentino';
  trackingNumber: string;
  events: LocalTrackingEvent[];
  checkedAt: string | null;
  syncedAt: string | null;
  deliveredAt: string | null;
  lastError: string;
};

export function isCorreoArgentino(value: unknown) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z]/g, '') === 'correoargentino';
}

// The product prefix is part of the identity. Never guess it from nine digits.
export function correoTrackingNumber(value: unknown): string | null {
  const match = String(value || '').trim().toUpperCase().replace(/[\s.-]/g, '')
    .match(/^([A-Z]{2})(\d{7,9})(?:AR)?$/);
  return match ? `${match[1]}${match[2].padStart(9, '0')}AR` : null;
}

function date(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

/** Explicit customer DTO; stale data for a replaced tracking number is hidden. */
export function customerLocalTracking(value: any, number: unknown, carrier: unknown): LocalTracking | null {
  const trackingNumber = correoTrackingNumber(number);
  const identity = trackingNumber || String(number || '').trim();
  if (!isCorreoArgentino(carrier) || !identity || value?.provider !== 'correo_argentino'
    || value.trackingNumber !== identity) return null;
  return {
    provider: 'correo_argentino', trackingNumber: identity,
    events: (Array.isArray(value.events) ? value.events : []).flatMap((row: any) => {
      const at = date(row?.date);
      if (!at || !String(row?.event || '').trim()) return [];
      return [{ date: at, branch: String(row.branch || '').slice(0, 240),
        event: String(row.event || '').slice(0, 240), status: String(row.status || '').slice(0, 240) }];
    }).slice(0, 200),
    checkedAt: date(value.checkedAt), syncedAt: date(value.syncedAt),
    deliveredAt: date(value.deliveredAt), lastError: String(value.lastError || '').slice(0, 80),
  };
}

