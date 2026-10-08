import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeQuoteUrl, validateQuoteUrl } from "./quote";
import { isValidQuotePostalCode, normalizeQuotePostalCode, QUOTE_POSTAL_CODE_ERROR } from "./quote-postal-code";
import { request } from "./request";

export type ManualQuoteProduct = {
  id: string;
  productUrl: string;
  productName: string;
  size: string;
  color: string;
  specs: string;
  quantity: string;
};
export type ManualQuoteDraft = { products: ManualQuoteProduct[]; postalCode: string };
export const MANUAL_FALLBACK_MESSAGE = "No pudimos leer todos los datos de la tienda automáticamente. Completá estos datos y te devolvemos la cotización final.";
const DRAFT_KEY = "shopx_manual_quote_draft_v1";

export function createManualProduct(productUrl = ""): ManualQuoteProduct {
  let quantity = "1";
  try {
    const url = new URL(normalizeQuoteUrl(productUrl));
    quantity = String(Math.min(3, Math.max(1, Math.trunc(Number(url.searchParams.get("quantity") || url.searchParams.get("qty")) || 1))));
  } catch { /* An empty product can be completed in the form. */ }
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, productUrl, productName: "", size: "", color: "", specs: "", quantity };
}

export function manualQuotePayload(products: ManualQuoteProduct[], postalCode: string) {
  if (!isValidQuotePostalCode(postalCode)) throw new Error(QUOTE_POSTAL_CODE_ERROR);
  if (!products.length || products.length > 10) throw new Error("Podés pedir entre uno y diez productos por solicitud.");
  const lines = products.map(product => {
    const error = validateQuoteUrl(product.productUrl);
    if (error) throw new Error(error);
    const quantity = Number(product.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 3)
      throw new Error("Podés pedir de 1 a 3 unidades por cada URL.");
    return {
      sourceUrl: normalizeQuoteUrl(product.productUrl),
      productName: product.productName.trim(),
      quantity,
      requestedSize: product.size.trim(),
      requestedColor: product.color.trim(),
      customerNotes: product.specs.trim(),
    };
  });
  return { source: "app_quotes", postalCode: normalizeQuotePostalCode(postalCode), products: lines };
}

/** Called only by the explicit send button, never by login/focus/draft restoration. */
export async function sendManualQuote(products: ManualQuoteProduct[], postalCode: string, trigger: "explicit_submit") {
  if (trigger !== "explicit_submit") throw new Error("Confirmá el envío de la solicitud.");
  const body = manualQuotePayload(products, postalCode);
  const response = await request<{ ok: boolean; quotes: { id: string; quoteNumber: string }[] }>("/api/quotes", {
    method: "POST", authenticated: true, body,
  });
  if (!response.ok || !response.quotes?.length)
    throw new Error("No recibimos la confirmación de tu solicitud. Revisá Mis cotizaciones antes de reenviar.");
  return response.quotes;
}

export function saveManualQuoteDraft(draft: ManualQuoteDraft) {
  return AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}
export function clearManualQuoteDraft() { return AsyncStorage.removeItem(DRAFT_KEY); }
export async function readManualQuoteDraft(): Promise<ManualQuoteDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!Array.isArray(draft.products) || !draft.products.length || draft.products.length > 10) return null;
    const products = draft.products.map((product: Record<string, unknown>) => {
      if (!product || typeof product !== "object") throw new Error("Invalid draft");
      const clean = createManualProduct();
      for (const key of Object.keys(clean) as (keyof ManualQuoteProduct)[]) {
        if (typeof product[key] === "string") clean[key] = product[key];
      }
      return clean;
    });
    return { products, postalCode: normalizeQuotePostalCode(draft.postalCode) };
  } catch { return null; }
}
