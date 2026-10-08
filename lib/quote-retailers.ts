// Shared client URL rules mirrored from usa-shopbox/src/lib/retailers/registry.ts.
// Pricing and provider integrations remain on the ShopX server.
export type BrightDataRetailerKey =
  | "amazon"
  | "walmart"
  | "target"
  | "bestbuy"
  | "newegg"
  | "ebay"
  | "sephora"
  | "abercrombie"
  | "hollister";

export type BrightDataRetailerDefinition = {
  key: BrightDataRetailerKey;
  store: string;
  source: BrightDataRetailerKey;
  hosts: readonly string[];
  defaultDatasetId: string;
  datasetEnv: string;
  zipcodeEnv?: string;
  zipcodeInput?: "zipcode" | "location";
};

export const BRIGHTDATA_RETAILERS: readonly BrightDataRetailerDefinition[] = [
  {
    key: "amazon",
    store: "Amazon",
    source: "amazon",
    hosts: ["amazon.com", "a.co"],
    defaultDatasetId: "gd_l7q7dkf244hwjntr0",
    datasetEnv: "BRIGHTDATA_AMAZON_DATASET_ID",
    zipcodeEnv: "BRIGHTDATA_AMAZON_ZIPCODE",
    zipcodeInput: "zipcode",
  },
  {
    key: "walmart",
    store: "Walmart",
    source: "walmart",
    hosts: ["walmart.com"],
    defaultDatasetId: "gd_l95fol7l1ru6rlo116",
    datasetEnv: "BRIGHTDATA_WALMART_DATASET_ID",
  },
  {
    key: "target",
    store: "Target",
    source: "target",
    hosts: ["target.com"],
    defaultDatasetId: "gd_ltppk5mx2lp0v1k0vo",
    datasetEnv: "BRIGHTDATA_TARGET_DATASET_ID",
    zipcodeEnv: "BRIGHTDATA_TARGET_ZIPCODE",
    zipcodeInput: "zipcode",
  },
  {
    key: "bestbuy",
    store: "Best Buy",
    source: "bestbuy",
    hosts: ["bestbuy.com"],
    defaultDatasetId: "gd_ltre1jqe1jfr7cccf",
    datasetEnv: "BRIGHTDATA_BESTBUY_DATASET_ID",
  },
  {
    key: "newegg",
    store: "Newegg",
    source: "newegg",
    hosts: ["newegg.com"],
    defaultDatasetId: "gd_mkcnpcq825jb5uiuna",
    datasetEnv: "BRIGHTDATA_NEWEGG_DATASET_ID",
  },
  {
    key: "ebay",
    store: "eBay",
    source: "ebay",
    hosts: ["ebay.com"],
    // eBay usa Browse API como fuente primaria. Estos campos se conservan para
    // mantener una definición uniforme y permitir un scraper de respaldo futuro.
    defaultDatasetId: "",
    datasetEnv: "BRIGHTDATA_EBAY_DATASET_ID",
  },
  {
    key: "sephora",
    store: "Sephora",
    source: "sephora",
    hosts: ["sephora.com"],
    defaultDatasetId: "gd_mloyjmqz1ucoikm4ja",
    datasetEnv: "BRIGHTDATA_SEPHORA_DATASET_ID",
  },
  {
    key: "abercrombie",
    store: "Abercrombie & Fitch",
    source: "abercrombie",
    hosts: ["abercrombie.com"],
    defaultDatasetId: "gd_mktlu1us1uwt60iba0",
    datasetEnv: "BRIGHTDATA_ABERCROMBIE_DATASET_ID",
  },
  {
    key: "hollister",
    store: "Hollister",
    source: "hollister",
    hosts: ["hollisterco.com"],
    defaultDatasetId: "gd_moviqcj81iickilump",
    datasetEnv: "BRIGHTDATA_HOLLISTER_DATASET_ID",
  },
] as const;

export const SUPPORTED_BRIGHTDATA_RETAILER_NAMES = BRIGHTDATA_RETAILERS.map(
  (retailer) => retailer.store,
);

export const SUPPORTED_BRIGHTDATA_RETAILERS_LABEL =
  "Amazon, eBay, Sephora, Walmart, Target, Best Buy, Newegg, Abercrombie & Fitch y Hollister";

const TRACKING_PARAM_PATTERNS = [
  /^utm_/i,
  /^ref_?/i,
  /^tag$/i,
  /^linkcode$/i,
  /^camp$/i,
  /^creative$/i,
  /^creativeasin$/i,
  /^ascsubtag$/i,
  /^th$/i,
  /^psc$/i,
  /^smid$/i,
  /^dib$/i,
  /^dib_tag$/i,
  /^keywords$/i,
  /^qid$/i,
  /^sr$/i,
  /^sprefix$/i,
  /^athbdg$/i,
  /^athancid$/i,
  /^adsredirect$/i,
  /^irclickid$/i,
  /^irgwc$/i,
  /^ac$/i,
  /^loc$/i,
  /^storeid$/i,
  /^clkid$/i,
  /^cmp$/i,
  /^aff$/i,
  /^affid$/i,
  /^source$/i,
  /^gclid$/i,
  /^dclid$/i,
  /^gbraid$/i,
  /^wbraid$/i,
  /^icid/i,
  /^om_/i,
];

function withProtocol(value: string): string {
  const clean = String(value || "").trim();
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

function hostMatches(host: string, allowedHost: string): boolean {
  return host === allowedHost || host.endsWith(`.${allowedHost}`);
}

function normalizedProductId(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function uniqueProductIds(values: unknown[]): string[] {
  return Array.from(
    new Set(values.map(normalizedProductId).filter((value) => value.length >= 5)),
  );
}

export function extractAmazonAsin(value: string): string {
  return (
    String(value || "").match(
      /\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})(?:[/?]|$)/i,
    )?.[1]?.toUpperCase() || ""
  );
}

export function extractEbayLegacyItemId(value: string): string {
  try {
    const parsed = new URL(withProtocol(value));
    return (
      parsed.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{8,})(?:[/?]|$)/i)?.[1] ||
      parsed.searchParams.get("item") ||
      parsed.searchParams.get("itemId") ||
      parsed.searchParams.get("item_id") ||
      ""
    );
  } catch {
    return String(value || "").match(/(?:^|\D)(\d{8,})(?:\D|$)/)?.[1] || "";
  }
}

export function extractSephoraProductIds(value: string): string[] {
  try {
    const parsed = new URL(withProtocol(value));
    const pathProductId =
      parsed.pathname.match(/(?:^|[-/])(P\d+)(?:[/?#]|$)/i)?.[1] || "";
    return uniqueProductIds([
      parsed.searchParams.get("skuId"),
      parsed.searchParams.get("sku"),
      parsed.searchParams.get("sku_id"),
      parsed.searchParams.get("item_id"),
      parsed.searchParams.get("variant_id"),
      parsed.searchParams.get("productId"),
      pathProductId,
    ]);
  } catch {
    return uniqueProductIds([
      String(value || "").match(/(?:^|\D)(\d{5,})(?:\D|$)/)?.[1],
      String(value || "").match(/(?:^|\D)(P\d+)(?:\D|$)/i)?.[1],
    ]);
  }
}

function extractAnfPageProductId(value: string): string {
  try {
    const parsed = new URL(withProtocol(value));
    return (
      parsed.pathname.match(/\/p\/[^/?#]*-(\d{6,})(?:[/?#]|$)/i)?.[1] ||
      parsed.searchParams.get("itemId") ||
      parsed.searchParams.get("productId") ||
      ""
    );
  } catch {
    return String(value || "").match(/-(\d{6,})(?:[/?#]|$)/)?.[1] || "";
  }
}

export function detectBrightDataRetailer(
  value: string,
): BrightDataRetailerDefinition | null {
  try {
    const host = new URL(withProtocol(value)).hostname
      .toLowerCase()
      .replace(/\.$/, "");
    return (
      BRIGHTDATA_RETAILERS.find((retailer) =>
        retailer.hosts.some((allowedHost) => hostMatches(host, allowedHost)),
      ) || null
    );
  } catch {
    return null;
  }
}

export function retailerDefinitionFromKey(
  key: BrightDataRetailerKey,
): BrightDataRetailerDefinition {
  const retailer = BRIGHTDATA_RETAILERS.find((item) => item.key === key);
  if (!retailer) throw new Error(`Unsupported Bright Data retailer: ${key}`);
  return retailer;
}

export function isSupportedBrightDataRetailerUrl(value: string): boolean {
  return Boolean(detectBrightDataRetailer(value));
}

export function normalizeRetailerUrl(value: string): string {
  const parsed = new URL(withProtocol(value));
  const retailer = detectBrightDataRetailer(parsed.toString());
  parsed.protocol = "https:";
  parsed.hash = "";

  if (retailer?.key === "amazon") {
    const asin = extractAmazonAsin(parsed.toString());
    if (asin) return `https://www.amazon.com/dp/${asin}`;
  }

  if (retailer?.key === "ebay") {
    const itemId = extractEbayLegacyItemId(parsed.toString());
    if (itemId) {
      const variationId =
        parsed.searchParams.get("var") ||
        parsed.searchParams.get("variation_id") ||
        parsed.searchParams.get("legacy_variation_id");
      const canonical = new URL(`https://www.ebay.com/itm/${itemId}`);
      if (variationId) canonical.searchParams.set("var", variationId);
      return canonical.toString();
    }
  }

  if (retailer?.key === "sephora") {
    const productIds = extractSephoraProductIds(parsed.toString());
    if (productIds.length) {
      const canonicalPath = parsed.pathname.replace(/\/+$/, "") || "/";
      const canonical = new URL(`https://www.sephora.com${canonicalPath}`);
      const skuId =
        parsed.searchParams.get("skuId") ||
        parsed.searchParams.get("sku") ||
        parsed.searchParams.get("sku_id") ||
        parsed.searchParams.get("item_id") ||
        parsed.searchParams.get("variant_id");
      if (skuId) canonical.searchParams.set("skuId", skuId);
      return canonical.toString();
    }
  }

  for (const key of Array.from(parsed.searchParams.keys())) {
    if (
      key.toLowerCase() === "quantity" ||
      key.toLowerCase() === "qty" ||
      TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(key))
    ) {
      parsed.searchParams.delete(key);
    }
  }

  parsed.searchParams.sort();
  return parsed.toString();
}

/**
 * Extrae los identificadores que deben vincular inequívocamente una URL de PDP
 * con la ficha devuelta por Bright Data. En Target, `preselect` va primero
 * porque representa la variante elegida; el A-ID queda como identidad padre.
 */
export function retailerProductIdsFromUrl(value: string): string[] {
  try {
    const parsed = new URL(withProtocol(value));
    const retailer = detectBrightDataRetailer(parsed.toString());
    if (!retailer) return [];

    switch (retailer.key) {
      case "amazon":
        return uniqueProductIds([extractAmazonAsin(parsed.toString())]);

      case "ebay":
        return uniqueProductIds([extractEbayLegacyItemId(parsed.toString())]);

      case "sephora":
        return extractSephoraProductIds(parsed.toString());

      case "abercrombie":
      case "hollister":
        return uniqueProductIds([extractAnfPageProductId(parsed.toString())]);

      case "walmart": {
        const segments = parsed.pathname.split("/").filter(Boolean);
        const ipIndex = segments.findIndex((segment) => segment.toLowerCase() === "ip");
        const id =
          ipIndex >= 0
            ? [...segments.slice(ipIndex + 1)]
                .reverse()
                .find((segment) => /^\d{5,}$/.test(segment))
            : undefined;
        return uniqueProductIds([id, parsed.searchParams.get("itemId")]);
      }

      case "target": {
        const parentId = parsed.pathname.match(/\/A-(\d{5,})(?:[/?]|$)/i)?.[1];
        return uniqueProductIds([
          parsed.searchParams.get("preselect"),
          parsed.searchParams.get("tcin"),
          parentId,
        ]);
      }

      case "bestbuy": {
        const segments = parsed.pathname.split("/").filter(Boolean);
        const pathId = [...segments]
          .reverse()
          .map((segment) => segment.replace(/\.p$/i, ""))
          .find((segment) => /^\d{5,}$/.test(segment));
        return uniqueProductIds([
          parsed.searchParams.get("skuId"),
          parsed.searchParams.get("sku"),
          pathId,
        ]);
      }

      case "newegg": {
        const productCode = parsed.pathname.match(/\/p\/([A-Z0-9-]{8,})(?:[/?]|$)/i)?.[1];
        return uniqueProductIds([
          parsed.searchParams.get("Item"),
          parsed.searchParams.get("item"),
          productCode,
        ]);
      }
    }
  } catch {
    return [];
  }
}

export function retailerProductMatchesUrl(
  requestedUrl: string,
  productId: unknown,
  returnedUrl?: string,
): boolean {
  const requestedRetailer = detectBrightDataRetailer(requestedUrl)?.key;
  if (!requestedRetailer) return false;

  const expectedIds = retailerProductIdsFromUrl(requestedUrl);
  const candidateIds = uniqueProductIds([
    productId,
    ...(returnedUrl ? retailerProductIdsFromUrl(returnedUrl) : []),
  ]);

  if (requestedRetailer === "ebay") {
    if (!expectedIds.length || !candidateIds.includes(expectedIds[0])) {
      return false;
    }
    try {
      const requestedVariation = new URL(withProtocol(requestedUrl)).searchParams.get(
        "var",
      );
      if (!requestedVariation) return true;
      if (!returnedUrl) return false;
      const returnedVariation = new URL(withProtocol(returnedUrl)).searchParams.get(
        "var",
      );
      return returnedVariation === requestedVariation;
    } catch {
      return false;
    }
  }

  // El primer ID representa la selección efectiva del usuario. Para Target es
  // `preselect` cuando existe; aceptar sólo el A-ID padre podría cambiar talle,
  // color o capacidad sin que el comprador lo advierta.
  if (expectedIds.length && candidateIds.length) {
    return candidateIds.includes(expectedIds[0]);
  }

  if (!returnedUrl) return false;
  const returnedRetailer = detectBrightDataRetailer(returnedUrl)?.key;
  if (returnedRetailer !== requestedRetailer) return false;

  try {
    return normalizeRetailerUrl(requestedUrl) === normalizeRetailerUrl(returnedUrl);
  } catch {
    return false;
  }
}

export function retailerProductKey(value: string): string {
  try {
    const normalized = new URL(normalizeRetailerUrl(value));
    const retailer = detectBrightDataRetailer(normalized.toString());
    const productIds = retailerProductIdsFromUrl(normalized.toString());
    if (retailer && productIds.length) {
      if (retailer.key === "ebay") {
        const variation = normalized.searchParams.get("var");
        return `${retailer.key}:${productIds[0]}:${variation || "default"}`;
      }
      return `${retailer.key}:${productIds[0]}`;
    }
    return `${retailer?.key || normalized.hostname.toLowerCase()}:${normalized.hostname
      .toLowerCase()
      .replace(/^www\./, "")}${normalized.pathname.replace(/\/$/, "")}${
      normalized.search
    }`;
  } catch {
    return String(value || "").trim().toLowerCase();
  }
}

export function storeNameForUrl(value: string): string {
  return detectBrightDataRetailer(value)?.store || "Tienda USA";
}

