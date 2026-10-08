import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBottomNav } from "../../components/AppBottomNav";
import { ManualQuoteForm } from "../../components/ManualQuoteForm";
import { PriceSummary } from "../../components/PriceSummary";
import { getStoredUser, type ShopXUser } from "../../lib/auth";
import { formatUSD } from "../../lib/api";
import { addProductsToCart } from "../../lib/cart-store";
import {
  basketCartProducts, calculateQuoteBasket, canCheckoutBasket, changeQuotedQuantity,
  type QuoteBasket, quoteLinks, quotedProductUrls, removeQuotedProduct,
  shouldRouteToManualQuote, supportsAutomaticQuote, validateBasketLinks,
} from "../../lib/quote-basket";
import {
  clearManualQuoteDraft, createManualProduct, MANUAL_FALLBACK_MESSAGE,
  type ManualQuoteProduct, readManualQuoteDraft, saveManualQuoteDraft, sendManualQuote,
} from "../../lib/quote-manual";
import { normalizeQuotePostalCode } from "../../lib/quote-postal-code";
import { SUPPORTED_BRIGHTDATA_RETAILERS_LABEL } from "../../lib/quote-retailers";
import { ApiError, request } from "../../lib/request";

export default function QuoteScreen() {
  const params = useLocalSearchParams<{ url?: string }>();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState(params.url || "");
  const [urls, setUrls] = useState<string[]>([]);
  const [basket, setBasket] = useState<QuoteBasket>();
  const [manual, setManual] = useState(false);
  const [manualMessage, setManualMessage] = useState(MANUAL_FALLBACK_MESSAGE);
  const [manualProducts, setManualProducts] = useState<ManualQuoteProduct[]>([]);
  const [editedPostalCode, setEditedPostalCode] = useState<string | null>(null);
  const [user, setUser] = useState<ShopXUser | null>(null);
  const postalCode = editedPostalCode ?? normalizeQuotePostalCode(user?.address?.postalCode);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [savedNumbers, setSavedNumbers] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const busy = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);
  const draftChecked = useRef(false);
  const draftEdited = useRef(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    void getStoredUser().then(async value => {
      if (!active) return;
      setUser(value);
      if (value) {
        try {
          const account = await request<{ user: ShopXUser }>("/api/app/account", { authenticated: true });
          if (active && account.user) setUser(account.user);
        } catch { /* Keep the local address available when offline. */ }
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, []));

  useEffect(() => {
    let active = true;
    if (!params.url && !draftChecked.current) {
      draftChecked.current = true;
      void readManualQuoteDraft().then(draft => {
        if (!active || !draft || draftEdited.current) return;
        setManualProducts(draft.products);
        setEditedPostalCode(draft.postalCode);
        setManual(true);
        setManualMessage("Revisá los datos y tocá Enviar solicitud de cotización cuando estés listo.");
      });
    }
    return () => { active = false; };
  }, [params.url]);

  useEffect(() => {
    if (!params.url) return;
    activeRequest.current?.abort();
    activeRequest.current = null;
    busy.current = false;
    setLoading(false);
    setInput(params.url);
    setBasket(undefined);
    setUrls([]);
    setManual(false);
    setSavedNumbers([]);
    setError("");
  }, [params.url]);

  useEffect(() => () => { activeRequest.current?.abort(); activeRequest.current = null; }, []);
  useEffect(() => {
    if (!basket?.expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [basket?.expiresAt]);
  const expired = !!basket?.expiresAt && new Date(basket.expiresAt).getTime() <= now;

  function openManual(nextUrls: string[], message = MANUAL_FALLBACK_MESSAGE) {
    draftEdited.current = true;
    setManualProducts(nextUrls.map(createManualProduct));
    setUrls(nextUrls);
    setManualMessage(message);
    setManual(true);
    setBasket(undefined);
    setError("");
  }

  async function calculate(nextUrls: string[]) {
    if (busy.current) return;
    setError("");
    if (!nextUrls.length) {
      setBasket(undefined);
      setUrls([]);
      setInput("");
      return;
    }
    try { validateBasketLinks(nextUrls); }
    catch (e) { setError(e instanceof Error ? e.message : "Revisá los links."); return; }
    const controller = new AbortController();
    activeRequest.current = controller;
    busy.current = true;
    setLoading(true);
    setManual(false);
    setBasket(undefined);
    setSavedNumbers([]);
    setUrls(nextUrls);
    try {
      const address = user?.address;
      const destination = address ? { province: address.province, city: address.city, postalCode: address.postalCode } : undefined;
      const value = await calculateQuoteBasket(nextUrls, destination, controller.signal);
      if (activeRequest.current !== controller) return;
      setBasket(value);
      // Use returned canonical product URLs, including resolved short Amazon links.
      setUrls([...quotedProductUrls(value), ...(value.errors || []).map(item => item.url)]);
      setNow(Date.now());
      setInput("");
    } catch (e) {
      if (activeRequest.current !== controller) return;
      const message = e instanceof Error ? e.message : "No pudimos calcular el precio. Volvé a intentar.";
      if (!(e instanceof ApiError && e.status === 408) && shouldRouteToManualQuote(nextUrls, message)) {
        openManual(nextUrls);
      } else {
        setError(message);
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        busy.current = false;
        setLoading(false);
      }
    }
  }

  function cancelCalculation() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    busy.current = false;
    setLoading(false);
    setError("Cálculo cancelado. Conservamos tus links para volver a intentar.");
  }

  function submit() {
    draftEdited.current = true;
    try {
      const next = quoteLinks(input);
      const combined = basket ? [...urls, ...next] : next;
      validateBasketLinks(combined);
      if (combined.some(url => !supportsAutomaticQuote(url))) {
        openManual(combined, "Para esta tienda necesitamos revisar la información. Conservamos tus links; completá los datos para recibir la cotización.");
        return;
      }
      void calculate(combined);
    } catch (e) { setError(e instanceof Error ? e.message : "Revisá los links."); }
  }

  async function loginForManualQuote() {
    try { await saveManualQuoteDraft({ products: manualProducts, postalCode }); }
    catch { /* Mounted form also preserves the draft while visiting the profile. */ }
    router.push("/profile");
  }

  async function submitManual() {
    if (!user) { await loginForManualQuote(); return; }
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    setError("");
    try {
      const quotes = await sendManualQuote(manualProducts, postalCode, "explicit_submit");
      setSavedNumbers(quotes.map(quote => quote.quoteNumber));
      await clearManualQuoteDraft().catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar la solicitud.");
      if (e instanceof ApiError && e.status === 401) setUser(null);
    } finally { busy.current = false; setSending(false); }
  }

  async function addBasket() {
    if (!basket || loading || busy.current || !canCheckoutBasket(basket)) { setNow(Date.now()); return; }
    busy.current = true;
    try {
      await addProductsToCart(basketCartProducts(basket));
      router.push("/cart");
    } catch (e) { Alert.alert("Revisá el carrito", e instanceof Error ? e.message : "No pudimos agregar los productos."); }
    finally { busy.current = false; }
  }

  function reset() {
    draftEdited.current = true;
    setSavedNumbers([]); setManual(false); setManualProducts([]); setBasket(undefined); setInput(""); setUrls([]); setError("");
    void clearManualQuoteDraft().catch(() => undefined);
  }

  const button = (label: string, action: () => void, disabled = false) => (
    <TouchableOpacity accessibilityRole="button" style={[s.button, disabled && { opacity: 0.5 }]} onPress={action} disabled={disabled}>
      <Text style={s.buttonText}>{label}</Text><Feather name="arrow-right" size={18} color="#062B4F" />
    </TouchableOpacity>
  );

  return <View style={s.app}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 120, gap: 18 }}>
      <View style={s.header}>
        <Text accessibilityRole="header" style={s.title}>Cotizá tu producto de USA.</Text>
        <Text style={s.subtitle}>Pegá el link. Calculamos tu compra cuando la tienda está integrada o te ayudamos a solicitar una cotización.</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" style={s.history} onPress={() => router.push("/quotes")}>
        <Feather name="file-text" size={20} color="#062B4F" /><Text style={s.heading}>Mis cotizaciones</Text><Feather name="chevron-right" size={20} color="#062B4F" />
      </TouchableOpacity>
      {savedNumbers.length > 0 ? <View style={s.card}>
        <Feather name="check-circle" size={36} color="#07865F" />
        <Text style={s.heading}>Solicitud recibida</Text>
        <Text style={s.text}>{savedNumbers.join(" · ")}</Text>
        <Text style={s.text}>Podés seguir la respuesta y pagar desde Mis cotizaciones.</Text>
        {button("Ver mis cotizaciones", () => router.push("/quotes"))}
        {button("Cotizar otro producto", reset)}
      </View> : <>
        {!manual && <View style={s.card}>
          <Text style={s.heading}>{basket ? "Sumá otro producto" : "Link del producto"}</Text>
          <TextInput accessibilityLabel="Links de productos de USA" multiline autoCapitalize="none" autoCorrect={false} keyboardType="url" value={input} onChangeText={value => { setInput(value); setError(""); }} editable={!loading} placeholder="Pegá un link de cualquier tienda de USA" style={s.input} />
          {button("Cotizar", submit, loading || !input.trim())}
          <Text style={s.text}>Automático: {SUPPORTED_BRIGHTDATA_RETAILERS_LABEL}. Hasta cinco links y dos tiendas por operación.</Text>
        </View>}
        {loading && <View style={s.card}>
          <ActivityIndicator color="#062B4F" />
          <Text style={s.heading}>Estamos calculando tu compra</Text>
          <Text style={s.text}>Revisamos precio, disponibilidad y envío. Si la tienda no responde en aproximadamente un minuto, podés volver a intentar.</Text>
          <TouchableOpacity accessibilityRole="button" onPress={cancelCalculation} style={{ minHeight: 44, justifyContent: "center" }}><Text style={s.store}>Cancelar cálculo</Text></TouchableOpacity>
        </View>}
        {!!error && <View style={s.card}>
          <Text accessibilityRole="alert" style={s.error}>{error}</Text>
          {urls.length > 0 && !manual && button("Volver a calcular", () => calculate(urls), loading)}
        </View>}
        {manual && <>
          <ManualQuoteForm products={manualProducts} onProductsChange={setManualProducts} postalCode={postalCode} onPostalCodeChange={setEditedPostalCode} signedIn={!!user} loading={sending} message={manualMessage} onLogin={loginForManualQuote} onSubmit={submitManual} />
          {button("Cotizar otro link", reset, sending)}
        </>}
        {basket && <>
          {basket.products.map(product => <View style={s.card} key={product.id}>
            <View style={s.row}>
              {!!product.imageUrl && <Image source={{ uri: product.imageUrl }} style={s.image} />}
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={s.store}>{product.store}</Text><Text style={s.heading}>{product.title}</Text>
                {!!(product.selectedColor || product.selectedSize) && <Text style={s.text}>{[product.selectedColor, product.selectedSize].filter(Boolean).join(" · ")}</Text>}
                <Text style={s.text}>Precio USA: USD {formatUSD(product.priceUSD)}</Text>
              </View>
            </View>
            <View style={s.row}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Quitar una unidad de ${product.title}`} disabled={loading || Number(product.quantity || 1) <= 1} onPress={() => calculate(changeQuotedQuantity(urls, product, Number(product.quantity || 1) - 1))}><Text style={s.control}>−</Text></TouchableOpacity>
              <Text style={s.heading}>{product.quantity || 1}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Sumar una unidad de ${product.title}`} disabled={loading || Number(product.quantity || 1) >= 3} onPress={() => calculate(changeQuotedQuantity(urls, product, Number(product.quantity || 1) + 1))}><Text style={s.control}>+</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Quitar ${product.title}`} style={{ marginLeft: "auto", minHeight: 44, justifyContent: "center" }} disabled={loading} onPress={() => calculate(removeQuotedProduct(urls, product))}><Text style={s.error}>Quitar</Text></TouchableOpacity>
            </View>
          </View>)}
          {!!basket.errors?.length && <View style={s.card}>
            <Text style={s.heading}>Hay productos por revisar</Text>
            {basket.errors.map(item => <View key={item.url} style={{ gap: 10 }}>
              <Text style={s.text} numberOfLines={2}>{item.url}</Text><Text style={s.error}>{item.error}</Text>
              {button("Quitar este link y recalcular", () => calculate(removeQuotedProduct(urls, { sourceUrl: item.url })), loading)}
            </View>)}
            <Text style={s.text}>El total incluye solo los productos calculados. Revisá o quitá los enlaces pendientes antes de continuar.</Text>
            {button("Reintentar cotización completa", () => calculate(urls), loading)}
          </View>}
          <View style={s.card}>
            <Text style={s.heading}>{basket.errors?.length ? "Resumen de productos calculados" : "Resumen de la compra"}</Text>
            <PriceSummary rows={basket.pricing.breakdown || []} />
            <Text style={s.total}>USD {formatUSD(basket.pricing.totalFinal)}</Text>
            <Text style={s.text}>Total estimado puesto en Argentina. El carrito confirma el importe en pesos con tu dirección de entrega.</Text>
            {!!basket.expiresAt && <Text style={s.text}>Vigente hasta las {new Date(basket.expiresAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}.</Text>}
            {basket.warnings?.map(warning => <Text style={s.text} key={warning}>{warning}</Text>)}
            {expired ? button("Actualizar cotización vencida", () => calculate(urls), loading) : button("Continuar al carrito", addBasket, loading || !canCheckoutBasket(basket, now))}
            {!!basket.pricing.reason && <Text style={s.error}>{basket.pricing.reason}</Text>}
            {!!basket.pricing.reason && shouldRouteToManualQuote(urls, basket.pricing.reason) && button("Solicitar revisión del envío", () => openManual(urls), loading)}
          </View>
        </>}
      </>}
      <Text style={s.text}>Pagá con tarjeta y cuotas mediante Mercado Pago. Las cuotas y su costo dependen del medio seleccionado y se muestran al pagar.</Text>
    </ScrollView>
    <AppBottomNav />
  </View>;
}
const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#F7FAFC" },
  header: {
    padding: 22,
    backgroundColor: "#062B4F",
    borderRadius: 24,
    gap: 12,
  },
  title: { color: "#FFF", fontWeight: "900", fontSize: 31, lineHeight: 36 },
  subtitle: { color: "#D6E8F2", fontSize: 15, lineHeight: 23 },
  card: {
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFF",
    borderRadius: 20,
    gap: 14,
  },
  heading: { color: "#062B4F", fontWeight: "800", fontSize: 17, flexShrink: 1 },
  text: { color: "#617590", fontSize: 13, lineHeight: 20 },
  input: {
    backgroundColor: "#F3F6FA",
    color: "#062B4F",
    padding: 14,
    borderRadius: 12,
    minHeight: 50,
  },
  button: {
    backgroundColor: "#22D3EE",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#062B4F",
    fontWeight: "800",
    fontSize: 15,
    flexShrink: 1,
  },
  error: { color: "#B42318", fontSize: 13, lineHeight: 20 },
  history: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
  },
  image: { width: 90, height: 100, resizeMode: "contain" },
  row: { flexDirection: "row", gap: 16, alignItems: "center" },
  store: { color: "#087F91", fontSize: 11, fontWeight: "800" },
  control: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#EAFBFD",
    fontSize: 22,
    color: "#062B4F",
  },
  total: { fontSize: 29, fontWeight: "900", color: "#062B4F" },
});
