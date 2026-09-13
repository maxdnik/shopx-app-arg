import type { ShopXProduct, DomesticPricingDestination } from "./api";
import { request } from "./request";
import type { PriceRow } from "./price-summary";
import { normalizeQuoteUrl, validateQuoteUrl } from "./quote";

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
export const automaticStores = [
  "amazon.com",
  "a.co",
  "ebay.com",
  "sephora.com",
  "walmart.com",
  "target.com",
  "bestbuy.com",
  "newegg.com",
  "abercrombie.com",
  "hollisterco.com",
];
export function supportsAutomaticQuote(value: string) {
  try {
    const host = new URL(normalizeQuoteUrl(value)).hostname.toLowerCase();
    return automaticStores.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
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
  return Array.from(new Set(links));
}
export function withQuantity(value: string, quantity: number) {
  const url = new URL(value);
  url.searchParams.set("quantity", String(Math.max(1, Math.min(3, quantity))));
  return url.toString();
}
export function calculateQuoteBasket(
  urls: string[],
  destination?: DomesticPricingDestination,
) {
  return request<QuoteBasket>("/api/amazon-quote-batch", {
    method: "POST",
    body: { urls, destination },
    timeoutMs: 210000,
  });
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
