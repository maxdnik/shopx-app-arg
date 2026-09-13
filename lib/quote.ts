// lib/quote.ts
import { buildApiUrl } from "./config";
import { getAuthToken, getStoredUser } from "./auth";

export type QuoteRequestPayload = {
  productUrl: string;
  productName?: string;
  store?: string;
  quantity?: number;
  comments?: string;
  contact?: string;
  urgency?: "normal" | "urgent" | "not_sure";
};

export type QuoteRequestResponse = {
  ok: boolean;
  quote?: {
    id?: string;
    quoteNumber?: string;
    status?: string;
    productUrl?: string;
    contact?: string;
    createdAt?: string;
  };
  message?: string;
  error?: string;
};

function cleanString(value: any) {
  return String(value || "").trim();
}

function isLikelyUrl(value: string) {
  const clean = cleanString(value);
  if (!clean) return false;

  try {
    const withProtocol = /^https?:\/\//i.test(clean)
      ? clean
      : `https://${clean}`;
    const url = new URL(withProtocol);
    return Boolean(
      ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        url.hostname.includes("."),
    );
  } catch {
    return false;
  }
}

export function normalizeQuoteUrl(value: string) {
  const clean = cleanString(value);
  if (!clean) return "";
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

export function validateQuoteUrl(value: string) {
  if (!cleanString(value)) {
    return "Pegá el link del producto que querés traer de USA.";
  }

  if (!isLikelyUrl(value)) {
    return "El link no parece válido. Copiá la URL completa del producto.";
  }

  return "";
}

export async function submitQuoteRequest(
  payload: QuoteRequestPayload,
): Promise<QuoteRequestResponse> {
  const token = await getAuthToken();
  const storedUser = await getStoredUser();

  const productUrl = normalizeQuoteUrl(payload.productUrl);
  const urlError = validateQuoteUrl(productUrl);

  if (urlError) {
    throw new Error(urlError);
  }

  const contact = cleanString(
    payload.contact || storedUser?.email || storedUser?.phone || "",
  );

  if (!contact) {
    throw new Error(
      "Dejanos un email o teléfono para responderte la cotización.",
    );
  }

  const response = await fetch(buildApiUrl("/api/app/quote"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      productUrl,
      productName: cleanString(payload.productName),
      store: cleanString(payload.store),
      quantity: Math.max(1, Number(payload.quantity || 1)),
      comments: cleanString(payload.comments),
      contact,
      urgency: payload.urgency || "normal",
      source: "app",
    }),
  });

  const text = await response.text();
  let data: QuoteRequestResponse;

  try {
    data = JSON.parse(text || "{}");
  } catch {
    throw new Error(text || "No pudimos enviar la cotización.");
  }

  if (!response.ok || data.ok === false) {
    throw new Error(
      data.message || data.error || "No pudimos enviar la cotización.",
    );
  }

  return data;
}
