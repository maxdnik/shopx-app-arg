const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const crypto = require("node:crypto");

function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", code)((id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith(".")) return load(path.relative(path.resolve(__dirname, ".."), path.resolve(path.dirname(filename), id)) + ".ts", mocks, cache);
    return require(id);
  }, module, module.exports);
  return module.exports;
}

const items = [{ product: { _id: "product-1", title: "Zapatillas", slug: "zapatillas",
  sourceUrl: "https://www.amazon.com/dp/B012345678?th=1", selectedVariantId: "variant-1", selectedOptions: { Talle: "9", Color: "Negro" } }, quantity: 1, addedAt: "2026-11-25" }];
const destination = { province: "Buenos Aires", city: "La Plata", postalCode: "1900" };
function price(extra = {}) {
  return { ok: true, items: [{ productId: "product-1", priceUSD: 50, quantity: 1 }], totalUSD: 80, totalARS: 120000,
    exchangeRateUsed: 1500, checkoutEnabled: true, quotedAt: "2026-11-25",
    pricingBreakdown: [{ label: "Precio productos USA", amount: 50 }, { label: "Logística", amount: 30 }], ...extra };
}

test("Checkout fingerprints invalidate changed variants, quantities, destination, account and coupon", () => {
  const { checkoutFingerprint } = load("lib/cart-pricing.ts", { "./request": {} });
  const fingerprint = checkoutFingerprint(items, destination, "customer@example.com", "MAX");
  const reorder = structuredClone(items);
  reorder[0].product.selectedOptions = { Color: "Negro", Talle: "9" };
  assert.equal(checkoutFingerprint(reorder, destination, " CUSTOMER@example.com ", " max "), fingerprint);
  const variant = structuredClone(items); variant[0].product.selectedVariantId = "variant-2";
  assert.notEqual(checkoutFingerprint(variant, destination, "customer@example.com", "MAX"), fingerprint);
  const quantity = structuredClone(items); quantity[0].quantity = 2;
  assert.notEqual(checkoutFingerprint(quantity, destination, "customer@example.com", "MAX"), fingerprint);
  assert.notEqual(checkoutFingerprint(items, { ...destination, postalCode: "1425" }, "customer@example.com", "MAX"), fingerprint);
  assert.notEqual(checkoutFingerprint(items, destination, "other@example.com", "MAX"), fingerprint);
  assert.notEqual(checkoutFingerprint(items, destination, "customer@example.com", "OTHER"), fingerprint);
  const buyer = { email: "customer@example.com", address: "Calle 10, 100", streetName: "Calle 10", streetNumber: "100", floor: "3", apartment: "A", dni: "20329642330", phone: "1100000000" };
  const reviewed = checkoutFingerprint(items, destination, buyer.email, "MAX", buyer);
  for (const [field, value] of [["address", "Calle 10, 200"], ["streetNumber", "200"], ["floor", "4"], ["apartment", "B"], ["dni", "27329642335"], ["phone", "1122222222"]]) {
    assert.notEqual(checkoutFingerprint(items, destination, buyer.email, "MAX", { ...buyer, [field]: value }), reviewed);
  }
});

test("Native coupon preview sends canonical identity and destination, never trusted client amounts", async () => {
  let sent;
  const coupon = { ok: true, benefit: { code: "MAX", type: "FULL" }, calculation: { originalTotalUSD: 80, discountUSD: 80, finalTotalUSD: 0 },
    price: price({ totalUSD: 0, totalARS: 0, pricingBreakdown: [...price().pricingBreakdown, { label: "Canje MAX", amount: -80 }] }), originalPrice: price() };
  const api = load("lib/cart-pricing.ts", { "./request": { request: async (url, options) => { sent = { url, ...options }; return coupon; } } });
  const result = await api.previewCartBenefit(items, destination, " max ");
  assert.equal(sent.url, "/api/app/cart/benefit");
  assert.equal(sent.authenticated, true);
  assert.equal(sent.body.code, "MAX");
  assert.deepEqual(sent.body.destination, destination);
  assert.equal(sent.body.items[0].variantId, "variant-1");
  assert.equal(sent.body.items[0].selections.Talle, "9");
  assert.equal(sent.body.items[0].sourceUrl, items[0].product.sourceUrl);
  assert.equal(Object.hasOwn(sent.body, "pricing"), false);
  assert.equal(Object.hasOwn(sent.body.items[0], "priceUSD"), false);
  assert.equal(result.price.totalARS, 0);
});

test("Unconfirmed, inconsistent and zero ordinary prices cannot enable native checkout", async () => {
  let response = price();
  const api = load("lib/cart-pricing.ts", { "./request": { request: async () => response } });
  assert.equal(api.isCartPrice(response), true);
  assert.equal(api.hasPricingDestination(destination), true);
  assert.equal(api.hasPricingDestination({ postalCode: "1900" }), false);
  for (const invalid of [
    price({ totalARS: NaN }), price({ totalUSD: 0, totalARS: 0 }), price({ checkoutEnabled: false }),
    price({ totalARS: 0 }), price({ items: [] }), price({ pricingBreakdown: [] }), price({ exchangeRateUsed: 0 }),
    price({ pricingBreakdown: [{ label: "Precio", amount: "80" }] }),
  ]) {
    response = invalid;
    await assert.rejects(api.previewCart(items, destination), /confirmar el total/);
  }
  assert.equal(api.isCartPrice(price({ totalARS: 0, totalUSD: 0 }), true), true);
  assert.equal(api.isCartPrice(price({ totalARS: 0 }), true), false);
});

test("Canje retry preserves idempotency across concurrent taps and app restarts", async () => {
  const storage = new Map();
  const mocks = {
    "@react-native-async-storage/async-storage": {
      getItem: async key => storage.get(key) || null,
      setItem: async (key, value) => { storage.set(key, value); },
      removeItem: async key => { storage.delete(key); },
    },
    "expo-crypto": { CryptoDigestAlgorithm: { SHA256: "sha256" }, digestStringAsync: async (_, value) => crypto.createHash("sha256").update(value).digest("hex"), randomUUID: crypto.randomUUID },
  };
  const first = load("lib/benefit-attempt.ts", mocks);
  const keys = await Promise.all([first.benefitAttemptKey("user/cart/1900/MAX/120000"), first.benefitAttemptKey("user/cart/1900/MAX/120000")]);
  assert.equal(keys[0], keys[1]);
  const restarted = load("lib/benefit-attempt.ts", mocks);
  assert.equal(await restarted.benefitAttemptKey("user/cart/1900/MAX/120000"), keys[0]);
  const changed = await restarted.benefitAttemptKey("user/cart/1425/MAX/120000");
  assert.notEqual(changed, keys[0]);
  await restarted.clearBenefitAttempt(keys[0]);
  assert.equal(await restarted.benefitAttemptKey("user/cart/1425/MAX/120000"), changed);
  await restarted.clearBenefitAttempt(changed);
  assert.notEqual(await restarted.benefitAttemptKey("user/cart/1425/MAX/120000"), changed);
  assert.equal([...storage.values()].some(value => value.includes("user/cart")), false);
});

test("Canje creation sends the reviewed total, terms version and stable idempotency key", async () => {
  let sent;
  const api = load("lib/cart-pricing.ts", { "./request": { request: async (url, options) => { sent = { url, ...options }; return { ok: true, orderNumber: "AR-QA1", mongoId: "qa-order", totalUSD: 20, totalARS: 32000, bonified: false, requiresPayment: true }; } } });
  await api.redeemCartBenefit({ items, destination, buyer: { email: "customer@example.com" }, code: "max",
    expectedTotalARS: 32000, idempotencyKey: "synthetic-attempt-12345", termsAcceptance: { accepted: true, version: "2026-11-03-v3" } });
  assert.equal(sent.url, "/api/app/checkout/benefit");
  assert.equal(sent.authenticated, true);
  assert.equal(sent.body.expectedTotalARS, 32000);
  assert.equal(sent.body.idempotencyKey, "synthetic-attempt-12345");
  assert.equal(sent.body.termsAcceptance.version, "2026-11-03-v3");
  assert.equal(Object.hasOwn(sent.body.items[0], "priceUSD"), false);
});

test("Lost canje responses retain the exact reviewed payload across restarts and account switches", async () => {
  const storage = new Map();
  const mocks = {
    "@react-native-async-storage/async-storage": { getItem: async key => storage.get(key) || null, setItem: async (key, value) => storage.set(key, value), removeItem: async key => storage.delete(key) },
    "expo-crypto": { CryptoDigestAlgorithm: { SHA256: "sha256" }, digestStringAsync: async (_, value) => crypto.createHash("sha256").update(value).digest("hex"), randomUUID: crypto.randomUUID },
  };
  const { benefitCheckoutPayload } = load("lib/cart-pricing.ts", { "./request": {} });
  const payload = benefitCheckoutPayload({ items, destination, buyer: { email: "customer@example.com", address: "Calle 10, 100, Piso 3, Depto A" }, code: "MAX", expectedTotalARS: 32000,
    idempotencyKey: "retry-can-je-123456789", termsAcceptance: { accepted: true, version: "2026-11-03-v3" } });
  const attempt = { payload, settlementItems: payload.items.map((item, index) => ({ ...item, cartAddedAt: items[index].addedAt })) };
  const first = load("lib/benefit-attempt.ts", mocks);
  await first.savePendingBenefitAttempt(payload.buyer.email, attempt);
  const restarted = load("lib/benefit-attempt.ts", mocks);
  assert.deepEqual(await restarted.getPendingBenefitAttempt("CUSTOMER@example.com"), JSON.parse(JSON.stringify(attempt)));
  assert.equal(await restarted.getPendingBenefitAttempt("other@example.com"), null);
  await assert.rejects(restarted.savePendingBenefitAttempt("other@example.com", attempt), /otra cuenta/);
  await restarted.clearPendingBenefitAttempt(payload.buyer.email, "another-attempt");
  assert.ok(await restarted.getPendingBenefitAttempt(payload.buyer.email));
  await restarted.clearPendingBenefitAttempt(payload.buyer.email, payload.idempotencyKey);
  assert.equal(await restarted.getPendingBenefitAttempt(payload.buyer.email), null);
});

test("Canje recovery is a read-only authenticated lookup and never revalidates a consumed coupon", async () => {
  let completed = true;
  let sent;
  const checkout = { ok: true, orderNumber: "AR-QA1", mongoId: "qa-order", totalUSD: 0, totalARS: 0, bonified: true, requiresPayment: false };
  const api = load("lib/cart-pricing.ts", { "./request": { request: async (url, options) => { sent = { url, ...options }; return { ok: true, completed, checkout: completed ? checkout : undefined }; } } });
  assert.equal((await api.completedBenefitCheckout("test-attempt-123456")).orderNumber, "AR-QA1");
  assert.equal(sent.url, "/api/app/checkout/benefit?idempotencyKey=test-attempt-123456");
  assert.equal(sent.authenticated, true);
  assert.equal(sent.method, undefined);
  assert.equal(sent.body, undefined);
  completed = false;
  assert.equal(await api.completedBenefitCheckout("test-attempt-123456"), null);
});

test("Price changes keep the structured server code and total through the payment API", async () => {
  const previousFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: false, status: 409, json: async () => ({
      ok: false, code: "CART_PRICE_CHANGED", error: "Revisá el nuevo total", totalARS: 130000,
    }) });
    const orders = load("lib/orders.ts", { "./auth": { getAuthToken: async () => "test-only-token" }, "./config": { buildApiUrl: route => "https://shopx.example" + route } });
    await assert.rejects(orders.createMercadoPagoCheckout({ expectedTotalARS: 120000 }), error => {
      assert.equal(error.status, 409);
      assert.equal(error.data.code, "CART_PRICE_CHANGED");
      assert.equal(error.data.totalARS, 130000);
      return true;
    });
  } finally { global.fetch = previousFetch; }
});

test("Summary retains coupon amountUSD and mixed-exchange-rate ARS without inventing conversions", () => {
  const { summarizePrices } = load("lib/price-summary.ts");
  const rows = [
    { label: "Precio productos USA", amount: 50, amountARS: 75000 },
    { label: "Impuesto de venta USA", amount: 5, amountARS: 7500 },
    { key: "import_vat", label: "IVA importación", amount: 10, amountARS: 11000 },
    { key: "customs_duty", label: "Derecho de importación", amount: 5, amountARS: 5500 },
    { label: "Canje", amountUSD: -20, amountARS: -30000 },
  ];
  const summary = summarizePrices(rows);
  assert.equal(summary.find(row => row.key === "usa").amountARS, 82500);
  assert.equal(summary.find(row => row.key === "taxes").amountARS, 16500);
  assert.equal(summary.reduce((sum, row) => sum + row.amount, 0), 50);
  assert.equal(summary.reduce((sum, row) => sum + row.amountARS, 0), 69000);
  const missing = summarizePrices([{ label: "Precio productos USA", amount: 50, amountARS: 75000 }, { label: "Impuesto de venta USA", amount: 5 }]);
  assert.equal(missing[0].amountARS, undefined);
});

test("Payment handoff only opens HTTPS Mercado Pago URLs with the reviewed amount", () => {
  const { mercadoPagoUrl, samePaymentAmount } = load("lib/payment-handoff.ts");
  assert.match(mercadoPagoUrl({ init_point: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=sample" }), /^https:\/\/www.mercadopago.com.ar/);
  assert.match(mercadoPagoUrl({ sandbox_init_point: "https://sandbox.mercadopago.com/checkout" }), /sandbox/);
  for (const url of ["http://www.mercadopago.com.ar/checkout", "https://mercadopago.com.ar.evil.example/", "https://mercadopago.com.ar@evil.example/", "javascript:alert(1)", "https://evil.example/"]) {
    assert.throws(() => mercadoPagoUrl({ init_point: url }), /verificar|válido/);
  }
  assert.equal(samePaymentAmount(120000, 120000), true);
  assert.equal(samePaymentAmount(120000, 130000), false);
  assert.equal(samePaymentAmount(0, 0), false);
  assert.equal(samePaymentAmount(120000, "120000"), false);
});
