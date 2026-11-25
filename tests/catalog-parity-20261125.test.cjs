/* global __dirname */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} }; cache.set(filename, module.exports);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", code)(id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith(".")) return load(path.relative(path.resolve(__dirname, ".."), path.resolve(path.dirname(filename), id)) + ".ts", mocks, cache);
    return require(id);
  }, module, module.exports);
  return module.exports;
}

test("Amazon offer identity preserves seller/variant selectors through quoting and quantity changes", () => {
  const quote = load("lib/quote-basket.ts", { "./request": {} });
  const registry = load("lib/quote-retailers.ts");
  const first = "https://www.amazon.com/dp/B012345678?smid=SELLER_A&offerListingId=OFFER_A&color=Blue&tag=affiliate";
  const canonical = quote.canonicalQuoteUrl(first);
  const url = new URL(canonical);
  assert.equal(url.searchParams.get("smid"), "SELLER_A");
  assert.equal(url.searchParams.get("offerListingId"), "OFFER_A");
  assert.equal(url.searchParams.get("color"), "Blue");
  assert.equal(url.searchParams.has("tag"), false);
  assert.notEqual(registry.retailerProductKey(first), registry.retailerProductKey(first.replace("SELLER_A", "SELLER_B")));
  assert.equal(registry.retailerProductKey(first), registry.retailerProductKey(quote.withQuantity(first, 2)));
});

test("Walmart merchant context, eBay shared item ids and BestBuy open-box identity match current web", () => {
  const registry = load("lib/quote-retailers.ts");
  const walmart = registry.normalizeRetailerUrl("https://www.walmart.com/ip/item/123456789?selectedSellerId=14&smid=SHOP_A&loc=12345&storeid=99&utm_source=ad");
  assert.equal(new URL(walmart).searchParams.get("smid"), "SHOP_A");
  assert.equal(new URL(walmart).searchParams.get("storeid"), "99");
  assert.notEqual(registry.retailerProductKey(walmart), registry.retailerProductKey(walmart.replace("SHOP_A", "SHOP_B")));
  assert.deepEqual(registry.retailerProductIdsFromUrl("https://www.ebay.com/itm/?iid=123456789012"), ["123456789012"]);
  assert.deepEqual(registry.retailerProductIdsFromUrl("https://www.bestbuy.com/site/item/6302559.p?openBox=true"), []);
});

test("Assistance includes only eligible failed links and never silently redirects Amazon", () => {
  const quote = load("lib/quote-basket.ts", { "./request": {} });
  const amazon = "https://www.amazon.com/dp/B012345678";
  const bestbuy = "https://www.bestbuy.com/site/item/6302559.p";
  const walmart = "https://www.walmart.com/ip/item/123456789";
  assert.deepEqual(quote.assistedRetailerLinks([amazon, bestbuy, walmart], [
    { url: amazon, reason: "not_found" }, { url: bestbuy, reason: "not_found" }, { url: walmart, reason: "unavailable" },
  ]), [bestbuy]);
  assert.equal(quote.shouldRouteToManualQuote([amazon], "No pudimos leer el producto"), false);
});

test("Cart conversion associates quote items by offer identity rather than array position", () => {
  const quote = load("lib/quote-basket.ts", { "./request": {} });
  const a = "https://www.amazon.com/dp/B012345678?smid=A";
  const b = "https://www.amazon.com/dp/B012345678?smid=B";
  const values = quote.basketCartProducts({
    products: [{ id: "a", sourceUrl: a, title: "First", selectedColor: "Blue" }, { id: "b", sourceUrl: b, title: "Second", selectedColor: "Red" }],
    cartItems: [{ id: "b", sourceUrl: b, quantity: 2, priceUSD: 22, pricing: { finalUSD: 100 } }, { id: "a", sourceUrl: a, quantity: 1, priceUSD: 15 }],
  });
  assert.equal(values[0].product.title, "Second");
  assert.deepEqual(values[0].product.selectedOptions, { Color: "Red" });
  assert.equal(values[0].quantity, 2);
  assert.equal(values[0].product.pricing, undefined);
  assert.equal(values[1].product.title, "First");
});

test("Same ASIN from different merchants stays separate and settlement removes only the purchased offer", async () => {
  const stored = new Map();
  const storage = { getItem: async key => stored.get(key) || null, setItem: async (key, value) => stored.set(key, value) };
  const cart = load("lib/cart-store.ts", { "@react-native-async-storage/async-storage": { __esModule: true, default: storage } });
  const first = { id: "amazon:B012345678", slug: "", title: "Example", sourceUrl: "https://www.amazon.com/dp/B012345678?smid=A" };
  const second = { ...first, sourceUrl: "https://www.amazon.com/dp/B012345678?smid=B" };
  await cart.addProductToCart(first);
  await cart.addProductToCart(second);
  assert.equal((await cart.getCartItems()).length, 2);
  assert.notEqual(cart.getProductKey(first), cart.getProductKey(second));
  assert.equal(cart.getProductKey(first), cart.getProductKey({ ...first, sourceUrl: first.sourceUrl + "&quantity=2&utm_campaign=test" }));
  await cart.updateCartItemQuantity(first, 2);
  const items = await cart.getCartItems();
  assert.deepEqual(items.map(item => item.quantity), [2, 1]);
  await cart.settlePurchasedItems([{ productId: first.id, sourceUrl: first.sourceUrl, quantity: 1 }], "checkout-A");
  const remaining = await cart.getCartItems();
  assert.deepEqual(remaining.map(item => item.quantity), [1, 1]);
  assert.equal(remaining[1].product.sourceUrl, second.sourceUrl);
  await cart.settlePurchasedItems([{ productId: first.id, sourceUrl: first.sourceUrl, quantity: 1 }], "checkout-A");
  assert.deepEqual((await cart.getCartItems()).map(item => item.quantity), [1, 1]);
  assert.equal(cart.getProductKey({ ...first, _id: "abcdef0123456789abcdef01", slug: "native-product" }), "native-product");
});

test("Delivery notices distinguish confirmed zero-cost shipping from unknown shipping", () => {
  const { productDeliveryNotice } = load("lib/quote-basket.ts", { "./request": {} });
  assert.match(productDeliveryNotice({ usOriginShipping: { status: "confirmed", amountUSD: 0 } }), /gratis/);
  assert.equal(productDeliveryNotice({ usOriginShipping: { status: "unknown" } }), undefined);
  assert.match(productDeliveryNotice({ purchaseDestination: { status: "shipping_to_other_zip", requestedPostalCode: "33166", observedPostalCode: "10001" } }), /Falta confirmar/);
});

test("Amazon detail starts on the requested ASIN and keeps its exact merchant and offer", () => {
  const { initialAmazonSelection, amazonSelectionUrl } = load("lib/external-product-selection.ts");
  const source = "https://www.amazon.com/dp/B012345678?smid=SELLER_A&offerListingId=OFFER_A";
  const other = { sku: "B012345679", selections: { Color: "Red" } };
  const selected = { sku: "B012345678", url: "https://www.amazon.com/dp/B012345678", selections: { Color: "Blue" } };
  assert.deepEqual(initialAmazonSelection([other, selected], source), { Color: "Blue" });
  assert.deepEqual(initialAmazonSelection([other], source), {});
  assert.equal(amazonSelectionUrl(source, selected), source);
  assert.equal(amazonSelectionUrl(source, other), "https://www.amazon.com/dp/B012345679");
  assert.equal(amazonSelectionUrl(source, { ...selected, url: "https://www.amazon.com/dp/B012345679" }), "");
  assert.equal(amazonSelectionUrl(source, { ...selected, url: "https://amazon.com.evil.test/dp/B012345678" }), "");
});

test("Search sends current server filters and cursor in one request with cancellation", async () => {
  let call;
  const search = load("lib/search.ts", { "./request": { request: async (url, options) => { call = { url, options }; return { products: [], total: 0, cursor: null }; } } });
  const signal = new AbortController().signal;
  const result = await search.searchCatalog("  iphone 17  ", { store: "Amazon", source: "amazon", condition: "new", minPrice: 10, maxPrice: 1200, sort: "price-asc", attributes: { capacity: "256 GB" } }, "NEXT_CURSOR", signal);
  const url = new URL(call.url, "https://shopx.test");
  assert.equal(url.pathname, "/api/search/v2");
  assert.equal(url.searchParams.get("q"), "iphone 17");
  assert.equal(url.searchParams.get("brand"), "Apple");
  assert.equal(url.searchParams.get("attr.capacity"), "256 GB");
  assert.equal(url.searchParams.get("cursor"), "NEXT_CURSOR");
  assert.equal(url.searchParams.get("maxPrice"), "1200");
  assert.equal(call.options.signal, signal);
  assert.equal(call.options.timeoutMs, 185000);
  assert.deepEqual(result.dynamicFacets, []);
});

test("Search routes the selected offer exactly, blocks unavailable ones and never forwards price guesses", () => {
  const { catalogOfferTarget } = load("lib/search.ts", { "./request": {} });
  const product = { title: "Product", slug: "canonical-title", images: [], minFinalPriceUSD: 100 };
  const offer = { source: "amazon", sourceId: "B012345678", sourceUrl: "https://www.amazon.com/dp/B012345678?smid=A", available: true, importability: "eligible", finalPriceUSD: 100, priceUSD: 20, condition: "new", store: "Amazon" };
  const target = catalogOfferTarget(product, offer);
  assert.equal(target.params.url, offer.sourceUrl);
  assert.equal(target.pathname, "/external-product/[id]");
  assert.equal(Object.keys(target.params).some(key => /price|total/i.test(key)), false);
  assert.equal(catalogOfferTarget(product, { ...offer, importability: "blocked" }), null);
  assert.equal(catalogOfferTarget(product, { ...offer, available: false }), null);
  assert.equal(catalogOfferTarget(product, { ...offer, source: "shopx", slug: "actual-sku" }).params.id, "actual-sku");
  assert.equal(catalogOfferTarget(product, { ...offer, source: "walmart", sourceUrl: "https://www.walmart.com/ip/12345" }).pathname, "/quote");
});

test("Pagination appends unique products without resetting current ranking", () => {
  const { mergeCatalogPages } = load("lib/search.ts", { "./request": {} });
  assert.deepEqual(mergeCatalogPages([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }, { id: "c" }]).map(item => item.id), ["a", "b", "c"]);
});

const opportunity = { id: "one", title: "Example", sourceUrl: "https://www.amazon.com/dp/B012345678?smid=SELLER", argentinaPriceArs: 100000, shopxPriceArs: 65000, quotedAt: "2026-11-20T12:00:00Z" };

test("Opportunities preserve dated server comparison and refresh using only the exact source link", async () => {
  let called;
  const opportunities = load("lib/opportunities.ts", { "./request": { request: async url => { called = url; return { items: [opportunity], categories: ["Audio"], total: 1, page: 1, pageCount: 1 }; } } });
  const result = await opportunities.getOpportunities({ query: "Example", category: "Audio", sort: "precio", page: 2 });
  assert.equal(new URL(called, "https://shopx.test").searchParams.get("page"), "2");
  assert.equal(result.items[0].shopxPriceArs, 65000);
  assert.equal(result.items[0].quotedAt, opportunity.quotedAt);
  assert.deepEqual(opportunities.opportunityQuoteParams(opportunity), { url: opportunity.sourceUrl });
});

test("Invalid comparison prices/dates or source origins cannot start a quote", () => {
  const { validOpportunity, opportunityQuoteParams } = load("lib/opportunities.ts", { "./request": {} });
  for (const override of [{ shopxPriceArs: 0 }, { shopxPriceArs: 150000 }, { quotedAt: "invalid" }, { sourceUrl: "https://amazon.com.evil.test/item" }, { sourceUrl: "https://someone@www.amazon.com/dp/B012345678" }]) {
    const item = { ...opportunity, ...override };
    assert.equal(validOpportunity(item), false);
    assert.throws(() => opportunityQuoteParams(item));
  }
});

test("Profile postal validation rejects nonexistent provinces and allows explicitly selected namesakes", () => {
  const postal = load("lib/postal-destination.ts");
  assert.equal(postal.isValidPostalCode("I1425ABC"), false);
  assert.equal(postal.isValidPostalCode("O1425ABC"), false);
  assert.equal(postal.isValidPostalCode("B1804ABC"), true);
  assert.match(postal.resolvePostalSelection(null, "I1425ABC", "Ciudad", "Buenos Aires"), /CPA completo/);
  // These are real, distinct directory entries: names alone cannot select one.
  const localities = [
    { id: "16376", locality: "Canning", province: "Buenos Aires", provinceCode: "B", department: "Esteban Echeverria" },
    { id: "16465", locality: "Canning", province: "Buenos Aires", provinceCode: "B", department: "Ezeiza" },
  ];
  const destination = { postalCode: "1804", status: "ambiguous", localities };
  assert.equal(postal.matchPostalLocality(destination, "Canning", "Buenos Aires"), undefined);
  const selected = { ...destination, selectedLocalityKey: postal.localityKey(localities[1]) };
  assert.equal(postal.matchPostalLocality(selected, "Canning", "Buenos Aires"), localities[1]);
  assert.equal(postal.resolvePostalSelection(selected, "1804", "Canning", "Buenos Aires"), "");
  assert.match(postal.resolvePostalSelection({ ...selected, selectedLocalityKey: "unknown" }, "1804", "Canning", "Buenos Aires"), /Elegí/);
});
