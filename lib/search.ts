// lib/search.ts
import {
  ShopXProduct,
  getDisplayFinalPriceUSD,
  getProductImage,
  searchProducts,
} from "./api";
import { buildApiUrl } from "./config";

export type SearchResult = {
  id: string;
  source: "mongo" | "ebay";
  title: string;
  brand?: string;
  priceUSD?: number;
  finalPriceUSD?: number;
  estimatedUSD?: number;
  image?: string | null;
  category?: string;
  condition?: string;
  seller?: string;
  url?: string;
  slug?: string;
  pricing?: {
    finalUSD?: number;
    totalFinal?: number;
    totalWeightKg?: number;
    isWeightImputed?: boolean;
    breakdown?: Array<{
      label: string;
      amount: number;
    }>;
  };
};

function toNumber(value: any) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const clean = value.replace(/[^0-9.,]/g, "").replace(",", ".");
    const numberValue = Number(clean);

    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  if (value && typeof value === "object") {
    const possibleValue =
      value.value ||
      value.amount ||
      value.price ||
      value.currentPrice ||
      value.convertedFromValue;

    return toNumber(possibleValue);
  }

  return 0;
}

function getCategoryLabel(product: ShopXProduct) {
  if (typeof product.category === "string") {
    return product.category;
  }

  return (
    product.category?.leaf ||
    product.category?.sub ||
    product.category?.main ||
    "Producto USA"
  );
}

function getEbayFinalPriceUSD(item: any) {
  const finalPrice =
    item?.finalPriceUSD ||
    item?.estimatedUSD ||
    item?.pricing?.finalUSD ||
    item?.pricing?.totalFinal ||
    item?.totalFinalUSD ||
    item?.displayPriceUSD ||
    item?.priceUSD ||
    item?.price ||
    0;

  return toNumber(finalPrice);
}

function normalizeInternalProduct(product: ShopXProduct): SearchResult {
  const finalPriceUSD = getDisplayFinalPriceUSD(product);

  return {
    id: String(product._id || product.id || product.slug),
    source: "mongo",
    title: product.title,
    brand: product.brand || product.store || "SHOPX",

    // En SearchResult, priceUSD queda como compatibilidad,
    // pero siempre cargado con precio final Argentina.
    priceUSD: finalPriceUSD,
    finalPriceUSD,
    estimatedUSD: product.estimatedUSD,
    pricing: product.pricing,

    image: getProductImage(product),
    category: getCategoryLabel(product),
    slug: product.slug,
    url: product.sourceUrl,
  };
}

function normalizeEbayItem(item: any): SearchResult {
  const finalPriceUSD = getEbayFinalPriceUSD(item);

  return {
    id: String(item.id || item.itemId || item.legacyItemId || item.url || item.title),
    source: "ebay",
    title: String(item.title || "Producto eBay"),
    brand: item.brand || "eBay",

    // En SearchResult, priceUSD queda como compatibilidad,
    // pero siempre intentamos cargarlo con precio final Argentina si la API lo trae.
    priceUSD: finalPriceUSD,
    finalPriceUSD,
    estimatedUSD: item.estimatedUSD ? toNumber(item.estimatedUSD) : finalPriceUSD,
    pricing: item.pricing,

    image:
      item.image ||
      item.imageUrl ||
      item.thumbnail ||
      item?.image?.imageUrl ||
      item?.thumbnailImages?.[0]?.imageUrl ||
      null,

    category: item.category || item.condition || "Producto eBay",
    condition: item.condition,
    seller:
      item.seller ||
      item.sellerUsername ||
      item?.seller?.username ||
      item?.seller?.sellerUsername,
    url: item.url || item.itemWebUrl || item.sourceUrl,
  };
}

async function searchInternalProducts(query: string) {
  try {
    const products = await searchProducts(query);

    return products.map(normalizeInternalProduct);
  } catch (error) {
    console.log("ERROR INTERNAL SEARCH:", error);

    try {
      const response = await fetch(
        buildApiUrl(`/api/products?search=${encodeURIComponent(query)}`)
      );

      if (!response.ok) return [];

      const data = await response.json();

      if (!Array.isArray(data.products)) return [];

      return data.products.map(normalizeInternalProduct);
    } catch (fallbackError) {
      console.log("ERROR INTERNAL SEARCH FALLBACK:", fallbackError);
      return [];
    }
  }
}

async function searchEbayProducts(query: string) {
  try {
    const response = await fetch(
      buildApiUrl(`/api/ebay/search?query=${encodeURIComponent(query)}`)
    );

    if (!response.ok) return [];

    const data = await response.json();

    const items =
      data.items ||
      data.products ||
      data.results ||
      data.ebayItems ||
      [];

    if (!Array.isArray(items)) return [];

    return items.map(normalizeEbayItem);
  } catch (error) {
    console.log("ERROR EBAY SEARCH:", error);
    return [];
  }
}

export async function searchShopX(query: string): Promise<SearchResult[]> {
  const cleanQuery = query.trim();

  if (!cleanQuery) return [];

  const [internalResults, ebayResults] = await Promise.all([
    searchInternalProducts(cleanQuery),
    searchEbayProducts(cleanQuery),
  ]);

  return [...internalResults, ...ebayResults];
}