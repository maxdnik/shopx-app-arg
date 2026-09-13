import type { DomesticPricingDestination } from "./api";
import type { CartItem } from "./cart-store";
import { request } from "./request";
import type { PriceRow } from "./price-summary";

export type CartPreview = {
  ok: boolean;
  items: Record<string, any>[];
  totalUSD: number;
  totalARS: number;
  exchangeRateUsed: number;
  pricingBreakdown: PriceRow[];
  checkoutEnabled: boolean;
  reason?: string;
  quotedAt: string;
};
export function checkoutItems(items: CartItem[]) {
  return items.map(({ product, quantity }) => ({
    productId: product._id || product.id || product.externalId || product.slug,
    slug: product.slug,
    sourceUrl: product.sourceUrl,
    quantity,
    variantId:
      product.selectedVariant?.sourceVariantId ||
      product.selectedVariantId ||
      product.selectedVariant?.id,
    sku: product.selectedVariant?.sku,
    selectedOptions: product.selectedOptions || {},
    selections: product.selectedOptions || {},
  }));
}
export function previewCart(
  items: CartItem[],
  destination?: DomesticPricingDestination,
) {
  return request<CartPreview>("/api/app/cart/preview", {
    method: "POST",
    body: { items: checkoutItems(items), destination },
    timeoutMs: 210000,
  });
}
