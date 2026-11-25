import type { MercadoPagoCheckoutResponse } from "./orders";

export function mercadoPagoUrl(response: MercadoPagoCheckoutResponse) {
  const value = response.init_point || response.sandbox_init_point;
  if (!value) throw new Error("Mercado Pago no devolvió un enlace de pago.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("El enlace de Mercado Pago no es válido."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || !["mercadopago.com.ar", "mercadopago.com"].some(domain => host === domain || host.endsWith(`.${domain}`))) {
    throw new Error("No pudimos verificar el enlace de Mercado Pago.");
  }
  return url.toString();
}

export function samePaymentAmount(expected: number, actual: unknown) {
  return Number.isFinite(expected) && expected > 0 && typeof actual === "number"
    && Number.isFinite(actual) && actual > 0 && Math.round(actual) === Math.round(expected);
}
