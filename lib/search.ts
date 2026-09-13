import { getCatalogProducts } from "./catalog";
import { request } from "./request";
// lib/search.ts
import { ShopXProduct, getDisplayFinalPriceUSD, getProductImage } from "./api";

export type SearchResult = {
  id: string;
  source: "mongo" | "ebay" | "amazon";
  title: string;
  brand?: string;
  priceUSD?: number;
  finalPriceUSD?: number;
  estimatedUSD?: number;
  image?: string | null;
  images?: string[];
  category?: string;
  condition?: string;
  seller?: string;
  url?: string;
  slug?: string;
  asin?: string;
  rating?: number;
  reviewsCount?: number;
  pricing?: {
    finalUSD?: number;
    totalFinal?: number;
    totalWeightKg?: number;
    isWeightImputed?: boolean;
    breakdown?: Array<{ label: string; amount: number }>;
  };
};

function toNumber(value: any) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const clean = value.replace(/[^0-9.,]/g, "").replace(/,/g, "");
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object") {
    return toNumber(
      value.value || value.amount || value.price || value.currentPrice,
    );
  }
  return 0;
}

function getCategoryLabel(product: ShopXProduct) {
  if (typeof product.category === "string") return product.category;
  return (
    product.category?.leaf ||
    product.category?.sub ||
    product.category?.main ||
    "Producto USA"
  );
}

function normalizeInternalProduct(product: ShopXProduct): SearchResult {
  const finalPriceUSD = getDisplayFinalPriceUSD(product);
  return {
    id: String(product._id || product.id || product.slug),
    source: "mongo",
    title: product.title,
    brand: product.brand || product.store || "SHOPX",
    priceUSD: finalPriceUSD,
    finalPriceUSD,
    estimatedUSD: product.estimatedUSD,
    pricing: product.pricing,
    image: getProductImage(product),
    images: product.images || product.imageUrls,
    category: getCategoryLabel(product),
    slug: product.slug,
    url: product.sourceUrl,
  };
}

function normalizeEbayItem(item: any): SearchResult {
  const finalPriceUSD = toNumber(
    item?.finalPriceUSD ||
      item?.estimatedUSD ||
      item?.pricing?.finalUSD ||
      item?.pricing?.totalFinal ||
      item?.totalFinalUSD ||
      item?.displayPriceUSD,
  );
  const image =
    item.image ||
    item.imageUrl ||
    item.thumbnail ||
    item?.image?.imageUrl ||
    item?.thumbnailImages?.[0]?.imageUrl ||
    null;
  return {
    id: String(
      item.id || item.itemId || item.legacyItemId || item.url || item.title,
    ),
    source: "ebay",
    title: String(item.title || "Producto eBay"),
    brand: item.brand || "eBay",
    priceUSD: finalPriceUSD,
    finalPriceUSD,
    estimatedUSD: item.estimatedUSD
      ? toNumber(item.estimatedUSD)
      : finalPriceUSD,
    pricing: item.pricing,
    image,
    images: image ? [image] : [],
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

function normalizeAmazonItem(item: any): SearchResult {
  const basePrice = toNumber(
    item.priceUSD || item.final_price || item.price || item.current_price,
  );
  const finalPrice = toNumber(
    item.finalPriceUSD ||
      item.estimatedUSD ||
      item.pricing?.finalUSD ||
      item.pricing?.totalFinal ||
      item.totalFinalUSD ||
      item.displayPriceUSD,
  );
  const image =
    item.image ||
    item.imageUrl ||
    item.thumbnail ||
    item.main_image ||
    item.images?.[0] ||
    item.image_urls?.[0] ||
    null;
  const asin = String(item.asin || item.id || "").trim();
  return {
    id: asin || String(item.url || item.title),
    asin,
    source: "amazon",
    title: String(item.title || item.name || "Producto Amazon"),
    brand: item.brand || item.store || "Amazon",
    priceUSD: basePrice,
    finalPriceUSD: finalPrice || undefined,
    estimatedUSD: finalPrice || undefined,
    image,
    images: Array.isArray(item.images) ? item.images : image ? [image] : [],
    category: item.category || "Amazon",
    condition: item.condition || "Nuevo",
    seller: item.seller,
    url:
      item.url ||
      item.sourceUrl ||
      (asin ? `https://www.amazon.com/dp/${asin}` : undefined),
    rating: toNumber(item.rating),
    reviewsCount: toNumber(
      item.reviewsCount || item.reviews_count || item.ratings_total,
    ),
    pricing: item.pricing,
  };
}

async function searchInternalProducts(query: string) {
  const data = await getCatalogProducts({ query, limit: 12 });
  return data.products.map(normalizeInternalProduct);
}
async function searchEbayProducts(query: string) {
  const data = await request<any>(
    `/api/ebay/search?query=${encodeURIComponent(query)}`,
    { timeoutMs: 60000 },
  );
  const items = data.items || data.products || data.results || [];
  return Array.isArray(items) ? items.map(normalizeEbayItem) : [];
}
async function searchAmazonProducts(query: string) {
  const data = await request<any>(
    `/api/search?query=${encodeURIComponent(query)}&limit=24`,
    { timeoutMs: 60000 },
  );
  return Array.isArray(data.products)
    ? data.products.map(normalizeAmazonItem)
    : [];
}

function takeMixed(
  amazon: SearchResult[],
  internal: SearchResult[],
  ebay: SearchResult[],
) {
  const output: SearchResult[] = [];
  const max = Math.max(amazon.length, internal.length, ebay.length);
  for (let i = 0; i < max; i += 1) {
    if (
      i < amazon.length &&
      output.filter((x) => x.source === "amazon").length < 24
    )
      output.push(amazon[i]);
    if (
      i < internal.length &&
      output.filter((x) => x.source === "mongo").length < 12
    )
      output.push(internal[i]);
    if (i < ebay.length && output.filter((x) => x.source === "ebay").length < 8)
      output.push(ebay[i]);
  }
  return output;
}

export async function searchShopX(query: string): Promise<SearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];
  const results = await Promise.allSettled([
    searchAmazonProducts(cleanQuery),
    searchInternalProducts(cleanQuery),
    searchEbayProducts(cleanQuery),
  ]);
  if (results.every((result) => result.status === "rejected"))
    throw new Error("No pudimos consultar las tiendas. Volvé a intentar.");
  const [amazon, internal, ebay] = results.map((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  return takeMixed(amazon, internal, ebay);
}
