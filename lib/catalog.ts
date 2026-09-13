import type { ShopXProduct } from "./api";
import { request } from "./request";

export type CatalogCategory = {
  key: string;
  label: string;
  count: number;
  image: string;
  subcategories: { key: string; label: string; count: number }[];
};
export type CatalogPage = {
  products: ShopXProduct[];
  pagination: { page: number; total: number; hasMore: boolean };
};
export type HomeContent = {
  sections: Record<string, ShopXProduct[]>;
  weeklyProducts?: ShopXProduct[];
};
let homeCache: { value: HomeContent; at: number } | undefined;
let homeRequest: Promise<HomeContent> | undefined;
export async function getHomeContent(force = false): Promise<HomeContent> {
  if (!force && homeCache && Date.now() - homeCache.at < 300000)
    return homeCache.value;
  if (homeRequest) return homeRequest;
  homeRequest = request<HomeContent>("/api/app/home-sections")
    .then((value) => {
      homeCache = { value, at: Date.now() };
      return value;
    })
    .finally(() => {
      homeRequest = undefined;
    });
  return homeRequest;
}
export async function getCatalogNavigation() {
  return (
    await request<{ categories: CatalogCategory[] }>(
      "/api/app/catalog-navigation",
    )
  ).categories;
}
export function getCatalogProducts(filters: {
  category?: string;
  subcategory?: string;
  audience?: string;
  query?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams({
    limit: "24",
    seed: "shopx-mobile",
    ...Object.fromEntries(
      Object.entries(filters)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => [key, String(value)]),
    ),
  });
  return request<CatalogPage>(`/api/app/catalog-products?${query}`);
}
