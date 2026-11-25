import { request } from "./request";

/** Server-owned dated comparison. These amounts never become a checkout input. */
export type Opportunity = {
  id: string;
  comparisonKey: string;
  title: string;
  model: string;
  variant: string;
  brand: string;
  category: string;
  image: string | null;
  argentinaPriceArs: number;
  shopxPriceArs: number;
  argentinaStore: string;
  argentinaPayment: string;
  argentinaUrl: string;
  quotedAt: string;
  sourceUrl: string;
};
export type OpportunitySort = "destacadas" | "ahorro" | "porcentaje" | "precio";
export type OpportunitiesPage = {
  items: Opportunity[];
  total: number;
  page: number;
  pageCount: number;
  categories: string[];
  observedDate: string;
};

export function opportunitySourceUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["amazon.com", "www.amazon.com", "ebay.com", "www.ebay.com"].includes(url.hostname)) return url.href;
  } catch { /* Invalid references cannot initiate a quote. */ }
  return undefined;
}

export function validOpportunity(item: Opportunity): boolean {
  return !!item.id && !!item.title && !!opportunitySourceUrl(item.sourceUrl) &&
    Number.isFinite(item.shopxPriceArs) && item.shopxPriceArs > 0 &&
    Number.isFinite(item.argentinaPriceArs) && item.argentinaPriceArs > item.shopxPriceArs &&
    Number.isFinite(Date.parse(item.quotedAt));
}

export function opportunityQuoteParams(item: Opportunity) {
  const url = opportunitySourceUrl(item.sourceUrl);
  if (!url || !validOpportunity(item)) throw new Error("Esta oportunidad no está disponible.");
  // Do not copy historical prices, savings or comparison metadata into the cart.
  return { url };
}

export async function getOpportunities(
  filters: { query?: string; category?: string; sort?: OpportunitySort; page?: number; home?: boolean } = {},
  signal?: AbortSignal,
): Promise<OpportunitiesPage> {
  const params = new URLSearchParams();
  if (filters.home) params.set("home", "1");
  if (filters.query?.trim()) params.set("q", filters.query.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.page) params.set("page", String(filters.page));
  const data = await request<OpportunitiesPage>(`/api/app/opportunities?${params}`, { signal });
  if (!Array.isArray(data.items) || !Array.isArray(data.categories)) throw new Error("No pudimos cargar las oportunidades.");
  return { ...data, items: data.items.filter(validOpportunity) };
}
