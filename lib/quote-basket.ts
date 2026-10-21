import type { ShopXProduct, DomesticPricingDestination } from "./api";
import { ApiError, request } from "./request";
import type { PriceRow } from "./price-summary";
import { normalizeQuoteUrl, validateQuoteUrl } from "./quote";
import { detectBrightDataRetailer, isSupportedBrightDataRetailerUrl, normalizeRetailerUrl, retailerProductKey } from "./quote-retailers";

export type BasketProduct = {
  id: string;
  productId: string;
  title: string;
  priceUSD: number;
  imageUrl: string;
  store: string;
  sourceUrl: string;
  quantity?: number;
  selectedColor?: string;
  selectedSize?: string;
};
export type QuoteBasket = {
  ok: boolean;
  products: BasketProduct[];
  cartItems: (Partial<ShopXProduct> & {
    productId?: string;
    quantity?: number;
    selections?: Record<string, string>;
  })[];
  pricing: {
    totalFinal: number;
    breakdown: PriceRow[];
    checkoutEnabled?: boolean;
    reason?: string;
  };
  errors?: { url: string; error: string; reason: string }[];
  warnings?: string[];
  expiresAt?: string;
  error?: string;
};
export const AUTOMATIC_QUOTE_TIMEOUT_MS = 25_000;
export const supportsAutomaticQuote = isSupportedBrightDataRetailerUrl;

export function canonicalQuoteUrl(value: string) {
  const normalized = normalizeQuoteUrl(value);
  if (!supportsAutomaticQuote(normalized)) return normalized;
  const input = new URL(normalized);
  const quantity = Number(input.searchParams.get("quantity") || input.searchParams.get("qty") || 0);
  const canonical = new URL(normalizeRetailerUrl(normalized));
  if (Number.isFinite(quantity) && quantity > 0)
    canonical.searchParams.set("quantity", String(Math.min(3, Math.max(1, Math.trunc(quantity)))));
  return canonical.toString();
}

export function validateBasketLinks(urls: string[]) {
  if (urls.length > 5) throw new Error("Podés cotizar hasta cinco links por operación.");
  for (const url of urls) {
    const error = validateQuoteUrl(url);
    if (error) throw new Error(error);
  }
  const retailers = new Set(urls.map(url => detectBrightDataRetailer(url)?.key).filter(Boolean));
  if (retailers.size > 2) throw new Error("Combiná como máximo dos tiendas distintas por cotización.");
  if (new Set(urls.map(retailerProductKey)).size !== urls.length)
    throw new Error("Ese producto ya está incluido en la cotización.");
}

export function quoteLinks(text: string): string[] {
  const links = text.trim().split(/\s+/).filter(Boolean).map(normalizeQuoteUrl);
  if (!links.length)
    throw new Error("Pegá el link del producto que querés cotizar.");
  if (links.length > 5)
    throw new Error("Podés cotizar hasta cinco links por operación.");
  for (const link of links) {
    const error = validateQuoteUrl(link);
    if (error) throw new Error(error);
  }
  const canonical = links.map(canonicalQuoteUrl);
  validateBasketLinks(canonical);
  return canonical;
}
export function withQuantity(value: string, quantity: number) {
  const url = new URL(canonicalQuoteUrl(value));
  url.searchParams.delete("qty");
  url.searchParams.set("quantity", String(Math.max(1, Math.min(3, Math.trunc(Number(quantity) || 1)))));
  return url.toString();
}
export async function calculateQuoteBasket(
  urls: string[],
  destination?: DomesticPricingDestination,
  signal?: AbortSignal,
) {
  const canonical = urls.map(canonicalQuoteUrl);
  validateBasketLinks(canonical);
  try {
    const value = await request<QuoteBasket>("/api/amazon-quote-batch", {
    method: "POST",
    body: { urls: canonical, destination },
    timeoutMs: AUTOMATIC_QUOTE_TIMEOUT_MS,
    signal,
    });
    if (!value.products?.length || !value.pricing || !Array.isArray(value.cartItems))
      throw new ApiError(value.error || value.errors?.[0]?.error || "No pudimos leer el producto automáticamente.", 422, value);
    return value;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 408) throw new ApiError("La tienda tardó más de lo habitual en responder. Volvé a intentar; conservamos tus links.", 408);
      const message = error.data?.error || error.data?.errors?.[0]?.error;
      if (message) throw new ApiError(message, error.status, error.data);
    }
    throw error;
  }
}

/** Same fallback rules as the website: Amazon provider failures remain automatic. */
export function shouldRouteToManualQuote(urls: string[], message: string) {
  if (/dimensiones del embalaje|peso volumétrico.*revisión manual/i.test(message)) return true;
  return !urls.some(url => detectBrightDataRetailer(url)?.key === "amazon") &&
    /no devolvió una ficha válida|no pudimos leer el producto|normalization|ficha válida/i.test(message);
}

export function quotedProductUrls(basket: QuoteBasket) {
  return basket.products.map(product => withQuantity(product.sourceUrl, product.quantity || 1));
}

export function changeQuotedQuantity(urls: string[], product: BasketProduct, quantity: number) {
  return urls.map(url => retailerProductKey(url) === retailerProductKey(product.sourceUrl) ? withQuantity(url, quantity) : url);
}

export function removeQuotedProduct(urls: string[], product: Pick<BasketProduct, "sourceUrl">) {
  return urls.filter(url => retailerProductKey(url) !== retailerProductKey(product.sourceUrl));
}

export function canCheckoutBasket(basket: QuoteBasket, now = Date.now()) {
  return !!basket.products?.length && !!basket.cartItems?.length && !basket.errors?.length &&
    basket.pricing?.checkoutEnabled !== false && Number.isFinite(basket.pricing?.totalFinal) && basket.pricing.totalFinal > 0 &&
    (!basket.expiresAt || new Date(basket.expiresAt).getTime() > now);
}
export function basketCartProducts(
  basket: QuoteBasket,
): { product: ShopXProduct; quantity: number }[] {
  return basket.cartItems.map((item, index) => {
    const display = basket.products[index];
    return {
      product: {
        ...item,
        id: item.id || item.productId || display?.id,
        slug: item.slug || "",
        title: item.title || display?.title || "Producto USA",
        priceUSD: item.priceUSD ?? display?.priceUSD,
        imageUrl: item.imageUrl || item.image || display?.imageUrl,
        sourceUrl: item.sourceUrl || display?.sourceUrl,
        selectedOptions: item.selectedOptions ||
          item.selections || {
            ...((item as any).selectedColor || display?.selectedColor
              ? { Color: (item as any).selectedColor || display?.selectedColor }
              : {}),
            ...((item as any).selectedSize || display?.selectedSize
              ? { Talle: (item as any).selectedSize || display?.selectedSize }
              : {}),
          },
        finalPriceUSD: undefined,
        estimatedUSD: undefined,
        pricing: undefined,
      },
      quantity: Number(item.quantity || display?.quantity || 1),
    };
  });
}
