// lib/api.ts
import { API_BASE_URL, buildApiUrl } from "./config";

export type PricingBreakdownRow = {
  label: string;
  amount: number;
};

export type ProductCategory =
  | {
      main?: string;
      sub?: string;
      leaf?: string;
    }
  | string;

export type ProductPricing = {
  finalUSD?: number;
  totalFinal?: number;
  totalWeightKg?: number;
  billableWeightKg?: number;
  isWeightImputed?: boolean;
  breakdown?: PricingBreakdownRow[];
};

export type ShopXProduct = {
  _id?: string;
  id?: string;
  title: string;
  slug: string;
  store?: string;
  brand?: string;
  priceUSD?: number;
  estimatedUSD?: number;
  finalPriceUSD?: number;
  description?: string;
  category?: ProductCategory;
  images?: string[];
  imageUrls?: string[];
  image?: string;
  imageUrl?: string;
  source?: string;
  sourceUrl?: string;
  externalId?: string;
  weightKg?: number;
  weight?: number;
  dimensionsCm?: {
    length?: number;
    width?: number;
    height?: number;
  };
  pricing?: ProductPricing;
};

type PricingConfig = {
  charged_aduana?: number;
  charged_local?: number;
  charged_freight_kg?: number;
  base_fee_percent?: number;

  WEIGHT_DEFAULT_KG?: number;
  WEIGHT_CATEGORY_MAP?: Record<string, number>;

  courier_volumetric_divisor?: number;
  courier_use_buckets?: boolean;
  courier_buckets_kg?: number[];
  courier_fallback_buffer_pct?: number;
  courier_ebay_extra_buffer_pct?: number;
  courier_global_min_billable_kg?: number;

  [key: string]: any;
};

let pricingConfigCache: PricingConfig | null = null;
let pricingConfigPromise: Promise<PricingConfig | null> | null = null;

function toNumber(value: any, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const clean = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
    const numberValue = Number(clean);

    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  return fallback;
}

function normalizePercent(value: any) {
  const numberValue = toNumber(value, 0);

  if (numberValue > 1) {
    return numberValue / 100;
  }

  return numberValue;
}

function normalizePricingConfig(raw: any): PricingConfig {
  const source = raw?.value || raw?.config || raw?.settings || raw?.data || raw || {};

  const bucketsRaw = source.courier_buckets_kg;
  const buckets = Array.isArray(bucketsRaw)
    ? bucketsRaw
        .map((item) => toNumber(item, 0))
        .filter((item) => item > 0)
        .sort((a, b) => a - b)
    : [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7, 10, 12, 15, 20, 25, 30];

  return {
    ...source,
    charged_aduana: toNumber(source.charged_aduana, 0),
    charged_local: toNumber(source.charged_local, 0),
    charged_freight_kg: toNumber(source.charged_freight_kg, 0),
    base_fee_percent: normalizePercent(source.base_fee_percent ?? 0),

    WEIGHT_DEFAULT_KG: toNumber(source.WEIGHT_DEFAULT_KG, 1),
    WEIGHT_CATEGORY_MAP:
      source.WEIGHT_CATEGORY_MAP && typeof source.WEIGHT_CATEGORY_MAP === "object"
        ? source.WEIGHT_CATEGORY_MAP
        : {},

    courier_volumetric_divisor: toNumber(source.courier_volumetric_divisor, 5000),
    courier_use_buckets:
      typeof source.courier_use_buckets === "boolean"
        ? source.courier_use_buckets
        : true,
    courier_buckets_kg: buckets,
    courier_fallback_buffer_pct: normalizePercent(
      source.courier_fallback_buffer_pct ?? 0
    ),
    courier_ebay_extra_buffer_pct: normalizePercent(
      source.courier_ebay_extra_buffer_pct ?? 0
    ),
    courier_global_min_billable_kg: toNumber(
      source.courier_global_min_billable_kg,
      0.5
    ),
  };
}

async function fetchPricingConfig(): Promise<PricingConfig | null> {
  if (pricingConfigCache) {
    return pricingConfigCache;
  }

  if (pricingConfigPromise) {
    return pricingConfigPromise;
  }

  pricingConfigPromise = (async () => {
    const endpoints = ["/api/pricing", "/api/princing"];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(buildApiUrl(endpoint));

        if (!response.ok) continue;

        const data = await response.json();
        const config = normalizePricingConfig(data);

        pricingConfigCache = config;
        return config;
      } catch (error) {
        console.log(`ERROR FETCH PRICING CONFIG ${endpoint}:`, error);
      }
    }

    return null;
  })();

  return pricingConfigPromise;
}

function getCategoryParts(category?: ProductCategory) {
  if (!category) return [];

  if (typeof category === "string") {
    return [category];
  }

  return [category.leaf, category.sub, category.main].filter(Boolean) as string[];
}

function getCategoryWeight(product: ShopXProduct, config: PricingConfig) {
  const map = config.WEIGHT_CATEGORY_MAP || {};
  const parts = getCategoryParts(product.category);

  for (const part of parts) {
    const exact = map[part];

    if (exact !== undefined) {
      return toNumber(exact, 0);
    }

    const lowerKey = Object.keys(map).find(
      (key) => key.toLowerCase() === part.toLowerCase()
    );

    if (lowerKey) {
      return toNumber(map[lowerKey], 0);
    }
  }

  return 0;
}

function getVolumetricWeightKg(product: ShopXProduct, config: PricingConfig) {
  const length = toNumber(product.dimensionsCm?.length, 0);
  const width = toNumber(product.dimensionsCm?.width, 0);
  const height = toNumber(product.dimensionsCm?.height, 0);
  const divisor = toNumber(config.courier_volumetric_divisor, 5000);

  if (!length || !width || !height || !divisor) {
    return 0;
  }

  return (length * width * height) / divisor;
}

function applyBucket(weightKg: number, config: PricingConfig) {
  if (!config.courier_use_buckets) {
    return weightKg;
  }

  const buckets = config.courier_buckets_kg || [];

  const bucket = buckets.find((item) => item >= weightKg);

  return bucket || weightKg;
}

function getBillableWeightKg(product: ShopXProduct, config: PricingConfig) {
  const rawProduct = product as any;

  const existingWeight =
    rawProduct?.pricing?.billableWeightKg ??
    rawProduct?.pricing?.totalWeightKg ??
    rawProduct?.billableWeightKg ??
    rawProduct?.totalWeightKg ??
    rawProduct?.logisticWeightKg ??
    rawProduct?.shippingWeightKg ??
    rawProduct?.weightKg ??
    rawProduct?.weight ??
    0;

  let weightKg = toNumber(existingWeight, 0);

  if (!weightKg) {
    weightKg = getCategoryWeight(product, config);
  }

  if (!weightKg) {
    weightKg = getVolumetricWeightKg(product, config);
  }

  if (!weightKg) {
    weightKg = toNumber(config.WEIGHT_DEFAULT_KG, 1);
  }

  const minWeight = toNumber(config.courier_global_min_billable_kg, 0.5);

  weightKg = Math.max(weightKg, minWeight);

  const fallbackBuffer = normalizePercent(config.courier_fallback_buffer_pct ?? 0);

  if (fallbackBuffer > 0) {
    weightKg = weightKg * (1 + fallbackBuffer);
  }

  const isEbay =
    product.source === "ebay" ||
    String(product.store || "").toLowerCase().includes("ebay");

  const ebayBuffer = normalizePercent(config.courier_ebay_extra_buffer_pct ?? 0);

  if (isEbay && ebayBuffer > 0) {
    weightKg = weightKg * (1 + ebayBuffer);
  }

  return applyBucket(weightKg, config);
}

function getBasePriceUSD(product: ShopXProduct) {
  const rawProduct = product as any;

  const base =
    rawProduct.priceUSD ??
    rawProduct.sourcePriceUSD ??
    rawProduct.originPriceUSD ??
    rawProduct.usaPriceUSD ??
    rawProduct.basePriceUSD ??
    rawProduct.retailPriceUSD ??
    rawProduct.productPriceUSD ??
    0;

  return toNumber(base, 0);
}

function calculatePricing(
  product: ShopXProduct,
  config: PricingConfig
): ProductPricing | null {
  const productBaseUSD = getBasePriceUSD(product);

  if (!productBaseUSD || productBaseUSD <= 0) {
    return null;
  }

  const ivaImportacion = productBaseUSD * 0.21;

  const billableWeightKg = getBillableWeightKg(product, config);
  const freightKg = toNumber(config.charged_freight_kg, 0);
  const fleteInternacional = billableWeightKg * freightKg;

  const aduana = toNumber(config.charged_aduana, 0);
  const gestion = productBaseUSD * normalizePercent(config.base_fee_percent ?? 0);
  const logisticaNacional = toNumber(config.charged_local, 0);

  const breakdown: PricingBreakdownRow[] = [
    {
      label: "Productos USA",
      amount: productBaseUSD,
    },
    {
      label: "IVA importación",
      amount: ivaImportacion,
    },
    {
      label: "Flete internacional",
      amount: fleteInternacional,
    },
    {
      label: "Aduana y tasas",
      amount: aduana,
    },
    {
      label: "Gestión y seguro ShopX",
      amount: gestion,
    },
    {
      label: "Logística nacional",
      amount: logisticaNacional,
    },
  ].filter((row) => Number.isFinite(row.amount) && row.amount > 0);

  const finalUSD = breakdown.reduce((total, row) => total + row.amount, 0);

  return {
    finalUSD,
    totalFinal: finalUSD,
    totalWeightKg: billableWeightKg,
    billableWeightKg,
    isWeightImputed: true,
    breakdown,
  };
}

function productHasUsablePricing(product: ShopXProduct) {
  const final =
    product.pricing?.finalUSD ||
    product.pricing?.totalFinal ||
    product.finalPriceUSD ||
    product.estimatedUSD ||
    0;

  return Number(final) > 0 && Array.isArray(product.pricing?.breakdown);
}

function enrichProductWithPricing(
  product: ShopXProduct,
  config: PricingConfig | null
): ShopXProduct {
  if (!config) {
    return product;
  }

  if (productHasUsablePricing(product)) {
    const final =
      product.pricing?.finalUSD ||
      product.pricing?.totalFinal ||
      product.finalPriceUSD ||
      product.estimatedUSD ||
      0;

    return {
      ...product,
      finalPriceUSD: toNumber(final, 0),
      estimatedUSD: toNumber(final, 0),
      pricing: {
        ...product.pricing,
        finalUSD: toNumber(final, 0),
        totalFinal: toNumber(final, 0),
        breakdown: product.pricing?.breakdown || [],
      },
    };
  }

  const calculatedPricing = calculatePricing(product, config);

  if (!calculatedPricing) {
    return product;
  }

  return {
    ...product,
    finalPriceUSD: calculatedPricing.finalUSD,
    estimatedUSD: calculatedPricing.finalUSD,
    pricing: calculatedPricing,
  };
}

async function enrichProductsWithPricing(products: ShopXProduct[]) {
  const config = await fetchPricingConfig();

  return products.map((product) => enrichProductWithPricing(product, config));
}

export async function getProducts(limit = 100): Promise<ShopXProduct[]> {
  const response = await fetch(buildApiUrl(`/api/products?limit=${limit}`));

  if (!response.ok) {
    throw new Error("No se pudieron obtener los productos de ShopX");
  }

  const data = await response.json();

  if (!data?.ok || !Array.isArray(data.products)) {
    throw new Error("Respuesta inválida de /api/products");
  }

  return enrichProductsWithPricing(data.products);
}

export async function searchProducts(query: string): Promise<ShopXProduct[]> {
  const cleanQuery = query.trim();

  if (!cleanQuery) {
    return [];
  }

  const response = await fetch(
    buildApiUrl(`/api/app-search?query=${encodeURIComponent(cleanQuery)}`)
  );

  if (!response.ok) {
    throw new Error("No se pudieron buscar productos");
  }

  const data = await response.json();

  if (!data?.ok || !Array.isArray(data.products)) {
    throw new Error("Respuesta inválida de /api/app-search");
  }

  return enrichProductsWithPricing(data.products);
}

export async function getProductBySlug(
  slug: string
): Promise<ShopXProduct | null> {
  const products = await getProducts(800);

  return (
    products.find((product) => product.slug === slug) ||
    products.find((product) => product._id === slug) ||
    products.find((product) => product.id === slug) ||
    products.find((product) => product.externalId === slug) ||
    null
  );
}

export function getDisplayFinalPriceUSD(product: ShopXProduct): number {
  return (
    toNumber(product.finalPriceUSD, 0) ||
    toNumber(product.pricing?.finalUSD, 0) ||
    toNumber(product.pricing?.totalFinal, 0) ||
    toNumber(product.estimatedUSD, 0) ||
    toNumber(product.priceUSD, 0) ||
    0
  );
}

export function formatUSD(value?: number) {
  if (!value) return "Consultar";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function toAbsoluteImageUrl(url?: string | null) {
  if (!url) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return buildApiUrl(url);
}

export function getProductImage(product: ShopXProduct): string | null {
  const rawImage =
    product.imageUrls?.[0] ||
    product.images?.[0] ||
    product.imageUrl ||
    product.image ||
    null;

  return toAbsoluteImageUrl(rawImage);
}

export function getProductKey(product: ShopXProduct) {
  return (
    product._id ||
    product.id ||
    product.slug ||
    product.externalId ||
    product.sourceUrl ||
    product.title
  );
}