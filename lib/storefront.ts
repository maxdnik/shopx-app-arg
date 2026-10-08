import { getProductImages, type ShopXProduct } from "./api";
import { request } from "./request";

export function finalPriceUSD(product: ShopXProduct): number {
  // A source/USA price must never be presented as the delivered price.
  const candidates = [product.pricing?.finalUSD, product.pricing?.totalFinal, product.finalPriceUSD, product.estimatedUSD];
  return candidates.map(Number).find((price) => Number.isFinite(price) && price > 0) || 0;
}

export function storefrontPrice(product: ShopXProduct, exchangeRate?: number) {
  const usd = finalPriceUSD(product);
  if (!usd) return { text: "Ver precio", caption: "En el detalle del producto" };
  const inPesos = Number.isFinite(exchangeRate) && Number(exchangeRate) > 0;
  return {
    text: inPesos
      ? `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(usd * Number(exchangeRate))}`
      : `USD ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(usd)}`,
    caption: inPesos ? "Precio final en ARS" : "Precio final en USD",
  };
}

export function visibleStorefrontProducts(products: ShopXProduct[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    const key = product.slug || product._id || product.id;
    if (!key || seen.has(key) || product.available === false || !finalPriceUSD(product)) return false;
    if (!getProductImages(product).some((url) => !/placeholder/i.test(url))) return false;
    seen.add(key);
    return true;
  });
}

export function needsProductSelection(product: ShopXProduct) {
  return !!(product.options?.length || product.shopifyVariants?.length || product.variationMatrix?.length || product.variations?.length);
}

let collectionCache: { value: ShopXProduct[]; at: number } | undefined;
let collectionRequest: Promise<ShopXProduct[]> | undefined;
export async function getWantItProducts(force = false): Promise<ShopXProduct[]> {
  if (!force && collectionCache && Date.now() - collectionCache.at < 300000) return collectionCache.value;
  if (collectionRequest) return collectionRequest;
  collectionRequest = request<{ products: ShopXProduct[] }>("/api/app/want-it")
    .then(({ products }) => {
      if (!Array.isArray(products)) throw new Error("No pudimos cargar los productos.");
      const value = visibleStorefrontProducts(products);
      collectionCache = { value, at: Date.now() };
      return value;
    })
    .finally(() => { collectionRequest = undefined; });
  return collectionRequest;
}

export async function getStorefrontExchangeRate() {
  const data = await request<{ effectiveRate?: number; rate?: number }>("/api/exchange");
  const rate = Number(data.effectiveRate ?? data.rate);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Cotización no disponible");
  return rate;
}
