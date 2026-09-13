import { request } from "./request";
export type CustomerQuote = {
  id: string;
  quoteNumber: string;
  productTitle: string;
  productImage?: string;
  status: string;
  statusLabel: string;
  pricing?: { totalArs: number };
  expiresAt?: string;
  createdAt?: string;
  orderNumber?: string;
  mergeBlockedReason?: string;
  mergedQuoteNumbers?: string[];
  items?: {
    lineId: string;
    title?: string;
    productTitle?: string;
    image?: string;
    productImage?: string;
    quantity?: number;
    requestedQuantity?: number;
    requestedSize?: string;
    requestedColor?: string;
    totalArs?: number;
  }[];
  timeline?: { label: string; at: string }[];
  discount?: { amountArs?: number; [key: string]: unknown };
};
export const quoteMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
export const getCustomerQuotes = () =>
  request<{ quotes: CustomerQuote[] }>("/api/quotes/me", {
    authenticated: true,
  });
export const getCustomerQuote = (number: string) =>
  request<{
    quote: CustomerQuote;
    profile: {
      complete: boolean;
      missingFields: { key: string; label: string }[];
    };
  }>(`/api/quotes/${encodeURIComponent(number)}`, { authenticated: true });
export const confirmQuoteProfile = (
  number: string,
  body: Record<string, string>,
) =>
  request<{ quote: CustomerQuote }>(
    `/api/quotes/${encodeURIComponent(number)}/complete-profile`,
    { method: "POST", authenticated: true, body },
  );
export const payCustomerQuote = (number: string) =>
  request<{ init_point?: string; totalArs?: number }>(
    `/api/quotes/${encodeURIComponent(number)}/checkout`,
    { method: "POST", authenticated: true, body: {} },
  );
