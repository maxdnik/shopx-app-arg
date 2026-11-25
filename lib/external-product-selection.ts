import { retailerProductIdsFromUrl, retailerProductKey } from "./quote-retailers";

export type AmazonSelection = {
  url?: string;
  sku?: string;
  selections: Record<string, string>;
};

function amazonUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && ["amazon.com", "www.amazon.com"].includes(url.hostname) ? url.href : "";
  } catch { return ""; }
}

function variationAsin(variation: AmazonSelection) {
  const sku = /^[A-Z0-9]{10}$/.test(variation.sku || "") ? variation.sku : "";
  const url = variation.url ? amazonUrl(variation.url) : "";
  if (variation.url && !url) return "";
  const urlAsin = url ? retailerProductIdsFromUrl(url)[0] : "";
  if (sku && urlAsin && sku !== urlAsin) return "";
  return urlAsin || sku || "";
}

/** The initial selection must be the requested product, never the first swatch. */
export function initialAmazonSelection(variations: AmazonSelection[], sourceUrl: string): Record<string, string> {
  const asin = retailerProductIdsFromUrl(sourceUrl)[0];
  if (!asin) return {};
  const matches = variations.filter(variation => variationAsin(variation) === asin);
  if (matches.length === 1) return { ...matches[0].selections };
  const exact = matches.filter(variation => variation.url && retailerProductKey(variation.url) === retailerProductKey(sourceUrl));
  return exact.length === 1 ? { ...exact[0].selections } : {};
}

/** Variant metadata commonly drops merchant selectors. Keep the exact requested
 * offer when its ASIN is selected; another ASIN requires an explicit selection. */
export function amazonSelectionUrl(sourceUrl: string, variation?: AmazonSelection): string {
  const original = amazonUrl(sourceUrl);
  if (!original) return "";
  if (!variation) return original;
  const asin = variationAsin(variation);
  if (!asin) return "";
  if (retailerProductIdsFromUrl(original)[0] === asin) return original;
  return variation.url ? amazonUrl(variation.url) : `https://www.amazon.com/dp/${asin}`;
}
