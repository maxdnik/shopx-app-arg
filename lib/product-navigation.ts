import { router } from "expo-router";
import { ShopXProduct, getDisplayFinalPriceUSD, getProductImage } from "./api";
import { saveProductToCache } from "./product-cache";

export function getProductNavigationKey(product: ShopXProduct) {
  return (
    product.slug ||
    product._id ||
    product.id ||
    product.externalId ||
    product.sourceRaw?.itemId ||
    product.sourceRaw?.legacyItemId ||
    ""
  );
}

export function isEbayProduct(product: ShopXProduct) {
  const source = String(product.source || "").toLowerCase();
  const store = String(product.store || "").toLowerCase();
  const brand = String(product.brand || "").toLowerCase();
  const sourceUrl = String(product.sourceUrl || "").toLowerCase();

  return (
    source === "ebay" ||
    store.includes("ebay") ||
    brand.includes("ebay") ||
    sourceUrl.includes("ebay.")
  );
}

export function openShopXProduct(product: ShopXProduct) {
  const key = getProductNavigationKey(product);
  if (!key) return;

  saveProductToCache(product);

  if (isEbayProduct(product)) {
    const priceUSD =
      getDisplayFinalPriceUSD(product) ||
      product.finalPriceUSD ||
      product.estimatedUSD ||
      product.priceUSD ||
      0;
    const image = getProductImage(product) || "";

    router.push({
      pathname: "/ebay-product/[id]",
      params: {
        id: key,
        title: product.title || "Producto eBay",
        priceUSD: priceUSD ? String(priceUSD) : "",
        image,
        url: product.sourceUrl || "",
        condition: String(
          product.sourceRaw?.condition ||
            product.sourceRaw?.conditionDisplayName ||
            ""
        ),
        seller: String(
          product.sourceRaw?.seller?.username || product.sourceRaw?.seller || ""
        ),
      },
    });
    return;
  }

  router.push(`/product/${encodeURIComponent(key)}`);
}
