// lib/quote.ts
import { Linking } from "react-native";
import { buildApiUrl } from "./config";
import { getAuthToken } from "./auth";

export type QuoteProductPayload = {
  sourceUrl: string;
  productName?: string;
  requestedSize?: string;
  requestedColor?: string;
  customerNotes?: string;
  quantity?: number;
};

export type QuoteRequestPayload = {
  productUrl?: string;
  productName?: string;
  store?: string;
  quantity?: number;
  comments?: string;
  contact?: string;
  urgency?: "normal" | "urgent" | "not_sure";
  requestedSize?: string;
  requestedColor?: string;
  products?: QuoteProductPayload[];
};

export type QuotePricingLine = {
  label: string;
  usd?: number;
  ars?: number;
  value?: number;
};

export type CustomerQuote = {
  id: string;
  quoteNumber: string;
  status: string;
  statusLabel?: string;
  sourceUrl: string;
  requestedSize?: string;
  requestedColor?: string;
  requestedQuantity?: number;
  customerNotes?: string;
  productTitle?: string;
  productImage?: string;
  brand?: string;
  store?: string;
  pricing?: {
    breakdown?: QuotePricingLine[];
    totalUsd?: number;
    exchangeRate?: number;
    totalArs?: number;
  } | null;
  sentAt?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  orderNumber?: string;
  timeline?: { status: string; label?: string; at?: string }[];
  createdAt?: string;
  updatedAt?: string;
};

export type QuoteRequestResponse = {
  ok: boolean;
  message?: string;
  quotes?: CustomerQuote[];
  quote?: CustomerQuote;
  error?: string;
  reason?: string;
};

export type QuoteProfileResponse = {
  ok: boolean;
  message?: string;
  quote?: CustomerQuote;
  profile?: { complete: boolean; missingFields: any[] };
  missingFields?: any[];
  error?: string;
  reason?: string;
};

export type QuoteCheckoutResponse = {
  ok: boolean;
  quoteNumber?: string;
  totalArs?: number;
  totalUsd?: number;
  exchangeRate?: number;
  preferenceId?: string;
  init_point?: string;
  sandbox_init_point?: string;
  external_reference?: string;
  error?: string;
  reason?: string;
  status?: string;
};

function cleanString(value: any) {
  return String(value || "").trim();
}

function normalizeQuantity(value: any) {
  const parsed = Number(value || 1);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(Math.floor(parsed), 3);
}

function isLikelyUrl(value: string) {
  const clean = cleanString(value);
  if (!clean) return false;

  try {
    const withProtocol = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    const url = new URL(withProtocol);
    return Boolean(url.hostname && url.hostname.includes("."));
  } catch {
    return false;
  }
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Necesitás iniciar sesión para pedir y ver cotizaciones.");
  }

  return fetch(buildApiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: any = {};

  try {
    data = JSON.parse(text || "{}");
  } catch {
    throw new Error(text || "Respuesta inválida del servidor.");
  }

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || "No pudimos completar la operación.");
  }

  return data as T;
}

export function normalizeQuoteUrl(value: string) {
  const clean = cleanString(value);
  if (!clean) return "";
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

export function validateQuoteUrl(value: string) {
  if (!cleanString(value)) return "Pegá el link del producto que querés traer de USA.";
  if (!isLikelyUrl(value)) return "El link no parece válido. Copiá la URL completa del producto.";
  return "";
}

export async function submitQuoteRequest(payload: QuoteRequestPayload): Promise<QuoteRequestResponse> {
  const products = Array.isArray(payload.products) && payload.products.length > 0
    ? payload.products
    : [{
        sourceUrl: payload.productUrl || "",
        productName: payload.productName || "",
        requestedSize: payload.requestedSize || "",
        requestedColor: payload.requestedColor || "",
        customerNotes: payload.comments || "",
        quantity: payload.quantity || 1,
      }];

  const normalizedProducts = products
    .slice(0, 3)
    .map((product) => {
      const sourceUrl = normalizeQuoteUrl(product.sourceUrl);
      const urlError = validateQuoteUrl(sourceUrl);
      if (urlError) throw new Error(urlError);

      return {
        sourceUrl,
        productName: cleanString(product.productName).slice(0, 300),
        requestedSize: cleanString(product.requestedSize).slice(0, 120),
        requestedColor: cleanString(product.requestedColor).slice(0, 120),
        customerNotes: cleanString(product.customerNotes).slice(0, 3000),
        quantity: normalizeQuantity(product.quantity),
      };
    });

  const response = await authedFetch("/api/quotes", {
    method: "POST",
    body: JSON.stringify({
      source: "app_quotes",
      products: normalizedProducts,
    }),
  });

  return parseJson<QuoteRequestResponse>(response);
}

export async function fetchMyQuotes(): Promise<CustomerQuote[]> {
  const response = await authedFetch("/api/quotes/me", { method: "GET" });
  const data = await parseJson<{ ok: boolean; quotes: CustomerQuote[] }>(response);
  return data.quotes || [];
}

export async function fetchQuoteDetail(quoteNumber: string): Promise<QuoteProfileResponse> {
  const response = await authedFetch(`/api/quotes/${encodeURIComponent(quoteNumber)}`, { method: "GET" });
  return parseJson<QuoteProfileResponse>(response);
}

export async function completeQuoteProfile(quoteNumber: string): Promise<QuoteProfileResponse> {
  const response = await authedFetch(`/api/quotes/${encodeURIComponent(quoteNumber)}/complete-profile`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return parseJson<QuoteProfileResponse>(response);
}

export async function createQuoteCheckout(quoteNumber: string): Promise<QuoteCheckoutResponse> {
  const response = await authedFetch(`/api/quotes/${encodeURIComponent(quoteNumber)}/checkout`, {
    method: "POST",
    body: JSON.stringify({ source: "app" }),
  });
  return parseJson<QuoteCheckoutResponse>(response);
}

export async function openQuoteCheckout(quoteNumber: string) {
  const checkout = await createQuoteCheckout(quoteNumber);
  const url = checkout.init_point || checkout.sandbox_init_point;

  if (!url) throw new Error("No recibimos el link de pago de Mercado Pago.");

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) throw new Error("No pudimos abrir Mercado Pago en este dispositivo.");

  await Linking.openURL(url);
  return checkout;
}
