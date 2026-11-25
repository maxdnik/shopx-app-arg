const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  cache.set(filename, module.exports);
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

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  let sessionWrites = 0;
  return {
    values,
    get sessionWrites() { return sessionWrites; },
    getItem: async key => values.get(key) || null,
    setItem: async (key, value) => values.set(key, value),
    removeItem: async key => values.delete(key),
    multiSet: async rows => { sessionWrites++; for (const [key, value] of rows) values.set(key, value); },
    multiRemove: async keys => { for (const key of keys) values.delete(key); },
  };
}

function authModule(saved = storage()) {
  return load("lib/auth.ts", { "@react-native-async-storage/async-storage": saved });
}
function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}
function mockFetch(t, implementation) {
  const original = global.fetch;
  global.fetch = implementation;
  t.after(() => { global.fetch = original; });
}

test("CUIT/CUIL validates the check digit and rejects DNI-only values", () => {
  const { getCuitValidationError, normalizeCuit } = load("lib/account-validation.ts");
  assert.equal(normalizeCuit("20-12345678-6"), "20123456786");
  assert.equal(getCuitValidationError("20-12345678-6"), "");
  assert.match(getCuitValidationError("20123456787"), /no parece válido/);
  assert.match(getCuitValidationError("12345678"), /DNI no es suficiente/);
  assert.match(getCuitValidationError(""), /Completá/);
});

test("registration requires the web password policy and explicit current terms", async t => {
  let calls = 0;
  mockFetch(t, async () => { calls++; return jsonResponse({ ok: true, pendingVerification: true }); });
  const auth = authModule();
  const terms = load("lib/purchase-terms.ts");
  const payload = { fullName: "Test User", email: "tester@example.test", password: "Password123" };
  await assert.rejects(auth.registerApp(payload), /Términos y Condiciones/);
  await assert.rejects(auth.registerApp({ ...payload, termsAcceptance: { accepted: true, version: "old" } }), /Términos y Condiciones/);
  await assert.rejects(auth.registerApp({ ...payload, termsAcceptance: terms.purchaseTermsInput(true), password: "password123" }), /mayúscula/);
  await assert.rejects(auth.registerApp({ ...payload, termsAcceptance: terms.purchaseTermsInput(true), email: "invalid" }), /email válido/);
  assert.equal(calls, 0);
});

test("canonical registration awaits verification without creating a session", async t => {
  let sent;
  mockFetch(t, async (url, options) => {
    sent = { url: String(url), body: JSON.parse(options.body) };
    return jsonResponse({ ok: true, pendingVerification: true });
  });
  const saved = storage();
  const auth = authModule(saved);
  const terms = load("lib/purchase-terms.ts");
  const result = await auth.registerApp({ fullName: " Test User ", email: " Tester@Example.test ", password: "Password123", termsAcceptance: terms.purchaseTermsInput(true) });
  assert.equal(new URL(sent.url).pathname, "/api/auth/register");
  assert.equal(sent.body.email, "tester@example.test");
  assert.equal(sent.body.fullName, "Test User");
  assert.deepEqual(sent.body.termsAcceptance, terms.purchaseTermsInput(true));
  assert.equal(result.pendingVerification, true);
  assert.equal(saved.sessionWrites, 0);
  assert.equal(await saved.getItem("shopx_auth_token"), null);
});

test("unverified login retains the error code and verification resend stays unauthenticated", async t => {
  const calls = [];
  mockFetch(t, async (url, options) => {
    calls.push({ path: new URL(url).pathname, options });
    return calls.length === 1
      ? jsonResponse({ ok: false, error: "EMAIL_NOT_VERIFIED", message: "Verificá tu email." }, 403)
      : jsonResponse({ ok: true, message: "Si la cuenta necesita verificación, te vamos a enviar un enlace a ese email." });
  });
  const auth = authModule();
  await assert.rejects(auth.loginApp({ email: "tester@example.test", password: "Password123" }), error => error instanceof auth.AuthApiError && error.code === "EMAIL_NOT_VERIFIED");
  assert.match(await auth.resendVerificationApp(" Tester@Example.test "), /^Si la cuenta/);
  assert.equal(calls[1].path, "/api/auth/resend-verification");
  assert.equal(calls[1].options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[1].options.body), { email: "tester@example.test" });
});

test("temporary connectivity does not log the user out but an invalid session does", async t => {
  const user = { id: "synthetic-user", email: "tester@example.test" };
  const saved = storage({ shopx_auth_token: "synthetic-token", shopx_auth_user: JSON.stringify(user) });
  const auth = authModule(saved);
  let unauthorized = false;
  mockFetch(t, async () => {
    if (unauthorized) return jsonResponse({ ok: false, error: "Sesión inválida" }, 401);
    throw new TypeError("Network request failed");
  });
  assert.deepEqual(await auth.fetchCurrentUser(), user);
  assert.equal(await saved.getItem("shopx_auth_token"), "synthetic-token");
  unauthorized = true;
  assert.equal(await auth.fetchCurrentUser(), null);
  assert.equal(await saved.getItem("shopx_auth_token"), null);
});

test("late account responses and expired old tokens do not replace or clear a newer session", async t => {
  const oldUser = { id: "old-user", email: "old@example.test" };
  const newUser = { id: "new-user", email: "new@example.test" };
  let saved;
  let status = 200;
  mockFetch(t, async () => {
    // Another account signed in while this request was in flight.
    await saved.multiSet([["shopx_auth_token", "new-token"], ["shopx_auth_user", JSON.stringify(newUser)]]);
    return jsonResponse(status === 401 ? { ok: false, error: "Sesión inválida" }
      : { ok: true, user: oldUser, checkoutProfile: { complete: true, missingFields: [] } }, status);
  });
  for (const operation of ["getAppAccount", "updateAppAccount", "fetchCurrentUser", "expiredCurrentUser", "deleteAppAccount"]) {
    saved = storage({ shopx_auth_token: "old-token", shopx_auth_user: JSON.stringify(oldUser) });
    const auth = authModule(saved);
    status = operation === "expiredCurrentUser" ? 401 : 200;
    if (operation === "getAppAccount") await assert.rejects(auth.getAppAccount(), /sesión cambió/);
    else if (operation === "updateAppAccount") await assert.rejects(auth.updateAppAccount({ fullName: "Old account" }), /sesión cambió/);
    else if (operation === "deleteAppAccount") assert.equal(await auth.deleteAppAccount(), true);
    else assert.deepEqual(await auth.fetchCurrentUser(), newUser);
    assert.equal(await saved.getItem("shopx_auth_token"), "new-token", operation);
    assert.deepEqual(await auth.getStoredUser(), newUser, operation);
  }
});

test("password recovery validates and normalizes email without inferring account existence", async t => {
  let sent;
  mockFetch(t, async (url, options) => { sent = { path: new URL(url).pathname, body: JSON.parse(options.body) }; return jsonResponse({ ok: true }); });
  const auth = authModule();
  await assert.rejects(auth.forgotPasswordApp("not an email"), /email válido/);
  assert.equal(sent, undefined);
  assert.equal(await auth.forgotPasswordApp(" Nobody@Example.test "), true);
  assert.deepEqual(sent, { path: "/api/auth/forgot-password", body: { email: "nobody@example.test" } });
});

const places = [
  { id: "a", locality: "Pueblo Uno", province: "Buenos Aires", provinceCode: "B", department: "Norte" },
  { id: "b", locality: "Pueblo Dos", province: "Buenos Aires", provinceCode: "B", department: "Sur" },
];
const destination = { postalCode: "2000", numericPostalCode: "2000", status: "ambiguous", locality: null, province: "Buenos Aires", provinces: ["Buenos Aires"], localities: places, source: "postal_directory" };

test("postal selection disambiguates shared codes without silently choosing the first place", () => {
  const postal = load("lib/postal-destination.ts");
  assert.equal(postal.normalizePostalCode(" c 1425 abc "), "C1425ABC");
  assert.equal(postal.isValidPostalCode("C1425ABC"), true);
  assert.equal(postal.isValidPostalCode("142"), false);
  assert.equal(postal.matchPostalLocality(destination, "Pueblo Uno", "Buenos Aires"), places[0]);
  assert.equal(postal.matchPostalLocality(destination, "Pueblo Uno", "Santa Fe"), undefined);
  assert.match(postal.resolvePostalSelection(destination, "2000", "Otra ciudad", "Buenos Aires"), /Elegí/);
  assert.equal(postal.resolvePostalSelection(destination, "2000", "Pueblo Dos", "Buenos Aires"), "");
  assert.match(postal.resolvePostalSelection(destination, "2001", "Pueblo Dos", "Buenos Aires"), /actualice/);
});

test("postal lookup rejects a mismatched response and accepts canonical CABA aliases", async t => {
  const postal = load("lib/postal-destination.ts");
  const caba = { ...destination, postalCode: "1425", localities: [{ id: "c", locality: "Ciudad Autónoma de Buenos Aires", province: "Ciudad Autónoma de Buenos Aires", provinceCode: "C", department: "" }] };
  assert.equal(postal.matchPostalLocality(caba, "Capital Federal", "CABA"), caba.localities[0]);
  mockFetch(t, async () => jsonResponse({ ok: true, destination }));
  await assert.rejects(postal.lookupPostalDestination("1425"), /consultar/);
});

test("bonified classification cannot hide a positive or unknown balance", () => {
  const { isBonifiedOrder } = load("lib/order-tracking/list-model.ts");
  assert.equal(isBonifiedOrder({ bonified: true, totalUSD: 0, totalARS: 0 }), true);
  assert.equal(isBonifiedOrder({ bonified: true, totalUSD: 10, totalARS: 10000 }), false);
  assert.equal(isBonifiedOrder({ bonified: true, totalUSD: 0, totalARS: 1 }), false);
  assert.equal(isBonifiedOrder({ bonified: true, totalUSD: 0, delivery: { paidARS: 5 } }), false);
  assert.equal(isBonifiedOrder({ paymentStatus: "bonified", totalUSD: 0 }), false);
  assert.equal(isBonifiedOrder({ bonified: true }), false);
});

test("Andreani events expose only public fields and cannot advance the whole order", () => {
  const { customerAgpTracking } = load("lib/order-tracking/globallpack.ts");
  const { stageOf } = load("lib/order-tracking/view-model.ts");
  const shipments = customerAgpTracking([{ number: "AGP-123", fiscalDocument: "private", invoiceUrl: "https://private.test", events: [{ date: "24/11/2026", status: "Entregado", needsAttention: false, comment: "internal" }] }]);
  assert.deepEqual(shipments, [{ number: "AGP-123", events: [{ date: "24/11/2026", status: "Entregado", needsAttention: false }] }]);
  assert.deepEqual(customerAgpTracking([{ number: "javascript:unsafe", events: [] }]), []);
  assert.equal(stageOf({ _id: "synthetic-order", status: "paid", totalUSD: 100, items: [{ title: "Item", qty: 1, priceUSD: 50 }], agpTracking: shipments }), 0);
});

test("settling a purchase preserves new products, extra units and distinct variants", async () => {
  const blue = { slug: "shirt", title: "Shirt", selectedOptions: { Color: "Blue", Size: "M" }, selectedVariantId: "blue-m" };
  const red = { ...blue, selectedOptions: { Color: "Red", Size: "M" }, selectedVariantId: "red-m" };
  const oldDate = "2026-11-25T10:00:00.000Z";
  const saved = storage({ SHOPX_CART_V1: JSON.stringify([
    { product: blue, quantity: 3, addedAt: oldDate },
    { product: red, quantity: 1, addedAt: oldDate },
    { product: { slug: "new-product", title: "New product" }, quantity: 1, addedAt: "2026-11-25T11:00:00.000Z" },
  ]) });
  const cart = load("lib/cart-store.ts", { "@react-native-async-storage/async-storage": saved });
  const purchased = [{ slug: "shirt", variantId: "blue-m", selections: { Size: "M", Color: "Blue" }, quantity: 2, cartAddedAt: oldDate }];
  const remaining = await cart.settlePurchasedItems(purchased, "synthetic-checkout-1");
  assert.deepEqual(remaining.map(item => [item.product.slug, item.quantity]), [["shirt", 1], ["shirt", 1], ["new-product", 1]]);
  // A crash before clearing the pending checkout can safely repeat settlement.
  const repeated = await cart.settlePurchasedItems(purchased, "synthetic-checkout-1");
  assert.deepEqual(repeated, remaining);
});

test("settlement does not remove a same-product line deleted and re-added during payment", async () => {
  const product = { slug: "item", title: "Item" };
  const saved = storage({ SHOPX_CART_V1: JSON.stringify([{ product, quantity: 1, addedAt: "2026-11-25T12:00:00.000Z" }]) });
  const cart = load("lib/cart-store.ts", { "@react-native-async-storage/async-storage": saved });
  const result = await cart.settlePurchasedItems([{ slug: "item", quantity: 1, cartAddedAt: "2026-11-25T10:00:00.000Z" }], "synthetic-checkout-2");
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 1);
});

test("concurrent cart additions and settlement share one mutation queue", async () => {
  const product = { slug: "item", title: "Item" };
  const addedAt = "2026-11-25T10:00:00.000Z";
  const saved = storage({ SHOPX_CART_V1: JSON.stringify([{ product, quantity: 1, addedAt }]) });
  const cart = load("lib/cart-store.ts", { "@react-native-async-storage/async-storage": saved });
  await Promise.all([
    cart.addProductToCart(product),
    cart.settlePurchasedItems([{ slug: "item", quantity: 1, cartAddedAt: addedAt }], "synthetic-checkout-3"),
  ]);
  assert.equal((await cart.getCartItems())[0].quantity, 1);
  const before = await cart.getCartItems();
  await assert.rejects(cart.settlePurchasedItems([{ slug: "item", quantity: NaN }]), /confirmados/);
  assert.deepEqual(await cart.getCartItems(), before);
});
