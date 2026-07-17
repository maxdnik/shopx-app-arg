// lib/api.ts
import { buildApiUrl } from "./config";

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

export type SelectedProductOptions = Record<string, string>;

export type ProductOptionGroup = {
  name: string;
  values: string[];
};

export type SelectedProductVariant = {
  id?: string;
  sku?: string;
  title?: string;
  priceUSD?: number;
  imageUrl?: string;
  available?: boolean;
  selectedOptions?: SelectedProductOptions;
};

export type ShopXProduct = {
  _id?: string;
  id?: string;
  title: string;
  slug: string;
  store?: string;
  brand?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  priceUSD?: number;
  estimatedUSD?: number;
  finalPriceUSD?: number;
  description?: string;
  category?: ProductCategory;
  images?: string[];
  imageUrls?: string[];
  image?: string;
  imageUrl?: string;
  media?: any[];
  sourceRaw?: any;
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
  specs?: Record<string, any> | Array<any>;
  options?: Array<{
    name?: string;
    values?: string[];
    value?: string;
  }>;
  variations?: Array<any>;
  variationMatrix?: Array<any>;
  shopifyVariants?: Array<any>;
  selectedOptions?: SelectedProductOptions;
  selectedVariant?: SelectedProductVariant | any;
  selectedVariantId?: string;
  weeklyPick?: boolean;
  weeklyPickOrder?: number;
  weeklyPickUpdatedAt?: string;
  homePlacement?: "auto" | "clothing" | "technology" | "toys" | "outdoor" | "hidden";
  homeOrder?: number;
  pricing?: ProductPricing;
};

export type DomesticPricingDestination = {
  province?: string;
  city?: string;
  postalCode?: string;
};

export type ProductSelectionResolveItem = {
  key?: string;
  slug?: string;
  productKey?: string;
  selectedOptions?: SelectedProductOptions;
  selectedVariantId?: string;
  quantity?: number;
};

function toNumber(value: any, fallback = 0) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return fallback;

    let clean = raw.replace(/[^0-9.,-]/g, "");
    if (!clean || clean === "-" || clean === "." || clean === ",") return fallback;

    const lastComma = clean.lastIndexOf(",");
    const lastDot = clean.lastIndexOf(".");

    if (lastComma >= 0 && lastDot >= 0) {
      // Soporta USD 2,799.00 y también formato AR/EU 2.799,00.
      if (lastComma > lastDot) {
        clean = clean.replace(/\./g, "").replace(",", ".");
      } else {
        clean = clean.replace(/,/g, "");
      }
    } else if (lastComma >= 0) {
      clean = clean.replace(",", ".");
    } else {
      const dots = (clean.match(/\./g) || []).length;
      if (dots > 1) {
        const last = clean.lastIndexOf(".");
        clean = clean.slice(0, last).replace(/\./g, "") + clean.slice(last);
      }
    }

    const numberValue = Number(clean);
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function cleanString(value: any) {
  return String(value || "").trim();
}

function normalizeForCompare(value: any) {
  return cleanString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(\d+)\s+(gb|tb|mb)\b/g, "$1$2")
    .replace(/\b(us)\s+(\d+)\s+(\d+)\b/g, "$1 $2.$3")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseLabel(value: any) {
  const original = cleanString(value);
  const normalized = normalizeForCompare(original);

  if (!normalized || normalized === "title" || normalized === "default title") return "Opción";

  if (
    normalized.includes("capacity") ||
    normalized.includes("capacidad") ||
    normalized.includes("storage") ||
    normalized.includes("almacenamiento") ||
    normalized.includes("ssd") ||
    normalized.includes("disco")
  ) {
    return "Capacidad";
  }

  if (normalized.includes("color") || normalized.includes("colour")) return "Color";

  if (
    normalized.includes("size") ||
    normalized.includes("sizes") ||
    normalized.includes("talle") ||
    normalized.includes("talla") ||
    normalized.includes("shoe size") ||
    normalized.includes("us size")
  ) {
    return "Talle";
  }

  if (normalized.includes("memory") || normalized.includes("memoria")) return "Memoria";
  if (normalized.includes("ram")) return "RAM";
  if (normalized.includes("dimension") || normalized.includes("dimensiones")) return "Dimensiones";
  if (normalized.includes("width") || normalized.includes("ancho")) return "Ancho";
  if (normalized.includes("material")) return "Material";
  if (normalized.includes("model") || normalized.includes("modelo")) return "Modelo";

  const clean = original
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return "Opción";

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function normalizeOptionName(value: any) {
  return titleCaseLabel(value);
}

function parseListLikeValue(value: any): any[] {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) return value;

  if (typeof value === "object") {
    if (Array.isArray(value.values)) return value.values;
    if (Array.isArray(value.options)) return value.options;
    if (Array.isArray(value.choices)) return value.choices;
    if (value.value !== undefined) return parseListLikeValue(value.value);
    if (value.name !== undefined) return [value.name];
    if (value.title !== undefined) return [value.title];
    return [];
  }

  const textValue = cleanString(value);
  if (!textValue) return [];

  const trimmed = textValue.trim();

  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      return parseListLikeValue(parsed);
    } catch {
      // Sigue con fallback abajo.
    }
  }

  if (trimmed.includes("||")) return trimmed.split("||");
  if (trimmed.includes(";")) return trimmed.split(";");
  if (trimmed.includes(",")) return trimmed.split(",");

  return [trimmed];
}

function cleanOptionValue(value: any) {
  const clean = cleanString(value?.value ?? value?.name ?? value?.title ?? value)
    .replace(/^['"\[]+|['"\]]+$/g, "")
    .replace(/\\"/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  if (!clean || normalizeForCompare(clean) === "default title") return "";
  return clean;
}

function isSelectableSpecKey(key: any) {
  const normalized = normalizeForCompare(key);

  return (
    normalized === "color" ||
    normalized === "colors" ||
    normalized === "colors all" ||
    normalized === "available colors" ||
    normalized === "color all" ||
    normalized === "capacity" ||
    normalized === "capacities" ||
    normalized === "capacidad" ||
    normalized === "storage" ||
    normalized === "storage options" ||
    normalized === "almacenamiento" ||
    normalized === "size" ||
    normalized === "sizes" ||
    normalized === "sizes all" ||
    normalized === "sizes available" ||
    normalized === "shoe size" ||
    normalized === "us size" ||
    normalized === "talle" ||
    normalized === "talla" ||
    normalized === "dimension" ||
    normalized === "dimensions" ||
    normalized === "dimensiones"
  );
}

function selectionGroupPriority(name: string) {
  const normalized = normalizeForCompare(name);

  if (normalized.includes("capacidad") || normalized.includes("storage")) return 1;
  if (normalized.includes("memoria") || normalized === "ram") return 2;
  if (normalized.includes("color")) return 3;
  if (normalized.includes("talle") || normalized.includes("size")) return 4;
  if (normalized.includes("dimension")) return 5;

  return 20;
}

function sortOptionValuesByGroup(name: string, values: string[]) {
  const normalized = normalizeForCompare(name);
  const unique = Array.from(new Set(values.map(cleanOptionValue).filter(Boolean)));

  if (normalized.includes("capacidad") || normalized.includes("storage") || normalized.includes("memoria") || normalized === "ram") {
    return unique.sort((a, b) => {
      const toGb = (value: string) => {
        const numberValue = toNumber(value, 0);
        const lower = value.toLowerCase();
        if (lower.includes("tb")) return numberValue * 1024;
        if (lower.includes("mb")) return numberValue / 1024;
        return numberValue;
      };

      const aGb = toGb(a);
      const bGb = toGb(b);
      if (aGb && bGb) return aGb - bGb;
      return a.localeCompare(b);
    });
  }

  if (normalized.includes("talle") || normalized.includes("size")) {
    return unique.sort((a, b) => {
      const order = ["xxs", "xs", "s", "m", "l", "xl", "xxl", "2xl", "3xl", "4xl"];
      const aKey = normalizeForCompare(a).replace(/\s+/g, "");
      const bKey = normalizeForCompare(b).replace(/\s+/g, "");
      const aIndex = order.indexOf(aKey);
      const bIndex = order.indexOf(bKey);

      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;

      const aNumber = toNumber(a, NaN);
      const bNumber = toNumber(b, NaN);
      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;

      return a.localeCompare(b);
    });
  }

  return unique.sort((a, b) => a.localeCompare(b));
}

function isPriceSensitiveOptionGroup(name: string) {
  const normalized = normalizeForCompare(name);
  return (
    normalized.includes("capacidad") ||
    normalized.includes("capacity") ||
    normalized.includes("storage") ||
    normalized.includes("almacenamiento") ||
    normalized.includes("memoria") ||
    normalized.includes("memory") ||
    normalized === "ram" ||
    normalized.includes("ssd")
  );
}

function productHasPricedVariantSource(product: ShopXProduct) {
  return collectProductVariants(product).some((variant: any) => getVariantPriceUSD(variant) > 0);
}

function collectProductVariants(product: ShopXProduct): any[] {
  const rawProduct = product as any;
  const sourceRaw = rawProduct?.sourceRaw || {};

  return [
    ...(Array.isArray(rawProduct?.shopifyVariants) ? rawProduct.shopifyVariants : []),
    ...(Array.isArray(rawProduct?.variations) ? rawProduct.variations : []),
    ...(Array.isArray(rawProduct?.variationMatrix) ? rawProduct.variationMatrix : []),
    ...(Array.isArray(sourceRaw?.shopifyVariants) ? sourceRaw.shopifyVariants : []),
    ...(Array.isArray(sourceRaw?.variants) ? sourceRaw.variants : []),
    ...(Array.isArray(sourceRaw?.product?.variants) ? sourceRaw.product.variants : []),
    ...(Array.isArray(sourceRaw?.data?.variants) ? sourceRaw.data.variants : []),
  ].filter(Boolean);
}

function addOptionValue(target: Map<string, Set<string>>, rawName: any, rawValue: any) {
  const name = titleCaseLabel(rawName);
  if (!name || name === "Opción") return;

  parseListLikeValue(rawValue).forEach((value) => {
    const cleanValue = cleanOptionValue(value);
    if (!cleanValue) return;

    if (!target.has(name)) target.set(name, new Set<string>());
    target.get(name)?.add(cleanValue);
  });
}

function extractOptionValues(option: any): string[] {
  const rawValues =
    option?.values ??
    option?.value ??
    option?.options ??
    option?.choices ??
    option?.items ??
    [];

  return Array.from(new Set(parseListLikeValue(rawValues).map(cleanOptionValue).filter(Boolean)));
}

function getProductOptionNames(product: ShopXProduct): string[] {
  const rawOptions = Array.isArray(product.options) ? product.options : [];

  const names = rawOptions
    .map((option, index) => titleCaseLabel(option?.name || `Opción ${index + 1}`))
    .filter((name) => name && name !== "Opción");

  if (names.length) return names;

  const firstVariant = collectProductVariants(product)[0];
  if (!firstVariant) return [];

  if (Array.isArray(firstVariant?.selectedOptions)) {
    return firstVariant.selectedOptions
      .map((item: any) => titleCaseLabel(item?.name || item?.label || item?.key))
      .filter((name: string) => name && name !== "Opción");
  }

  if (firstVariant?.selectedOptions && typeof firstVariant.selectedOptions === "object") {
    return Object.keys(firstVariant.selectedOptions)
      .map(titleCaseLabel)
      .filter((name) => name && name !== "Opción");
  }

  return [];
}

function extractVariantSelectedOptions(
  variant: any,
  product: ShopXProduct
): SelectedProductOptions {
  const selected: SelectedProductOptions = {};
  const optionNames = getProductOptionNames(product);

  const addSelected = (rawName: any, rawValue: any) => {
    const name = titleCaseLabel(rawName);
    const value = cleanOptionValue(rawValue);
    if (name && name !== "Opción" && value) selected[name] = value;
  };

  if (Array.isArray(variant?.selectedOptions)) {
    variant.selectedOptions.forEach((item: any) => {
      addSelected(item?.name || item?.label || item?.key, item?.value || item?.nameValue || item?.title);
    });
  }

  if (variant?.selectedOptions && typeof variant.selectedOptions === "object" && !Array.isArray(variant.selectedOptions)) {
    Object.entries(variant.selectedOptions).forEach(([name, value]) => addSelected(name, value));
  }

  if (Array.isArray(variant?.options)) {
    variant.options.forEach((item: any, index: number) => {
      if (typeof item === "string" || typeof item === "number") {
        addSelected(optionNames[index] || `Opción ${index + 1}`, item);
        return;
      }

      addSelected(item?.name || item?.label || item?.key || optionNames[index] || `Opción ${index + 1}`, item?.value || item?.title || item?.nameValue);
    });
  }

  if (variant?.options && typeof variant.options === "object" && !Array.isArray(variant.options)) {
    Object.entries(variant.options).forEach(([name, value]) => addSelected(name, value));
  }

  if (variant?.selections && typeof variant.selections === "object" && !Array.isArray(variant.selections)) {
    Object.entries(variant.selections).forEach(([name, value]) => addSelected(name, value));
  }

  ["option1", "option2", "option3"].forEach((key, index) => {
    const value = cleanOptionValue(variant?.[key]);
    if (!value) return;

    addSelected(optionNames[index] || `Opción ${index + 1}`, value);
  });

  if (Array.isArray(variant?.attributes)) {
    variant.attributes.forEach((item: any) => {
      addSelected(item?.name || item?.label || item?.key, item?.value || item?.title);
    });
  }

  if ((variant?.attribute || variant?.name || variant?.label || variant?.key) && (variant?.value || variant?.title || variant?.optionValue)) {
    addSelected(variant?.attribute || variant?.name || variant?.label || variant?.key, variant?.value || variant?.title || variant?.optionValue);
  }

  [
    ["Color", variant?.color || variant?.colour || variant?.colorName],
    ["Capacidad", variant?.capacity || variant?.storage || variant?.ssd || variant?.storageSize],
    ["Memoria", variant?.memory || variant?.ram],
    ["Talle", variant?.size || variant?.shoeSize || variant?.usSize],
  ].forEach(([name, value]) => addSelected(name, value));

  return selected;
}

function getVariantId(variant: any) {
  return cleanString(
    variant?.id ||
      variant?._id ||
      variant?.variantId ||
      variant?.admin_graphql_api_id ||
      variant?.sku ||
      variant?.title ||
      ""
  );
}

function getVariantTitle(variant: any, selectedOptions?: SelectedProductOptions) {
  const title = cleanString(variant?.title || variant?.name);
  if (title && normalizeForCompare(title) !== "default title") return title;

  const values = Object.values(selectedOptions || {}).filter(Boolean);
  return values.join(" / ");
}

function getVariantPriceUSD(variant: any) {
  // IMPORTANTE:
  // Estos campos representan PRECIO USA de variante.
  // No usamos finalPriceUSD/estimatedUSD acá porque son precios all-in ya calculados.
  // Si los metemos de nuevo en el pricing engine, se infla el total final.
  return toNumber(
    variant?.priceUSD ??
      variant?.sourcePriceUSD ??
      variant?.priceAmount ??
      variant?.amountUSD ??
      variant?.price?.amount ??
      variant?.price?.value ??
      variant?.presentmentPrice?.amount ??
      variant?.node?.price?.amount ??
      variant?.node?.priceUSD ??
      variant?.price,
    0
  );
}

function extractImageUrl(value: any): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    return (
      value.url ||
      value.src ||
      value.imageUrl ||
      value.image ||
      value.originalSrc ||
      value.transformedSrc ||
      value?.node?.url ||
      value?.node?.src ||
      null
    );
  }

  return null;
}

function getVariantImageUrl(variant: any) {
  return extractImageUrl(
    variant?.imageUrl ||
      variant?.image ||
      variant?.featuredImage ||
      variant?.featured_image ||
      variant?.media?.[0] ||
      variant?.imageDetails?.images?.[0]
  );
}

function normalizeBreakdownRow(row: any): PricingBreakdownRow | null {
  const label = String(
    row?.label ?? row?.name ?? row?.concept ?? row?.title ?? ""
  ).trim();

  const amount = toNumber(
    row?.amount ??
      row?.amountUSD ??
      row?.value ??
      row?.usd ??
      row?.priceUSD ??
      row?.totalUSD ??
      row?.total,
    0
  );

  if (!label || !Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return { label, amount };
}

function normalizeBreakdown(product: ShopXProduct): PricingBreakdownRow[] {
  const rawProduct = product as any;
  const rawBreakdown =
    rawProduct?.pricing?.breakdown ||
    rawProduct?.pricingBreakdown ||
    rawProduct?.breakdown ||
    rawProduct?.priceBreakdown ||
    [];

  if (!Array.isArray(rawBreakdown)) {
    return [];
  }

  return rawBreakdown
    .map(normalizeBreakdownRow)
    .filter(Boolean) as PricingBreakdownRow[];
}

function getRawFinalPriceUSD(product: ShopXProduct) {
  const rawProduct = product as any;
  const breakdown = normalizeBreakdown(product);
  const breakdownTotal = breakdown.reduce(
    (total, row) => total + toNumber(row.amount, 0),
    0
  );

  return (
    toNumber(rawProduct?.pricing?.finalUSD, 0) ||
    toNumber(rawProduct?.pricing?.totalFinal, 0) ||
    toNumber(rawProduct?.totalFinal, 0) ||
    toNumber(rawProduct?.finalPriceUSD, 0) ||
    toNumber(rawProduct?.estimatedUSD, 0) ||
    toNumber(breakdownTotal, 0) ||
    toNumber(rawProduct?.priceUSD, 0) ||
    0
  );
}

function normalizeProductFromApi(product: ShopXProduct): ShopXProduct {
  const finalUSD = getRawFinalPriceUSD(product);
  const breakdown = normalizeBreakdown(product);
  const rawPricing = product.pricing || {};

  if (finalUSD <= 0 && !breakdown.length && !product.pricing) {
    return product;
  }

  return {
    ...product,
    finalPriceUSD: finalUSD > 0 ? finalUSD : product.finalPriceUSD,
    estimatedUSD: finalUSD > 0 ? finalUSD : product.estimatedUSD,
    pricing: {
      ...rawPricing,
      finalUSD: finalUSD > 0 ? finalUSD : rawPricing.finalUSD,
      totalFinal: finalUSD > 0 ? finalUSD : rawPricing.totalFinal,
      breakdown,
    },
  };
}

function normalizeProductsFromApi(products: ShopXProduct[]) {
  return products.map(normalizeProductFromApi);
}

function getProductResolveKey(product: ShopXProduct): string {
  return String(
    product.slug ||
      product._id ||
      product.id ||
      product.externalId ||
      product.sourceUrl ||
      product.title ||
      ""
  ).trim();
}

function mergeResolvedProduct(
  base: ShopXProduct,
  resolved?: ShopXProduct | null
): ShopXProduct {
  if (!resolved) return base;

  const baseAny = base as any;
  const resolvedAny = resolved as any;

  return {
    ...base,
    ...resolved,
    images: resolved.images?.length ? resolved.images : base.images,
    imageUrls: resolved.imageUrls?.length ? resolved.imageUrls : base.imageUrls,
    image: resolved.image || base.image,
    imageUrl: resolved.imageUrl || base.imageUrl,
    media: Array.isArray(resolvedAny.media) && resolvedAny.media.length ? resolvedAny.media : baseAny.media,
    sourceRaw: resolvedAny.sourceRaw || baseAny.sourceRaw,
    specs: resolvedAny.specs && Object.keys(resolvedAny.specs || {}).length ? resolvedAny.specs : baseAny.specs,
    options: resolvedAny.options?.length ? resolvedAny.options : baseAny.options,
    variations: resolvedAny.variations?.length ? resolvedAny.variations : baseAny.variations,
    variationMatrix: resolvedAny.variationMatrix?.length ? resolvedAny.variationMatrix : baseAny.variationMatrix,
    shopifyVariants: resolvedAny.shopifyVariants?.length
      ? resolvedAny.shopifyVariants
      : baseAny.shopifyVariants,
    selectedOptions: resolvedAny.selectedOptions || baseAny.selectedOptions,
    selectedVariant: resolvedAny.selectedVariant || baseAny.selectedVariant,
    selectedVariantId: resolvedAny.selectedVariantId || baseAny.selectedVariantId,
    pricing: resolved.pricing || base.pricing,
  };
}

async function hydrateProductsWithResolvedPricing(
  products: ShopXProduct[],
  destination?: DomesticPricingDestination
): Promise<ShopXProduct[]> {
  const normalizedBase = normalizeProductsFromApi(products);

  const keys = Array.from(
    new Set(normalizedBase.map(getProductResolveKey).filter(Boolean))
  );

  if (!keys.length) {
    return normalizedBase;
  }

  try {
    const response = await fetch(buildApiUrl("/api/app/products/resolve"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slugs: keys,
        destination: destination || undefined,
      }),
    });

    if (!response.ok) {
      return normalizedBase;
    }

    const data = await response.json();

    if (!data?.ok || !Array.isArray(data.products)) {
      return normalizedBase;
    }

    const resolvedProducts = normalizeProductsFromApi(data.products);
    const resolvedByKey = new Map<string, ShopXProduct>();

    for (const product of resolvedProducts) {
      const possibleKeys = [
        product.slug,
        product._id,
        product.id,
        product.externalId,
        product.sourceUrl,
        product.title,
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean);

      for (const key of possibleKeys) {
        resolvedByKey.set(key, product);
      }
    }

    return normalizedBase.map((product) => {
      const key = getProductResolveKey(product);
      const resolved = resolvedByKey.get(key);

      return mergeResolvedProduct(product, resolved);
    });
  } catch (error) {
    console.log("HYDRATE PRODUCTS PRICING ERROR:", error);
    return normalizedBase;
  }
}


function sortProductsByWeeklyPickOrder(products: ShopXProduct[]): ShopXProduct[] {
  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => {
      const aOrder = Number(a.product.weeklyPickOrder);
      const bOrder = Number(b.product.weeklyPickOrder);
      const aHasOrder = Number.isFinite(aOrder);
      const bHasOrder = Number.isFinite(bOrder);

      if (aHasOrder && bHasOrder && aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      if (aHasOrder && !bHasOrder) return -1;
      if (!aHasOrder && bHasOrder) return 1;

      return a.index - b.index;
    })
    .map(({ product }) => product);
}


export async function getProducts(
  limit = 100,
  destination?: DomesticPricingDestination
): Promise<ShopXProduct[]> {
  const response = await fetch(buildApiUrl(`/api/products?limit=${limit}`));

  if (!response.ok) {
    throw new Error("No se pudieron obtener los productos de ShopX");
  }

  const data = await response.json();

  if (!data?.ok || !Array.isArray(data.products)) {
    throw new Error("Respuesta inválida de /api/products");
  }

  return hydrateProductsWithResolvedPricing(data.products, destination);
}



export type HomeSectionKey = "clothing" | "technology" | "toys" | "outdoor";

export type HomeSectionsResponse = Record<HomeSectionKey, ShopXProduct[]>;

export async function getHomeSections(): Promise<HomeSectionsResponse> {
  const response = await fetch(buildApiUrl("/api/app/home-sections"));

  if (!response.ok) {
    throw new Error("No se pudieron obtener las secciones del home");
  }

  const data = await response.json();

  if (!data?.ok || !data?.sections) {
    throw new Error("Respuesta inválida de /api/app/home-sections");
  }

  return {
    clothing: Array.isArray(data.sections.clothing)
      ? data.sections.clothing
      : [],
    technology: Array.isArray(data.sections.technology)
      ? data.sections.technology
      : [],
    toys: Array.isArray(data.sections.toys)
      ? data.sections.toys
      : [],
    outdoor: Array.isArray(data.sections.outdoor)
      ? data.sections.outdoor
      : [],
  };
}

export async function getWeeklyMostRequestedProducts(
  limit = 10,
): Promise<ShopXProduct[]> {
  const response = await fetch(
    buildApiUrl(
      `/api/app/products?collection=weekly-most-requested&limit=${limit}`,
    ),
  );

  if (!response.ok) {
    throw new Error(
      "No se pudieron obtener los productos más pedidos de la semana",
    );
  }

  const data = await response.json();

  if (!data?.ok || !Array.isArray(data.products)) {
    throw new Error(
      "Respuesta inválida de /api/app/products weekly-most-requested",
    );
  }

  return sortProductsByWeeklyPickOrder(data.products).slice(0, limit);
}

export async function searchProducts(
  query: string,
  destination?: DomesticPricingDestination
): Promise<ShopXProduct[]> {
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

  return hydrateProductsWithResolvedPricing(data.products, destination);
}

export async function getProductBySlug(
  slug: string,
  destination?: DomesticPricingDestination
): Promise<ShopXProduct | null> {
  const cleanSlug = String(slug || "").trim();

  if (!cleanSlug) {
    return null;
  }

  const response = await fetch(
    buildApiUrl(`/api/app/products/${encodeURIComponent(cleanSlug)}`)
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("No se pudo obtener el producto de ShopX");
  }

  const data = await response.json();

  if (!data?.ok || !data.product) {
    return null;
  }

  const normalized = normalizeProductFromApi(data.product);

  if (destination) {
    try {
      const resolved = await resolveProductsBySlugs(
        [normalized.slug || normalized._id || cleanSlug],
        destination
      );

      return mergeResolvedProduct(normalized, resolved[0]);
    } catch {
      return normalized;
    }
  }

  return normalized;
}

export async function getProductsByStore(
  storeSlug: string,
  limit = 24,
  destination?: DomesticPricingDestination
): Promise<ShopXProduct[]> {
  const cleanSlug = String(storeSlug || "").trim();

  if (!cleanSlug) {
    return [];
  }

  const response = await fetch(
    buildApiUrl(
      `/api/app/stores/${encodeURIComponent(cleanSlug)}/products?limit=${limit}`
    )
  );

  if (!response.ok) {
    throw new Error("No se pudieron obtener los productos de la tienda");
  }

  const data = await response.json();

  if (!data?.ok || !Array.isArray(data.products)) {
    return [];
  }

  return hydrateProductsWithResolvedPricing(data.products, destination);
}

export async function resolveProductsBySlugs(
  slugs: string[],
  destination?: DomesticPricingDestination
): Promise<ShopXProduct[]> {
  const cleanSlugs = Array.from(
    new Set(
      slugs
        .map((slug) => String(slug || "").trim())
        .filter(Boolean)
    )
  );

  if (!cleanSlugs.length) {
    return [];
  }

  const response = await fetch(buildApiUrl("/api/app/products/resolve"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      slugs: cleanSlugs,
      destination: destination || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error("No se pudieron resolver los productos del carrito");
  }

  const data = await response.json();

  if (!data?.ok || !Array.isArray(data.products)) {
    return [];
  }

  return normalizeProductsFromApi(data.products);
}

export async function resolveProductsForCartItems(
  items: ProductSelectionResolveItem[],
  destination?: DomesticPricingDestination
): Promise<ShopXProduct[]> {
  const cleanItems = items
    .map((item) => ({
      key: cleanString(item.key || item.slug || item.productKey),
      selectedOptions: item.selectedOptions || undefined,
      selectedVariantId: item.selectedVariantId || undefined,
      quantity: Number(item.quantity || 1),
    }))
    .filter((item) => item.key);

  if (!cleanItems.length) return [];

  const response = await fetch(buildApiUrl("/api/app/products/resolve"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: cleanItems,
      destination: destination || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error("No se pudieron resolver las variantes del carrito");
  }

  const data = await response.json();

  if (!data?.ok || !Array.isArray(data.products)) {
    return [];
  }

  return normalizeProductsFromApi(data.products);
}

export function getDisplayFinalPriceUSD(product: ShopXProduct): number {
  return getRawFinalPriceUSD(product);
}

export function formatUSD(value?: number) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "Consultar";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(amount);
}

function toAbsoluteImageUrl(url?: string | null) {
  if (!url) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return buildApiUrl(url);
}

function collectRawImages(value: any): any[] {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (Array.isArray(value?.edges)) {
    return value.edges.map((edge: any) => edge?.node || edge).filter(Boolean);
  }

  if (Array.isArray(value?.nodes)) return value.nodes;

  return [value];
}

export function getSelectableOptionGroups(product: ShopXProduct): ProductOptionGroup[] {
  const rawProduct = product as any;
  const groups = new Map<string, Set<string>>();
  const hasPricedVariants = productHasPricedVariantSource(product);

  if (Array.isArray(product.options)) {
    product.options.forEach((option, index) => {
      const name = option?.name || `Opción ${index + 1}`;
      const values = extractOptionValues(option);
      values.forEach((value) => addOptionValue(groups, name, value));
    });
  }

  collectProductVariants(product).forEach((variant: any) => {
    const selected = extractVariantSelectedOptions(variant, product);
    Object.entries(selected).forEach(([name, value]) => addOptionValue(groups, name, value));
  });

  const specs = rawProduct?.specs;
  const specEntries = specs && typeof specs === "object" && !Array.isArray(specs)
    ? Object.entries(specs)
    : [];

  specEntries.forEach(([key, value]) => {
    if (!isSelectableSpecKey(key)) return;

    // E-commerce rule: Color/talle pueden venir de specs y no cambiar precio.
    // Capacidad/memoria/storage NO se muestran desde specs si no hay variantes con precio,
    // porque si no el usuario elige 1 TB y el precio queda igual.
    if (isPriceSensitiveOptionGroup(String(key)) && !hasPricedVariants) return;

    const values = parseListLikeValue(value).map(cleanOptionValue).filter(Boolean);
    if (values.length > 1) {
      values.forEach((item) => addOptionValue(groups, key, item));
    }
  });

  return Array.from(groups.entries())
    .map(([name, values]) => ({
      name,
      values: sortOptionValuesByGroup(name, Array.from(values)),
    }))
    .filter((group) => group.values.length > 1)
    .filter((group) => !isPriceSensitiveOptionGroup(group.name) || hasPricedVariants)
    .sort((a, b) => selectionGroupPriority(a.name) - selectionGroupPriority(b.name))
    .slice(0, 8);
}

export function buildInitialSelectedOptions(product: ShopXProduct): SelectedProductOptions {
  const existing = product.selectedOptions || {};
  const groups = getSelectableOptionGroups(product);
  const selected: SelectedProductOptions = {};

  groups.forEach((group) => {
    const existingValue = Object.entries(existing).find(
      ([name]) => normalizeForCompare(name) === normalizeForCompare(group.name)
    )?.[1];

    selected[group.name] = cleanString(existingValue) || group.values[0];
  });

  return selected;
}

function optionSelectionsMatch(
  variantOptions: SelectedProductOptions,
  selectedOptions: SelectedProductOptions
) {
  const selectedEntries = Object.entries(selectedOptions).filter(([, value]) => cleanString(value));

  if (!selectedEntries.length) return false;

  return selectedEntries.every(([name, value]) => {
    const match = Object.entries(variantOptions).find(
      ([variantName]) => normalizeForCompare(variantName) === normalizeForCompare(name)
    );

    if (!match) return false;

    return normalizeForCompare(match[1]) === normalizeForCompare(value);
  });
}

function getFlatVariationOption(variation: any): { name: string; value: string } | null {
  const name = normalizeOptionName(variation?.attribute || variation?.name || variation?.label || variation?.key);
  const value = cleanString(variation?.value || variation?.title || variation?.option || variation?.optionValue);

  if (!name || !value || normalizeForCompare(value) === "default title") return null;

  return { name, value };
}

function getFlatVariationPrice(variation: any) {
  return toNumber(
    variation?.priceUSD ??
      variation?.price ??
      variation?.surchargeUSD ??
      variation?.extraUSD ??
      variation?.deltaUSD,
    0
  );
}

function getBaseSourcePriceUSD(product: ShopXProduct) {
  const rawProduct = product as any;
  return toNumber(
    product.priceUSD ??
      rawProduct.sourcePriceUSD ??
      rawProduct.price ??
      rawProduct.basePriceUSD,
    0
  );
}

function findStructuredProductVariant(
  product: ShopXProduct,
  selectedOptions?: SelectedProductOptions
): any | null {
  const rawProduct = product as any;
  const selected = selectedOptions || product.selectedOptions || {};
  const selectedVariantId = cleanString(product.selectedVariantId || rawProduct?.selectedVariant?.id);
  const variants = collectProductVariants(product).filter((variant: any) => {
    return (
      variant?.selectedOptions ||
      variant?.options ||
      variant?.selections ||
      variant?.option1 ||
      variant?.option2 ||
      variant?.option3 ||
      variant?.color ||
      variant?.colour ||
      variant?.capacity ||
      variant?.storage ||
      variant?.size ||
      variant?.shoeSize ||
      variant?.usSize
    );
  });

  if (!variants.length) return null;

  if (selectedVariantId) {
    const byId = variants.find((variant: any) => getVariantId(variant) === selectedVariantId);
    if (byId) return byId;
  }

  // Regla senior/ecommerce: NO adivinamos variantes por match parcial.
  // Si el usuario eligió Capacidad + Color, necesitamos una variante que coincida con ambas.
  // El bug del precio USD 12.495 venía de elegir una variante carísima por coincidencia parcial.
  return variants.find((variant: any) =>
    optionSelectionsMatch(extractVariantSelectedOptions(variant, product), selected)
  ) || null;
}

function isProbablyAbsoluteVariantPrice(price: number, basePrice: number) {
  if (!price || price <= 0) return false;
  if (!basePrice || basePrice <= 0) return true;

  // Si el valor se parece al precio del producto o lo supera claramente,
  // lo tratamos como precio USA absoluto de variante, no como recargo.
  return price >= basePrice * 0.5;
}

function getExplicitAbsoluteFlatPrice(variation: any) {
  return toNumber(
    variation?.priceUSD ??
      variation?.sourcePriceUSD ??
      variation?.priceAmount ??
      variation?.amountUSD,
    0
  );
}

function getExplicitSurchargeFlatPrice(variation: any) {
  return toNumber(
    variation?.surchargeUSD ?? variation?.extraUSD ?? variation?.deltaUSD,
    0
  );
}

function calculateFlatVariationSelectionPrice(
  product: ShopXProduct,
  selectedOptions?: SelectedProductOptions
): { priceUSD: number; matched: any[]; selectedOptions: SelectedProductOptions } | null {
  const rawProduct = product as any;
  const selectedEntries = Object.entries(selectedOptions || product.selectedOptions || {})
    .map(([name, value]) => [normalizeOptionName(name), cleanString(value)] as [string, string])
    .filter(([, value]) => Boolean(value));

  if (!selectedEntries.length || !Array.isArray(rawProduct?.variations)) return null;

  const flatVariations = rawProduct.variations
    .map((variation: any) => ({ raw: variation, option: getFlatVariationOption(variation) }))
    .filter((item: any) => item.option);

  if (!flatVariations.length) return null;

  const matched: any[] = [];

  for (const [selectedName, selectedValue] of selectedEntries) {
    const match = flatVariations.find((item: any) => {
      const option = item.option as { name: string; value: string };
      return (
        normalizeForCompare(option.name) === normalizeForCompare(selectedName) &&
        normalizeForCompare(option.value) === normalizeForCompare(selectedValue)
      );
    });

    if (match) matched.push(match.raw);
  }

  if (!matched.length) return null;

  const basePrice = getBaseSourcePriceUSD(product);

  // Caso multi-atributo guardado por SKU: Capacidad + Color comparten SKU.
  // Si todos los atributos seleccionados apuntan al mismo SKU, ese SKU es la variante real.
  const skuSets = selectedEntries.map(([selectedName, selectedValue]) => {
    const skus = flatVariations
      .filter((item: any) => {
        const option = item.option as { name: string; value: string };
        return (
          item.raw?.sku &&
          normalizeForCompare(option.name) === normalizeForCompare(selectedName) &&
          normalizeForCompare(option.value) === normalizeForCompare(selectedValue)
        );
      })
      .map((item: any) => cleanString(item.raw.sku))
      .filter(Boolean);

    return new Set(skus);
  });

  if (skuSets.length > 1 && skuSets.every((set) => set.size > 0)) {
    const [firstSet, ...restSets] = skuSets;
    const sharedSku = Array.from(firstSet).find((sku) => restSets.every((set) => set.has(sku)));

    if (sharedSku) {
      const skuRows = rawProduct.variations.filter((variation: any) => cleanString(variation?.sku) === sharedSku);
      const rowWithPrice = skuRows.find((variation: any) =>
        getExplicitAbsoluteFlatPrice(variation) > 0 || toNumber(variation?.price, 0) > 0
      );

      if (rowWithPrice) {
        const explicitAbsolute = getExplicitAbsoluteFlatPrice(rowWithPrice);
        const rawPrice = toNumber(rowWithPrice?.price, 0);
        const selectedPrice = explicitAbsolute > 0
          ? explicitAbsolute
          : isProbablyAbsoluteVariantPrice(rawPrice, basePrice)
            ? rawPrice
            : basePrice + rawPrice;

        return {
          priceUSD: selectedPrice,
          matched: skuRows,
          selectedOptions: Object.fromEntries(selectedEntries),
        };
      }
    }
  }

  let bestAbsolute = 0;
  let surcharge = 0;

  for (const variation of matched) {
    const explicitAbsolute = getExplicitAbsoluteFlatPrice(variation);
    const explicitSurcharge = getExplicitSurchargeFlatPrice(variation);
    const rawPrice = toNumber(variation?.price, 0);

    if (explicitAbsolute > 0) {
      bestAbsolute = Math.max(bestAbsolute, explicitAbsolute);
      continue;
    }

    if (explicitSurcharge > 0) {
      surcharge += explicitSurcharge;
      continue;
    }

    if (rawPrice > 0) {
      if (isProbablyAbsoluteVariantPrice(rawPrice, basePrice)) {
        bestAbsolute = Math.max(bestAbsolute, rawPrice);
      } else {
        surcharge += rawPrice;
      }
    }
  }

  return {
    priceUSD: bestAbsolute > 0 ? bestAbsolute + surcharge : basePrice + surcharge,
    matched,
    selectedOptions: Object.fromEntries(selectedEntries),
  };
}

export function findMatchingProductVariant(
  product: ShopXProduct,
  selectedOptions?: SelectedProductOptions
): any | null {
  return findStructuredProductVariant(product, selectedOptions);
}

export function getSelectedOptionsSummary(product: ShopXProduct): string[] {
  return Object.entries(product.selectedOptions || {})
    .filter(([, value]) => cleanString(value))
    .map(([name, value]) => `${normalizeOptionName(name)}: ${value}`);
}

export function applySelectedProductOptions(
  product: ShopXProduct,
  selectedOptions?: SelectedProductOptions
): ShopXProduct {
  const cleanSelected = selectedOptions || product.selectedOptions || {};
  const structuredVariant = findStructuredProductVariant(product, cleanSelected);
  const flatSelection = structuredVariant ? null : calculateFlatVariationSelectionPrice(product, cleanSelected);

  const structuredVariantPrice = structuredVariant ? getVariantPriceUSD(structuredVariant) : 0;
  const variantImage = structuredVariant ? getVariantImageUrl(structuredVariant) : null;
  const variantSelected = structuredVariant
    ? extractVariantSelectedOptions(structuredVariant, product)
    : flatSelection?.selectedOptions || cleanSelected;

  const flatPrimary = flatSelection?.matched?.[0];
  const selectedSourcePrice = structuredVariantPrice > 0
    ? structuredVariantPrice
    : flatSelection?.priceUSD || getBaseSourcePriceUSD(product);

  const selectedVariant: SelectedProductVariant | undefined = structuredVariant
    ? {
        id: getVariantId(structuredVariant),
        sku: cleanString(structuredVariant?.sku),
        title: getVariantTitle(structuredVariant, variantSelected),
        priceUSD: structuredVariantPrice || undefined,
        imageUrl: variantImage || undefined,
        available: structuredVariant?.available !== false,
        selectedOptions: variantSelected,
      }
    : flatSelection
      ? {
          id: cleanString(flatPrimary?.sku || flatPrimary?._id || Object.values(variantSelected).join("-")),
          sku: cleanString(flatPrimary?.sku),
          title: Object.values(variantSelected).filter(Boolean).join(" / "),
          priceUSD: selectedSourcePrice || undefined,
          imageUrl: extractImageUrl(flatPrimary?.image || flatPrimary?.imageUrl) || undefined,
          available: flatPrimary?.stock === undefined || Number(flatPrimary?.stock) > 0,
          selectedOptions: variantSelected,
        }
      : undefined;

  const selectedImage = variantImage || extractImageUrl(flatPrimary?.image || flatPrimary?.imageUrl);
  const mergedImages = selectedImage
    ? [selectedImage, ...(product.imageUrls || []), ...(product.images || [])]
    : product.imageUrls || product.images;

  // La app NO recalcula el precio final all-in localmente.
  // Solo actualiza selección/imagen y espera el desglose del backend.
  // Esto evita mostrar precios crudos de variante como si fueran precio final Argentina.
  return {
    ...product,
    selectedOptions: variantSelected,
    selectedVariant,
    selectedVariantId: selectedVariant?.id,
    priceUSD: selectedSourcePrice > 0 ? selectedSourcePrice : product.priceUSD,
    imageUrl: selectedImage || product.imageUrl,
    image: selectedImage || product.image,
    imageUrls: mergedImages,
    pricing: product.pricing,
    finalPriceUSD: product.finalPriceUSD,
    estimatedUSD: product.estimatedUSD,
  };
}

export function getProductImages(product: ShopXProduct): string[] {
  const rawProduct = product as any;
  const sourceRaw = rawProduct?.sourceRaw || {};
  const selectedVariant = rawProduct?.selectedVariant || {};

  const rawImages = [
    selectedVariant?.imageUrl,
    selectedVariant?.image,
    selectedVariant?.featuredImage,
    ...(Array.isArray(product.imageUrls) ? product.imageUrls : []),
    ...(Array.isArray(product.images) ? product.images : []),
    ...collectRawImages(rawProduct?.media),
    ...collectRawImages(sourceRaw?.images),
    ...collectRawImages(sourceRaw?.media),
    ...collectRawImages(sourceRaw?.imageDetails?.images),
    product.imageUrl,
    product.image,
  ];

  const uniqueImages: string[] = [];
  const seen = new Set<string>();

  rawImages.forEach((rawImage) => {
    const imageUrl = extractImageUrl(rawImage);
    const absoluteUrl = toAbsoluteImageUrl(String(imageUrl || "").trim());

    if (!absoluteUrl || seen.has(absoluteUrl)) return;

    seen.add(absoluteUrl);
    uniqueImages.push(absoluteUrl);
  });

  return uniqueImages;
}

export function getProductImage(product: ShopXProduct): string | null {
  return getProductImages(product)[0] || null;
}

export function getProductKey(product: ShopXProduct) {
  const selected = product.selectedOptions || {};
  const selectionKey = Object.entries(selected)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}:${value}`)
    .join("|");

  const baseKey =
    product._id ||
    product.id ||
    product.slug ||
    product.externalId ||
    product.sourceUrl ||
    product.title;

  return selectionKey ? `${baseKey}__${selectionKey}` : baseKey;
}