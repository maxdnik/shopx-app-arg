import { ShopXProduct } from "./api";

const productCache = new Map<string, ShopXProduct>();

export function getProductSlug(product: ShopXProduct) {
  return product.slug || product._id || product.id || product.externalId || "";
}

export function saveProductToCache(product: ShopXProduct) {
  const slug = getProductSlug(product);

  if (!slug) return;

  productCache.set(slug, product);
}

export function getProductFromCache(slug: string) {
  return productCache.get(slug) || null;
}