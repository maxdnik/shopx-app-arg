export type AgpPublicShipment = {
  number: string;
  checkedAt?: string;
  events: { date: string; status: string; needsAttention: boolean }[];
};

/** Keep the same public whitelist as the web; never render provider internals. */
export function customerAgpTracking(value: unknown): AgpPublicShipment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap(shipment => {
    if (!shipment || typeof shipment.number !== "string" || !/^[A-Za-z0-9-]{1,80}$/.test(shipment.number)) return [];
    return [{
      number: shipment.number,
      ...(typeof shipment.checkedAt === "string" ? { checkedAt: shipment.checkedAt.slice(0, 30) } : {}),
      events: Array.isArray(shipment.events) ? shipment.events.slice(-100).flatMap((event: unknown) => {
        if (!event || typeof event !== "object" || !("date" in event) || !("status" in event)
          || typeof event.date !== "string" || typeof event.status !== "string") return [];
        return [{ date: event.date.slice(0, 60), status: event.status.slice(0, 150), needsAttention: "needsAttention" in event && event.needsAttention === true }];
      }) : [],
    }];
  });
}
