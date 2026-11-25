import type { DomesticPricingDestination } from "./api";
import type { CartItem } from "./cart-store";
import { request } from "./request";
import type { PriceRow } from "./price-summary";
import type { AppOrder, AppOrderBuyer } from "./orders";
import type { PurchaseTermsInput } from "./purchase-terms";

export type CartPreview = {
  ok: boolean;
  items: Record<string, any>[];
  totalUSD: number;
  totalARS: number;
  exchangeRateUsed: number;
  officialExchangeRateUsed?: number;
  fiscalExchangeRateUsed?: number;
  exchangeRates?: { cardRate?: number; officialRate?: number; fiscalRate?: number };
  pricingBreakdown: PriceRow[];
  checkoutEnabled: boolean;
  reason?: string;
  quotedAt: string;
};

export type CartBenefit = {
  ok: boolean;
  benefit: { code: string; type: "FULL" | "SHIPPING" | "PERCENTAGE" | "FIXED_USD"; label?: string };
  calculation: { originalTotalUSD: number; discountUSD: number; finalTotalUSD: number };
  price: CartPreview;
  originalPrice: CartPreview;
};

export type BenefitCheckout = {
  ok: boolean;
  orderNumber: string;
  mongoId: string;
  order: AppOrder;
  requiresPayment: boolean;
  bonified: boolean;
  totalUSD: number;
  totalARS: number;
};

export function hasPricingDestination(destination?: DomesticPricingDestination) {
  return Boolean(destination?.province?.trim() && destination?.city?.trim() && destination?.postalCode?.trim());
}

/** A quote only belongs to the exact customer, cart, selections and destination reviewed. */
export function checkoutFingerprint(items: CartItem[], destination: DomesticPricingDestination | undefined, email: string, code = "", buyer?: AppOrderBuyer) {
  return JSON.stringify({
    email: email.trim().toLowerCase(),
    code: code.trim().toUpperCase(),
    buyer: buyer ? Object.fromEntries(Object.entries(buyer).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, String(value || "").trim()])) : undefined,
    destination: [destination?.province, destination?.city, destination?.postalCode].map(value => String(value || "").trim()),
    items: checkoutItems(items).map(item => ({ ...item,
      selectedOptions: undefined,
      selections: Object.fromEntries(Object.entries(item.selections).sort(([a], [b]) => a.localeCompare(b))),
    })),
  });
}

export function isCartPrice(value: unknown, allowZero = false): value is CartPreview {
  if (!value || typeof value !== "object") return false;
  const price = value as CartPreview;
  return Number.isFinite(price.totalUSD) && (allowZero ? price.totalUSD >= 0 : price.totalUSD > 0)
    && Number.isFinite(price.totalARS) && (allowZero ? price.totalARS >= 0 : price.totalARS > 0)
    && (price.totalARS !== 0 || price.totalUSD === 0)
    && Number.isFinite(price.exchangeRateUsed) && price.exchangeRateUsed > 0
    && Array.isArray(price.pricingBreakdown) && price.pricingBreakdown.length > 0
    && price.pricingBreakdown.every(row => row && typeof row.label === "string" && Number.isFinite(row.amount))
    && Array.isArray(price.items) && price.items.length > 0
    && price.checkoutEnabled === true;
}
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
export async function previewCart(
  items: CartItem[],
  destination?: DomesticPricingDestination,
  signal?: AbortSignal,
) {
  const price = await request<CartPreview>("/api/app/cart/preview", {
    method: "POST",
    body: { items: checkoutItems(items), destination },
    timeoutMs: 210000,
    signal,
  });
  const reason = price?.reason;
  if (!isCartPrice(price)) throw new Error(reason || "No pudimos confirmar el total del carrito.");
  return price;
}

export async function previewCartBenefit(items: CartItem[], destination: DomesticPricingDestination, code: string, signal?: AbortSignal) {
  const response = await request<CartBenefit>("/api/app/cart/benefit", {
    method: "POST", authenticated: true, timeoutMs: 210000, signal,
    body: { code: code.trim().toUpperCase(), items: checkoutItems(items), destination },
  });
  if (!response.benefit?.code || !isCartPrice(response.price, true) || !isCartPrice(response.originalPrice)) {
    throw new Error("No pudimos confirmar el cupón para este carrito.");
  }
  return response;
}

export type BenefitCheckoutInput = {
  items: CartItem[];
  destination: DomesticPricingDestination;
  buyer: AppOrderBuyer;
  code: string;
  expectedTotalARS: number;
  idempotencyKey: string;
  termsAcceptance: PurchaseTermsInput;
};

export type BenefitCheckoutPayload = Omit<BenefitCheckoutInput, "items"> & { items: ReturnType<typeof checkoutItems> };

export function benefitCheckoutPayload(params: BenefitCheckoutInput): BenefitCheckoutPayload {
  return { ...params, items: checkoutItems(params.items), code: params.code.trim().toUpperCase() };
}

function verifiedBenefitCheckout(value: BenefitCheckout): BenefitCheckout {
  if (!value?.orderNumber || !value.mongoId || typeof value.requiresPayment !== "boolean" || typeof value.bonified !== "boolean"
    || !Number.isFinite(value.totalUSD) || value.totalUSD < 0 || !Number.isFinite(value.totalARS) || value.totalARS < 0
    || (value.bonified && (value.totalARS !== 0 || value.totalUSD !== 0 || value.requiresPayment))) {
    throw new Error("No pudimos confirmar el canje. Revisá tus pedidos antes de reintentar.");
  }
  return value;
}

export async function submitBenefitCheckout(payload: BenefitCheckoutPayload) {
  const result = await request<BenefitCheckout>("/api/app/checkout/benefit", {
    method: "POST", authenticated: true, timeoutMs: 210000,
    body: payload,
  });
  return verifiedBenefitCheckout(result);
}

export function redeemCartBenefit(params: BenefitCheckoutInput) {
  return submitBenefitCheckout(benefitCheckoutPayload(params));
}

export async function completedBenefitCheckout(idempotencyKey: string): Promise<BenefitCheckout | null> {
  const result = await request<{ ok: boolean; completed: boolean; checkout?: BenefitCheckout }>(
    "/api/app/checkout/benefit?idempotencyKey=" + encodeURIComponent(idempotencyKey), { authenticated: true },
  );
  if (result.completed === false) return null;
  return verifiedBenefitCheckout(result.checkout as BenefitCheckout);
}
