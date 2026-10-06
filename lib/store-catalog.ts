import type { ShopXProduct } from "./api";
import type { ShopXStore } from "./stores";
import { request } from "./request";

export type StoreCatalogPage = {
  store: ShopXStore;
  products: ShopXProduct[];
  categories: { label: string; count: number }[];
  totalProducts: number;
  pagination: { page: number; total: number; totalPages: number; hasMore: boolean };
};

export function getStoreCatalog(slug: string, category = "", page = 1) {
  const query = new URLSearchParams({ page: String(page), limit: "24" });
  if (category) query.set("category", category);
  return request<StoreCatalogPage>(`/api/app/stores/${encodeURIComponent(slug)}/products?${query}`);
}

export function productCategoryLabel(product: ShopXProduct): string {
  if (product.categoryLabel?.trim()) return product.categoryLabel.trim();
  const category = product.category;
  const values = typeof category === "string" ? [category] : [category?.leaf, category?.sub, category?.main];
  return values.find(value => typeof value === "string" && value.trim())?.trim() || "General";
}

export function mergeCatalogPages(current: ShopXProduct[], incoming: ShopXProduct[]) {
  const key = (item: ShopXProduct) => item._id || item.id || item.slug;
  const seen = new Set(current.map(key));
  return [...current, ...incoming.filter(item => { const id = key(item); if (!id || seen.has(id)) return false; seen.add(id); return true; })];
}
