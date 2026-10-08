const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

test("Native Google sign-in uses the SDK ID token and handles cancellation", async () => {
  let configuration;
  let result = { type: "success", data: { idToken: "synthetic-id-token" } };
  const native = load("lib/google-native.ts", {
    "expo-constants": { __esModule: true, default: { executionEnvironment: "standalone" }, ExecutionEnvironment: { StoreClient: "storeClient" } },
    "./google-auth-config": {
      GOOGLE_AUTH_CONFIG: {
        webClientId: "web-client",
        iosClientId: "ios-client",
      },
    },
    "@react-native-google-signin/google-signin": {
      GoogleSignin: {
        configure: (config) => {
          configuration = config;
        },
        hasPlayServices: async () => true,
        signIn: async () => result,
      },
      isErrorWithCode: () => false,
      statusCodes: {},
    },
  });
  assert.equal(await native.getNativeGoogleIdToken(), "synthetic-id-token");
  assert.equal(configuration.webClientId, "web-client");
  result = { type: "cancelled" };
  assert.equal(await native.getNativeGoogleIdToken(), null);
  result = { type: "success", data: {} };
  await assert.rejects(native.getNativeGoogleIdToken(), /sesión válida/);
});

test("Expo Go explains native login limits without loading the unavailable Google module", async () => {
  const native = load("lib/google-native.ts", {
    "expo-constants": { __esModule: true, default: { executionEnvironment: "storeClient" }, ExecutionEnvironment: { StoreClient: "storeClient" } },
    "./google-auth-config": { GOOGLE_AUTH_CONFIG: {} },
  });
  await assert.rejects(native.getNativeGoogleIdToken(), /En Expo Go ingresá con email/);
  await native.clearNativeGoogleSession();
});

// Execute the actual portable app modules; only device storage/network are replaced.
function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith("."))
        return load(
          path.relative(
            path.resolve(__dirname, ".."),
            path.resolve(path.dirname(filename), id),
          ) + ".ts",
          mocks,
          cache,
        );
      return require(id);
    },
    module,
    module.exports,
  );
  return module.exports;
}

test("The price summary keeps every charge, including duties, fees and discounts", () => {
  const { summarizePrices } = load("lib/price-summary.ts");
  const rows = [
    { label: "Precio producto USA", amount: 500 },
    { label: "Impuesto de venta USA", amount: 35 },
    { key: "customs_duty", label: "Derecho de importación", amount: 50 },
    { key: "statistics_tax", label: "Tasa estadística", amount: 3 },
    { key: "import_vat", label: "IVA importación", amount: 112 },
    { label: "Gestión ShopX (8%)", amount: 40 },
    { label: "Logística Nacional", amount: 12 },
    { label: "Descuento", amount: -10 },
  ];
  const grouped = summarizePrices(rows);
  assert.equal(
    grouped.reduce((sum, row) => sum + row.amount, 0),
    742,
  );
  assert.equal(grouped.find((row) => row.label === "Impuestos").amount, 165);
  assert.equal(
    grouped.find((row) => row.label === "Precio USA").details.length,
    2,
  );
  assert.equal(grouped.flatMap((row) => row.details).length, rows.length);
});

test("Concurrent cart additions persist every line and reject a whole invalid batch", async () => {
  const data = new Map();
  const storage = {
    getItem: async (key) => data.get(key),
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
  };
  const cart = load("lib/cart-store.ts", {
    "@react-native-async-storage/async-storage": storage,
  });
  const a = {
    id: "a",
    title: "Shirt",
    selectedOptions: { Color: "Blue", Talle: "M" },
  };
  const b = { id: "b", title: "Shoes" };
  await Promise.all([cart.addProductToCart(a), cart.addProductToCart(b)]);
  assert.equal((await cart.getCartItems()).length, 2);
  await assert.rejects(
    cart.addProductsToCart([
      { product: { id: "c" }, quantity: 1 },
      { product: a, quantity: 3 },
    ]),
    /tres unidades/,
  );
  assert.equal((await cart.getCartItems()).length, 2);
  await cart.addProductToCart({
    ...a,
    selectedOptions: { Talle: "L", Color: "Blue" },
  });
  assert.equal((await cart.getCartItems()).length, 3);
  await assert.rejects(cart.updateCartItemQuantity(b, 4), /tres unidades/);
  assert.equal(
    (await cart.getCartItems()).find((item) => item.product.id === "b")
      .quantity,
    1,
  );
});

test("Checkout preserves canonical IDs, variant SKU, selections and quantity", () => {
  const { checkoutItems } = load("lib/cart-pricing.ts", { "./request": {} });
  const item = checkoutItems([
    {
      product: {
        _id: "mongo-id",
        slug: "shirt-blue",
        selectedVariant: { sku: "SKU-BLUE-M", sourceVariantId: "variant-m" },
        selectedOptions: { Color: "Blue", Size: "M" },
      },
      quantity: 2,
    },
  ])[0];
  assert.equal(item.productId, "mongo-id");
  assert.equal(item.variantId, "variant-m");
  assert.equal(item.sku, "SKU-BLUE-M");
  assert.equal(item.quantity, 2);
  assert.deepEqual(item.selections, { Color: "Blue", Size: "M" });
});

test("Quote basket preserves retailer selections and base price without inventing a final price", () => {
  const quote = load("lib/quote-basket.ts", { "./request": {} });
  assert.equal(
    quote.supportsAutomaticQuote("https://www.amazon.com/dp/B012345678"),
    true,
  );
  assert.equal(
    quote.supportsAutomaticQuote("https://amazon.com.untrusted.test/item"),
    false,
  );
  assert.throws(
    () =>
      quote.quoteLinks(
        "https://a.test/1 https://a.test/2 https://a.test/3 https://a.test/4 https://a.test/5 https://a.test/6",
      ),
    /cinco/,
  );
  assert.equal(
    new URL(
      quote.withQuantity("https://www.amazon.com/dp/B012345678?color=blue", 2),
    ).searchParams.get("quantity"),
    "2",
  );
  const [{ product, quantity }] = quote.basketCartProducts({
    products: [
      {
        id: "external",
        title: "Shirt",
        sourceUrl: "https://www.amazon.com/dp/B012345678",
        selectedColor: "Blue",
        selectedSize: "M",
      },
    ],
    cartItems: [
      {
        id: "external",
        priceUSD: 25.99,
        quantity: 2,
        selectedColor: "Blue",
        selectedSize: "M",
        finalPriceUSD: 99,
      },
    ],
  });
  assert.equal(quantity, 2);
  assert.equal(product.priceUSD, 25.99);
  assert.equal(product.finalPriceUSD, undefined);
  assert.deepEqual(product.selectedOptions, { Color: "Blue", Talle: "M" });
});

test("Quote URLs follow website identities, preserve variants and validate basket limits", () => {
  const quote = load("lib/quote-basket.ts", { "./request": {} });
  const retailers = load("lib/quote-retailers.ts");
  const amazon = "https://www.amazon.com/title/dp/B012345678?tag=tracking&qty=2";
  assert.equal(quote.canonicalQuoteUrl(amazon), "https://www.amazon.com/dp/B012345678?quantity=2");
  assert.equal(quote.canonicalQuoteUrl("https://www.ebay.com/itm/title/123456789012?var=9876543210&utm_source=x"), "https://www.ebay.com/itm/123456789012?var=9876543210");
  assert.equal(quote.canonicalQuoteUrl("https://www.sephora.com/product/item-P12345?sku=345678&utm_source=x"), "https://www.sephora.com/product/item-P12345?skuId=345678");
  assert.notEqual(retailers.retailerProductKey("https://www.target.com/p/item/-/A-12345678?preselect=23456789"), retailers.retailerProductKey("https://www.target.com/p/item/-/A-12345678?preselect=34567890"));
  assert.throws(() => quote.quoteLinks(`${amazon}\nhttps://amazon.com/gp/product/B012345678?quantity=3`), /ya está incluido/);
  assert.throws(() => quote.quoteLinks(`${amazon}\nhttps://www.ebay.com/itm/123456789012\nhttps://www.target.com/p/item/-/A-12345678`), /dos tiendas/);
  assert.equal(quote.quoteLinks("https://www.ebay.com/itm/123456789012?var=111\nhttps://www.ebay.com/itm/123456789012?var=222").length, 2);
  assert.equal(quote.supportsAutomaticQuote("https://www.amazon.com.attacker.test/item"), false);
});

test("Automatic quote uses web timeout and preserves retailer errors for the correct fallback", async () => {
  class ApiError extends Error { constructor(message, status, data = {}) { super(message); this.status = status; this.data = data; } }
  let response = { products: [{ id: "a" }], cartItems: [{}], pricing: { totalFinal: 12 } };
  let failure;
  let called;
  const quote = load("lib/quote-basket.ts", { "./request": { ApiError, request: async (path, options) => { called = { path, options }; if (failure) throw failure; return response; } } });
  const url = "https://www.bestbuy.com/site/item/6302559.p";
  const destination = { province: "CABA", city: "Buenos Aires", postalCode: "1425" };
  const signal = new AbortController().signal;
  assert.equal(await quote.calculateQuoteBasket([url], destination, signal), response);
  assert.equal(called.path, "/api/amazon-quote-batch");
  assert.equal(called.options.timeoutMs, 25000);
  assert.deepEqual(called.options.body.destination, destination);
  assert.equal(called.options.signal, signal);
  failure = new ApiError("generic", 422, { errors: [{ error: "Best Buy no devolvió una ficha válida", reason: "not_found" }] });
  await assert.rejects(quote.calculateQuoteBasket([url]), /Best Buy no devolvió/);
  assert.equal(quote.shouldRouteToManualQuote([url], failure.data.errors[0].error), true);
  const amazon = "https://www.amazon.com/dp/B012345678";
  assert.equal(quote.shouldRouteToManualQuote([amazon], "No pudimos leer el producto"), false);
  assert.equal(quote.shouldRouteToManualQuote([amazon, url], "No pudimos leer el producto"), false);
  assert.equal(quote.shouldRouteToManualQuote([amazon], "Faltan dimensiones del embalaje"), true);
  assert.equal(quote.shouldRouteToManualQuote([url], "El producto figura sin stock"), false);
  failure = new ApiError("timeout", 408);
  await assert.rejects(quote.calculateQuoteBasket([url]), /conservamos tus links/);
  failure = undefined;
  response = { ok: true, products: [], errors: [{ error: "No pudimos leer el producto" }] };
  await assert.rejects(quote.calculateQuoteBasket([url]), /No pudimos leer/);
});

test("Partial quote results can be repaired by product identity and cannot be checked out", () => {
  const quote = load("lib/quote-basket.ts", { "./request": {} });
  const first = "https://www.amazon.com/dp/B012345678";
  const second = "https://www.amazon.com/dp/B012345679";
  const product = { id: "second", sourceUrl: second, quantity: 1 };
  const changed = quote.changeQuotedQuantity([first, second], product, 2);
  assert.equal(changed[0], first);
  assert.equal(new URL(changed[1]).searchParams.get("quantity"), "2");
  assert.deepEqual(quote.removeQuotedProduct([first, second], product), [first]);
  const basket = { products: [product], cartItems: [{}], pricing: { totalFinal: 125, checkoutEnabled: true }, expiresAt: "2030-01-01T00:00:00Z" };
  const now = Date.parse("2026-10-08T23:00:00Z");
  assert.equal(quote.canCheckoutBasket(basket, now), true);
  assert.equal(quote.canCheckoutBasket({ ...basket, errors: [{ url: first, error: "Sin stock" }] }, now), false);
  assert.equal(quote.canCheckoutBasket({ ...basket, pricing: { ...basket.pricing, checkoutEnabled: false } }, now), false);
  assert.equal(quote.canCheckoutBasket({ ...basket, expiresAt: "2026-10-08T22:00:00Z" }, now), false);
  assert.equal(quote.canCheckoutBasket({ ...basket, pricing: { totalFinal: NaN } }, now), false);
  assert.deepEqual(quote.quotedProductUrls(basket), [second + "?quantity=1"]);
});

test("Manual quotes require Argentina postal code and send each product's details exactly", async () => {
  let calls = 0;
  let payload;
  const manual = load("lib/quote-manual.ts", {
    "@react-native-async-storage/async-storage": {},
    "./request": { request: async (path, options) => { calls++; assert.equal(path, "/api/quotes"); assert.equal(options.authenticated, true); payload = options.body; return { ok: true, quotes: [{ id: "q", quoteNumber: "Q123" }] }; } },
  });
  const products = [{ ...manual.createManualProduct("www.nike.com/product"), productName: " Zapatillas ", size: " 42 ", color: " Azul ", specs: " Modelo exacto ", quantity: "2" }, manual.createManualProduct("https://www.gap.com/product")];
  await assert.rejects(manual.sendManualQuote(products, "", "explicit_submit"), /código postal/);
  await assert.rejects(manual.sendManualQuote(products, "123", "explicit_submit"), /código postal/);
  await assert.rejects(manual.sendManualQuote(products, "1425", "login"), /Confirmá/);
  await assert.rejects(manual.sendManualQuote([{ ...products[0], quantity: "4" }], "1425", "explicit_submit"), /1 a 3/);
  await assert.rejects(manual.sendManualQuote([{ ...products[0], quantity: "1.5" }], "1425", "explicit_submit"), /1 a 3/);
  assert.equal(calls, 0);
  const quotes = await manual.sendManualQuote(products, "c1425 abc", "explicit_submit");
  assert.equal(calls, 1);
  assert.equal(quotes[0].quoteNumber, "Q123");
  assert.equal(payload.postalCode, "C1425ABC");
  assert.equal(payload.source, "app_quotes");
  assert.deepEqual(payload.products[0], { sourceUrl: "https://www.nike.com/product", productName: "Zapatillas", quantity: 2, requestedSize: "42", requestedColor: "Azul", customerNotes: "Modelo exacto" });
  assert.equal(payload.products[1].quantity, 1);
});

test("Restoring a quote draft preserves postal code and selections without submitting", async () => {
  const data = new Map();
  let calls = 0;
  const manual = load("lib/quote-manual.ts", {
    "@react-native-async-storage/async-storage": { getItem: async key => data.get(key), setItem: async (key, value) => data.set(key, value), removeItem: async key => data.delete(key) },
    "./request": { request: async () => { calls++; } },
  });
  const products = [{ ...manual.createManualProduct("https://gap.com/item?quantity=2"), size: "M", color: "Blue" }];
  await manual.saveManualQuoteDraft({ products, postalCode: "c1425abc" });
  const restored = await manual.readManualQuoteDraft();
  assert.deepEqual(restored, { products, postalCode: "C1425ABC" });
  assert.equal(restored.products[0].quantity, "2");
  assert.equal(calls, 0);
  await manual.clearManualQuoteDraft();
  assert.equal(await manual.readManualQuoteDraft(), null);
});

test("Public ShopX requests support cancellation without sending auth to retailers", async () => {
  const originalFetch = global.fetch;
  const network = load("lib/request.ts", { "./auth": { getAuthToken: async () => { throw new Error("Public quote must not request a token"); } }, "./config": { buildApiUrl: path => `https://www.shopx-ar.com${path}` } });
  const controller = new AbortController();
  let fetchStarted;
  const started = new Promise(resolve => { fetchStarted = resolve; });
  global.fetch = (url, options) => {
    assert.equal(url, "https://www.shopx-ar.com/api/amazon-quote-batch");
    assert.equal(options.headers.Authorization, undefined);
    fetchStarted();
    return new Promise((resolve, reject) => {
      const abort = () => reject(Object.assign(new Error("cancelled"), { name: "AbortError" }));
      if (options.signal.aborted) abort(); else options.signal.addEventListener("abort", abort, { once: true });
    });
  };
  try {
    const pending = network.request("/api/amazon-quote-batch", { method: "POST", body: { urls: [] }, signal: controller.signal });
    await started;
    controller.abort();
    await assert.rejects(pending, error => error.status === 408);
  } finally { global.fetch = originalFetch; }
});


test("Store catalog encodes filters and can request pages after the old 36-product limit", async () => {
  let called;
  const store = load("lib/store-catalog.ts", { "./request": { request: async url => { called = url; return { products: [] }; } } });
  await store.getStoreCatalog("polo-ralph-lauren", "Camperas y Abrigos", 17);
  const url = new URL(called, "https://www.shopx-ar.com");
  assert.equal(url.pathname, "/api/app/stores/polo-ralph-lauren/products");
  assert.equal(url.searchParams.get("page"), "17");
  assert.equal(url.searchParams.get("category"), "Camperas y Abrigos");
  assert.equal(url.searchParams.get("limit"), "24");
  assert.equal(store.productCategoryLabel({categoryLabel:"Pantalones",category:{main:"Ropa"}}),"Pantalones");
  assert.equal(store.productCategoryLabel({category:{main:"Ropa",sub:"Gorras"}}),"Gorras");
  assert.deepEqual(store.mergeCatalogPages([{_id:"a"}],[{_id:"a"},{_id:"b"},{_id:"b"},{_id:"c"}]).map(p=>p._id),["a","b","c"]);
});

test("Storefront only labels delivered prices as final and falls back to USD without FX", () => {
  const store = load("lib/storefront.ts", { "./request": {} });
  assert.equal(store.storefrontPrice({ priceUSD: 45 }, 1540).text, "Ver precio");
  const product = { priceUSD: 45, finalPriceUSD: 100 };
  assert.equal(store.storefrontPrice(product, 1540).text, "$ 154.000");
  assert.equal(store.storefrontPrice(product, NaN).caption, "Precio final en USD");
  assert.equal(store.storefrontPrice(product, 0).text, "USD 100");
  assert.equal(store.finalPriceUSD({ finalPriceUSD: Infinity, estimatedUSD: 25 }), 25);
});

test("Storefront excludes unavailable, duplicate and unpriced cards and requires variant selection", () => {
  const store = load("lib/storefront.ts", { "./request": {} });
  const product = { _id: "a", slug: "a", title: "Item", finalPriceUSD: 100, images: ["https://example.test/a.jpg"] };
  const products = [product, { ...product }, { ...product, slug: "b", available: false }, { ...product, slug: "c", images: [] }, { ...product, slug: "d", images: ["/placeholder.png"] }, { ...product, slug: "e", finalPriceUSD: undefined, priceUSD: 10 }];
  assert.deepEqual(store.visibleStorefrontProducts(products).map(p => p.slug), ["a"]);
  assert.equal(store.needsProductSelection(product), false);
  assert.equal(store.needsProductSelection({ ...product, options: [{ name: "Talle", values: ["M"] }] }), true);
  assert.equal(store.needsProductSelection({ ...product, variationMatrix: [{ sku: "a" }] }), true);
});

test("The want-it collection retries failures, preserves editorial order and deduplicates requests", async () => {
  let calls = 0;
  let fail = true;
  const product = { slug: "a", title: "Item", finalPriceUSD: 100, images: ["https://example.test/a.jpg"] };
  const store = load("lib/storefront.ts", { "./request": { request: async url => {
    assert.equal(url, "/api/app/want-it"); calls++;
    if (fail) throw new Error("network");
    return { products: [{ ...product, slug: "b" }, product] };
  } } });
  await assert.rejects(store.getWantItProducts(), /network/);
  fail = false;
  const [a, b] = await Promise.all([store.getWantItProducts(), store.getWantItProducts()]);
  assert.deepEqual(a.map(p => p.slug), ["b", "a"]);
  assert.deepEqual(a, b);
  assert.equal(calls, 2);
  await store.getWantItProducts();
  assert.equal(calls, 2);
  await store.getWantItProducts(true);
  assert.equal(calls, 3);
});
