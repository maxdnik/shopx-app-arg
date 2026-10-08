const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

test("Native Google sign-in uses the SDK ID token and handles cancellation", async () => {
  let configuration;
  let result = { type: "success", data: { idToken: "synthetic-id-token" } };
  const native = load("lib/google-native.ts", {
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
