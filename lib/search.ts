import { request } from "./request";

export type CatalogOffer = {
  id: string;
  source: "shopx" | "amazon" | "ebay" | "walmart" | "other";
  sourceId: string;
  sourceUrl?: string;
  slug?: string;
  title?: string;
  imageUrl?: string;
  store: string;
  condition: string;
  priceUSD: number;
  finalPriceUSD: number;
  available: boolean;
  importability: "eligible" | "review" | "blocked" | "unknown";
  freightRequiresReview?: boolean;
  hasVariants?: boolean;
};
export type CatalogProduct = {
  id: string;
  slug: string;
  officialProductSlug?: string;
  title: string;
  shortTitle: string;
  brand?: string;
  images: string[];
  rating?: number;
  reviewsCount?: number;
  offers: CatalogOffer[];
  offerCount: number;
  minFinalPriceUSD: number;
  bestOffer: CatalogOffer;
};
export type FacetValue = { value: string; count: number };
export type CatalogFacets = {
  brands: FacetValue[];
  stores: FacetValue[];
  sources: FacetValue[];
  conditions: FacetValue[];
  importability: FacetValue[];
  price: { min: number; max: number } | null;
};
export type DynamicFacet = { key: string; label: string; values: FacetValue[] };
export type SearchFilters = {
  brand?: string;
  store?: string;
  source?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  attributes?: Record<string, string>;
  sort?: "relevant" | "price-asc" | "price-desc" | "rating";
};
export type CatalogSearchPage = {
  products: CatalogProduct[];
  total: number;
  cursor: string | null;
  facets: CatalogFacets;
  dynamicFacets: DynamicFacet[];
};
export const EMPTY_SEARCH_FACETS: CatalogFacets = { brands: [], stores: [], sources: [], conditions: [], importability: [], price: null };
export const CONDITION_LABELS: Record<string, string> = { new: "Nuevo", open_box: "Open box", refurbished: "Reacondicionado", used: "Usado" };

export function catalogSearchParams(query: string, filters: SearchFilters = {}, cursor?: string | null) {
  const params = new URLSearchParams({ q: query.trim(), limit: "24", sort: filters.sort || "relevant" });
  for (const key of ["brand", "store", "source", "condition"] as const) if (filters[key]) params.set(key, filters[key]!);
  // Same default product intent as the web catalog.
  if (!filters.brand && /\b(iphone|macbook|airpods)\b/i.test(query)) params.set("brand", "Apple");
  for (const key of ["minPrice", "maxPrice"] as const) {
    const value = filters[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) params.set(key, String(Math.round(value)));
  }
  for (const [key, value] of Object.entries(filters.attributes || {})) if (value) params.set(`attr.${key}`, value);
  if (cursor) params.set("cursor", cursor);
  return params;
}

/** Prices, ranking, stock and grouping come from the same engine used by the website. */
export async function searchCatalog(query: string, filters: SearchFilters = {}, cursor?: string | null, signal?: AbortSignal): Promise<CatalogSearchPage> {
  const data = await request<CatalogSearchPage>(`/api/search/v2?${catalogSearchParams(query, filters, cursor)}`, { signal, timeoutMs: 185000 });
  if (!Array.isArray(data.products)) throw new Error("No pudimos completar la búsqueda.");
  return { ...data, facets: data.facets || EMPTY_SEARCH_FACETS, dynamicFacets: data.dynamicFacets || [], cursor: data.cursor || null };
}

export function mergeCatalogPages(previous: CatalogProduct[], next: CatalogProduct[]) {
  const seen = new Set(previous.map(product => product.id));
  return [...previous, ...next.filter(product => { if (seen.has(product.id)) return false; seen.add(product.id); return true; })];
}

export function catalogOfferTarget(product: CatalogProduct, offer: CatalogOffer) {
  if (offer.available === false || offer.importability === "blocked") return null;
  if (offer.source === "shopx") {
    const id = product.officialProductSlug || offer.slug;
    return id ? { pathname: "/product/[id]" as const, params: { id } } : null;
  }
  if (!offer.sourceUrl) return null;
  let url: URL;
  try { url = new URL(offer.sourceUrl); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  if (offer.source === "amazon" || offer.source === "ebay") return {
    pathname: "/external-product/[id]" as const,
    params: {
      id: offer.sourceId, source: offer.source, url: url.href,
      title: offer.title || product.title, brand: product.brand || offer.store,
      image: offer.imageUrl || product.images[0] || "", condition: CONDITION_LABELS[offer.condition] || offer.condition,
      rating: String(product.rating || ""), reviewsCount: String(product.reviewsCount || ""),
    },
  };
  return { pathname: "/quote" as const, params: { url: url.href } };
}
