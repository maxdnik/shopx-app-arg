import { useCallback, useMemo, useState } from "react";
import { AppBottomNav } from "../../components/AppBottomNav";
import { ScreenHeader } from "../../components/ScreenHeader";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { getCurrentUser } from "../../lib/auth";
import {
  CustomerQuote,
  QuoteProductPayload,
  completeQuoteProfile,
  fetchMyQuotes,
  normalizeQuoteUrl,
  openQuoteCheckout,
  submitQuoteRequest,
  validateQuoteUrl,
} from "../../lib/quote";

const navy = "#062B4F";
const navyDark = "#031A33";
const text = "#071E35";
const muted = "#718096";
const accent = "#18C7D8";
const soft = "#F7FAFC";
const border = "#E2E8F0";
const white = "#FFFFFF";
const green = "#0EA371";
const greenSoft = "#E7FFF4";
const amber = "#F59E0B";
const red = "#DC2626";

const MAX_PRODUCTS = 3;

type QuoteFormProduct = QuoteProductPayload & { localId: string };

function newProduct(): QuoteFormProduct {
  return {
    localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sourceUrl: "",
    productName: "",
    requestedSize: "",
    requestedColor: "",
    customerNotes: "",
    quantity: 1,
  };
}

function formatMoney(value?: number, currency = "ARS") {
  const amount = Number(value || 0);
  if (!amount) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "ARS" ? 0 : 2,
  }).format(amount);
}

function statusTone(status: string) {
  if (["sent", "ready_to_pay", "payment_pending"].includes(status)) return green;
  if (["profile_required", "pending_review", "priced"].includes(status)) return amber;
  if (["expired", "cancelled", "rejected"].includes(status)) return red;
  return navy;
}

function getPrimaryCta(quote: CustomerQuote) {
  if (["sent", "profile_required", "ready_to_pay"].includes(quote.status)) {
    return "Continuar y pagar";
  }
  if (quote.status === "payment_pending") return "Abrir pago";
  if (quote.status === "pending_review") return "En revisión";
  if (quote.status === "converted_to_order" || quote.status === "paid") return "Pagada";
  if (quote.status === "expired") return "Vencida";
  return quote.statusLabel || quote.status;
}

export default function QuoteScreen() {
  const [products, setProducts] = useState<QuoteFormProduct[]>([newProduct()]);
  const [quotes, setQuotes] = useState<CustomerQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submittedNumbers, setSubmittedNumbers] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [payingQuote, setPayingQuote] = useState<string>("");

  const firstUrlError = useMemo(() => {
    const first = products[0]?.sourceUrl || "";
    if (!first.trim()) return "";
    return validateQuoteUrl(first);
  }, [products]);

  const validProducts = useMemo(
    () => products.filter((product) => product.sourceUrl.trim()),
    [products]
  );

  const canSubmit = validProducts.length > 0 && !firstUrlError && !loading && isLoggedIn;

  const loadQuotes = useCallback(async (silent = false) => {
    if (!silent) setLoadingQuotes(true);
    try {
      const user = await getCurrentUser();
      setIsLoggedIn(Boolean(user));
      if (!user) {
        setQuotes([]);
        return;
      }
      const data = await fetchMyQuotes();
      setQuotes(data);
    } catch (error: any) {
      if (!silent) {
        Alert.alert("No pudimos cargar tus cotizaciones", error?.message || "Intentá de nuevo.");
      }
    } finally {
      if (!silent) setLoadingQuotes(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadQuotes(true);
    }, [loadQuotes])
  );

  function updateProduct(localId: string, patch: Partial<QuoteFormProduct>) {
    setProducts((current) => current.map((product) => (product.localId === localId ? { ...product, ...patch } : product)));
  }

  function addProduct() {
    if (products.length >= MAX_PRODUCTS) return;
    setProducts((current) => [...current, newProduct()]);
  }

  function removeProduct(localId: string) {
    setProducts((current) => (current.length === 1 ? current : current.filter((product) => product.localId !== localId)));
  }

  function resetForm() {
    setProducts([newProduct()]);
    setSubmittedNumbers([]);
  }

  async function handleSubmit() {
    const cleanProducts = validProducts.map((product) => ({
      sourceUrl: normalizeQuoteUrl(product.sourceUrl),
      productName: product.productName,
      requestedSize: product.requestedSize,
      requestedColor: product.requestedColor,
      customerNotes: product.customerNotes,
      quantity: product.quantity || 1,
    }));

    if (cleanProducts.length === 0) {
      Alert.alert("Falta el link", "Pegá al menos un link de producto de USA.");
      return;
    }

    for (const product of cleanProducts) {
      const error = validateQuoteUrl(product.sourceUrl);
      if (error) {
        Alert.alert("Revisá el link", error);
        return;
      }
    }

    setLoading(true);
    try {
      const data = await submitQuoteRequest({ products: cleanProducts });
      const numbers = (data.quotes || []).map((quote) => quote.quoteNumber).filter(Boolean);
      setSubmittedNumbers(numbers);
      await loadQuotes(true);
    } catch (error: any) {
      Alert.alert("No pudimos crear la cotización", error?.message || "Probá de nuevo en unos segundos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadQuotes(true);
    setRefreshing(false);
  }

  async function handlePayQuote(quote: CustomerQuote) {
    if (["pending_review", "expired", "paid", "converted_to_order"].includes(quote.status)) return;

    setPayingQuote(quote.quoteNumber);
    try {
      if (["sent", "profile_required"].includes(quote.status)) {
        await completeQuoteProfile(quote.quoteNumber);
      }
      await openQuoteCheckout(quote.quoteNumber);
      await loadQuotes(true);
    } catch (error: any) {
      const message = error?.message || "No pudimos continuar con el pago.";
      if (/faltan datos|perfil|profile/i.test(message)) {
        Alert.alert(
          "Faltan datos de cuenta",
          "Completá tus datos fiscales y dirección en Mi cuenta. Después volvés a esta cotización y pagás.",
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Ir a Mi cuenta", onPress: () => router.push("/profile") },
          ]
        );
      } else {
        Alert.alert("No pudimos abrir el pago", message);
      }
    } finally {
      setPayingQuote("");
    }
  }

  return (
    <KeyboardAvoidingView style={styles.app} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <ScreenHeader
          title="Cotizar"
          subtitle="Pedís la cotización, ShopX la revisa, la recibís con precio final."
          icon={<Feather name="link-2" size={24} color={white} />}
        />

        {isLoggedIn === false ? (
          <View style={styles.loginCard}>
            <View style={styles.loginIcon}>
              <Feather name="lock" size={28} color={navy} />
            </View>
            <Text style={styles.loginTitle}>Iniciá sesión para cotizar</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/profile")}>
              <Text style={styles.primaryButtonText}>Ir a Mi cuenta</Text>
              <Feather name="arrow-right" size={19} color={white} />
            </TouchableOpacity>
          </View>
        ) : null}

        {submittedNumbers.length > 0 ? (
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Feather name="check" size={34} color={green} />
            </View>
            <Text style={styles.successKicker}>Solicitud recibida</Text>
            <Text style={styles.successTitle}>Ya la estamos revisando</Text>
            <Text style={styles.successText}>
              Creamos {submittedNumbers.length === 1 ? "la cotización" : "las cotizaciones"} {submittedNumbers.join(", ")}. Cuando esté lista, la vas a ver abajo con precio final y botón de pago.
            </Text>
            <View style={styles.nextStepsCard}>
              <Text style={styles.nextStepsTitle}>Flujo web aplicado en app</Text>
              <Step active label="Solicitud creada" />
              <Step label="ShopX carga precio final" />
              <Step label="Completás datos si faltan" />
              <Step label="Pagás la cotización" />
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={resetForm}>
              <Text style={styles.primaryButtonText}>Cotizar otro producto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroKicker}>SHOPX QUOTES</Text>
                <Text style={styles.heroTitle}>Traé cualquier producto de USA</Text>
              </View>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>USA</Text>
                <Text style={styles.heroBadgeSub}>AR</Text>
              </View>
            </View>

            <View style={styles.flowCard}>
              <FlowItem number="1" label="Pedís" />
              <View style={styles.flowLine} />
              <FlowItem number="2" label="Recibís precio" />
              <View style={styles.flowLine} />
              <FlowItem number="3" label="Pagás" />
            </View>

            <View style={styles.mainCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}><Feather name="link-2" size={20} color={navy} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Links a cotizar</Text>
                </View>
              </View>

              {products.map((product, index) => (
                <View key={product.localId} style={styles.productBox}>
                  <View style={styles.productHeader}>
                    <Text style={styles.productTitle}>Producto {index + 1}</Text>
                    {products.length > 1 ? (
                      <TouchableOpacity onPress={() => removeProduct(product.localId)}>
                        <Feather name="trash-2" size={18} color={red} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <TextInput
                    value={product.sourceUrl}
                    onChangeText={(value) => updateProduct(product.localId, { sourceUrl: value })}
                    placeholder="https://www.amazon.com/..."
                    placeholderTextColor="#8FA0B6"
                    style={[styles.linkInput, index === 0 && firstUrlError ? styles.inputError : null]}
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                  {index === 0 && !!firstUrlError ? <Text style={styles.errorText}>{firstUrlError}</Text> : null}

                  <TextInput
                    value={product.productName}
                    onChangeText={(value) => updateProduct(product.localId, { productName: value })}
                    placeholder="Nombre/modelo opcional"
                    placeholderTextColor="#8FA0B6"
                    style={styles.contactInput}
                  />

                  <View style={styles.rowInputs}>
                    <TextInput
                      value={product.requestedSize}
                      onChangeText={(value) => updateProduct(product.localId, { requestedSize: value })}
                      placeholder="Talle"
                      placeholderTextColor="#8FA0B6"
                      style={styles.smallInput}
                    />
                    <TextInput
                      value={product.requestedColor}
                      onChangeText={(value) => updateProduct(product.localId, { requestedColor: value })}
                      placeholder="Color"
                      placeholderTextColor="#8FA0B6"
                      style={styles.smallInput}
                    />
                    <TextInput
                      value={String(product.quantity || 1)}
                      onChangeText={(value) => updateProduct(product.localId, { quantity: Number(value || 1) })}
                      placeholder="Cant."
                      placeholderTextColor="#8FA0B6"
                      style={[styles.smallInput, { flex: 0.7 }]}
                      keyboardType="number-pad"
                    />
                  </View>

                  <TextInput
                    value={product.customerNotes}
                    onChangeText={(value) => updateProduct(product.localId, { customerNotes: value })}
                    placeholder="Comentarios: versión exacta, medidas, si aceptás alternativas, etc."
                    placeholderTextColor="#8FA0B6"
                    style={styles.commentsInput}
                    multiline
                  />
                </View>
              ))}

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.secondaryButton, products.length >= MAX_PRODUCTS && styles.disabledLight]}
                  onPress={addProduct}
                  disabled={products.length >= MAX_PRODUCTS}
                >
                  <Feather name="plus" size={18} color={navy} />
                  <Text style={styles.secondaryButtonText}>Agregar producto</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.trustCard}>
              <View style={styles.trustHeader}>
                <View style={styles.trustIconBig}>
                  <MaterialCommunityIcons name="shield-check-outline" size={25} color={white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trustTitle}>Qué incluye la cotización</Text>
                  <Text style={styles.trustSubtitle}>El mismo desglose operativo de la web.</Text>
                </View>
              </View>
              <TrustItem label="Precio producto USA y disponibilidad" />
              <TrustItem label="IVA importación, aduana y tasas" />
              <TrustItem label="Flete internacional y logística nacional" />
              <TrustItem label="Gestión ShopX hasta entrega" />
            </View>

            <TouchableOpacity style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
              {loading ? <ActivityIndicator color={white} /> : <><Text style={styles.submitButtonText}>Solicitar cotización</Text><Feather name="arrow-right" size={20} color={white} /></>}
            </TouchableOpacity>
          </>
        )}

        <View style={styles.quotesHeader}>
          <View>
            <Text style={styles.myQuotesTitle}>Mis cotizaciones</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={() => loadQuotes(false)}>
            <Feather name="refresh-cw" size={17} color={navy} />
          </TouchableOpacity>
        </View>

        {loadingQuotes ? <ActivityIndicator color={navy} style={{ marginTop: 18 }} /> : null}

        {!loadingQuotes && quotes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Todavía no tenés cotizaciones</Text>
            <Text style={styles.emptyText}>Cuando pidas una, aparece acá igual que en el portal web.</Text>
          </View>
        ) : null}

        {quotes.map((quote) => (
          <View key={quote.id || quote.quoteNumber} style={styles.quoteCard}>
            <View style={styles.quoteTopRow}>
              {quote.productImage ? <Image source={{ uri: quote.productImage }} style={styles.quoteImage} /> : <View style={styles.quoteImageFallback}><Feather name="package" size={22} color={navy} /></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.quoteNumber}>{quote.quoteNumber}</Text>
                <Text style={styles.quoteName} numberOfLines={2}>{quote.productTitle || quote.sourceUrl}</Text>
                <Text style={[styles.statusPill, { color: statusTone(quote.status) }]}>{quote.statusLabel || quote.status}</Text>
              </View>
            </View>

            <View style={styles.quoteMetaGrid}>
              <Meta label="Cantidad" value={String(quote.requestedQuantity || 1)} />
              <Meta label="Talle" value={quote.requestedSize || "—"} />
              <Meta label="Color" value={quote.requestedColor || "—"} />
            </View>

            {quote.pricing ? (
              <View style={styles.priceBox}>
                <Text style={styles.priceLabel}>Total final</Text>
                <Text style={styles.priceArs}>{formatMoney(quote.pricing.totalArs, "ARS")}</Text>
                <Text style={styles.priceUsd}>{formatMoney(quote.pricing.totalUsd, "USD")} · TC {Number(quote.pricing.exchangeRate || 0).toFixed(0)}</Text>
              </View>
            ) : (
              <View style={styles.pendingBox}>
                <Feather name="clock" size={17} color={amber} />
                <Text style={styles.pendingText}>ShopX está revisando precio, peso, impuestos y logística.</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.quoteButton, ["pending_review", "expired", "paid", "converted_to_order"].includes(quote.status) && styles.quoteButtonDisabled]}
              onPress={() => handlePayQuote(quote)}
              disabled={Boolean(payingQuote) || ["pending_review", "expired", "paid", "converted_to_order"].includes(quote.status)}
            >
              {payingQuote === quote.quoteNumber ? <ActivityIndicator color={white} /> : <Text style={styles.quoteButtonText}>{getPrimaryCta(quote)}</Text>}
            </TouchableOpacity>
          </View>
        ))}

        <View style={{ height: 130 }} />
      </ScrollView>
      <AppBottomNav />
    </KeyboardAvoidingView>
  );
}

function FlowItem({ number, label }: { number: string; label: string }) {
  return <View style={styles.flowItem}><View style={styles.flowIcon}><Text style={styles.flowNumber}>{number}</Text></View><Text style={styles.flowText}>{label}</Text></View>;
}

function Step({ label, active }: { label: string; active?: boolean }) {
  return <View style={styles.nextStepRow}><View style={active ? styles.nextStepDot : styles.nextStepDotMuted} /><Text style={styles.nextStepText}>{label}</Text></View>;
}

function TrustItem({ label }: { label: string }) {
  return <View style={styles.trustItem}><Feather name="check-circle" size={18} color={accent} /><Text style={styles.trustText}>{label}</Text></View>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <View style={styles.metaItem}><Text style={styles.metaLabel}>{label}</Text><Text style={styles.metaValue} numberOfLines={1}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: soft },
  screen: { flex: 1, backgroundColor: soft },
  content: { paddingHorizontal: 18, paddingBottom: 0 },
  heroCard: { borderRadius: 30, backgroundColor: navyDark, padding: 18, marginBottom: 14, flexDirection: "row", alignItems: "center", shadowColor: navy, shadowOpacity: 0.13, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  heroTextBlock: { flex: 1 },
  heroKicker: { color: accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  heroTitle: { color: white, fontSize: 23, fontWeight: "900", marginTop: 6, letterSpacing: -0.8, lineHeight: 28 },
  heroText: { color: "rgba(255,255,255,0.74)", fontSize: 13, lineHeight: 19, fontWeight: "600", marginTop: 7 },
  heroBadge: { width: 64, height: 64, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", marginLeft: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  heroBadgeText: { color: white, fontSize: 17, fontWeight: "900" },
  heroBadgeSub: { color: accent, fontSize: 11, fontWeight: "900", marginTop: -2 },
  flowCard: { borderRadius: 24, backgroundColor: white, borderWidth: 1, borderColor: border, padding: 14, marginBottom: 14, flexDirection: "row", alignItems: "center" },
  flowItem: { flex: 1, alignItems: "center" },
  flowIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#EAFBFD", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  flowNumber: { color: navy, fontSize: 12, fontWeight: "900" },
  flowText: { color: text, fontSize: 11, fontWeight: "800", textAlign: "center" },
  flowLine: { width: 22, height: 1, backgroundColor: border },
  mainCard: { borderRadius: 28, backgroundColor: white, borderWidth: 1, borderColor: border, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 14 },
  cardIcon: { width: 40, height: 40, borderRadius: 16, backgroundColor: "#EAFBFD", alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: text, fontSize: 17, fontWeight: "900", letterSpacing: -0.3 },
  sectionSubtitle: { color: muted, fontSize: 12, fontWeight: "600", marginTop: 2, lineHeight: 17 },
  productBox: { borderRadius: 22, borderWidth: 1, borderColor: border, backgroundColor: "#FBFDFF", padding: 12, marginBottom: 12 },
  productHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  productTitle: { color: navy, fontSize: 13, fontWeight: "900" },
  linkInput: { minHeight: 72, borderRadius: 18, backgroundColor: white, borderWidth: 1.5, borderColor: border, paddingHorizontal: 14, paddingVertical: 12, color: text, fontSize: 14, fontWeight: "700", textAlignVertical: "top", marginBottom: 10 },
  inputError: { borderColor: "#F87171", backgroundColor: "#FFF7F7" },
  errorText: { color: red, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  rowInputs: { flexDirection: "row", gap: 9, marginBottom: 10 },
  smallInput: { flex: 1, height: 48, borderRadius: 16, backgroundColor: white, borderWidth: 1, borderColor: border, paddingHorizontal: 12, color: text, fontSize: 13, fontWeight: "700" },
  contactInput: { height: 50, borderRadius: 16, backgroundColor: white, borderWidth: 1, borderColor: border, paddingHorizontal: 14, color: text, fontSize: 14, fontWeight: "700", marginBottom: 10 },
  commentsInput: { minHeight: 76, borderRadius: 16, backgroundColor: white, borderWidth: 1, borderColor: border, paddingHorizontal: 14, paddingVertical: 12, color: text, fontSize: 13, fontWeight: "700", textAlignVertical: "top" },
  actionsRow: { flexDirection: "row", justifyContent: "flex-start" },
  secondaryButton: { height: 44, borderRadius: 16, backgroundColor: "#EAFBFD", paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  secondaryButtonText: { color: navy, fontSize: 13, fontWeight: "900" },
  disabledLight: { opacity: 0.45 },
  trustCard: { borderRadius: 26, backgroundColor: navy, padding: 16, marginBottom: 14 },
  trustHeader: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 12 },
  trustIconBig: { width: 44, height: 44, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  trustTitle: { color: white, fontSize: 16, fontWeight: "900" },
  trustSubtitle: { color: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: "600", marginTop: 2 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  trustText: { color: white, fontSize: 13, fontWeight: "700", flex: 1 },
  submitButton: { height: 58, borderRadius: 20, backgroundColor: navy, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, marginBottom: 14 },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonText: { color: white, fontSize: 16, fontWeight: "900" },
  primaryButton: { height: 54, borderRadius: 18, backgroundColor: navy, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, marginTop: 16 },
  primaryButtonText: { color: white, fontSize: 15, fontWeight: "900" },
  loginCard: { borderRadius: 28, backgroundColor: white, borderWidth: 1, borderColor: border, padding: 18, marginBottom: 14, alignItems: "center" },
  loginIcon: { width: 58, height: 58, borderRadius: 23, backgroundColor: "#EAFBFD", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  loginTitle: { color: text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  loginText: { color: muted, fontSize: 13, fontWeight: "600", lineHeight: 20, textAlign: "center", marginTop: 8 },
  successCard: { borderRadius: 30, backgroundColor: white, borderWidth: 1, borderColor: border, padding: 18, marginBottom: 14, alignItems: "center" },
  successIcon: { width: 72, height: 72, borderRadius: 28, backgroundColor: greenSoft, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  successKicker: { color: green, fontSize: 12, fontWeight: "900", letterSpacing: 1.3 },
  successTitle: { color: text, fontSize: 23, fontWeight: "900", marginTop: 4, textAlign: "center" },
  successText: { color: muted, fontSize: 14, fontWeight: "600", lineHeight: 21, textAlign: "center", marginTop: 8 },
  nextStepsCard: { width: "100%", borderRadius: 22, backgroundColor: soft, borderWidth: 1, borderColor: border, padding: 14, marginTop: 16 },
  nextStepsTitle: { color: text, fontSize: 14, fontWeight: "900", marginBottom: 8 },
  nextStepRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  nextStepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: green },
  nextStepDotMuted: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#CBD5E1" },
  nextStepText: { color: text, fontSize: 13, fontWeight: "700", flex: 1 },
  quotesHeader: { marginTop: 12, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  myQuotesTitle: { color: text, fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  myQuotesSubtitle: { color: muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  refreshButton: { width: 42, height: 42, borderRadius: 16, backgroundColor: white, borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center" },
  emptyCard: { borderRadius: 24, backgroundColor: white, borderWidth: 1, borderColor: border, padding: 18, marginBottom: 12 },
  emptyTitle: { color: text, fontSize: 16, fontWeight: "900" },
  emptyText: { color: muted, fontSize: 13, fontWeight: "600", lineHeight: 19, marginTop: 4 },
  quoteCard: { borderRadius: 26, backgroundColor: white, borderWidth: 1, borderColor: border, padding: 14, marginBottom: 12 },
  quoteTopRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  quoteImage: { width: 58, height: 58, borderRadius: 18, backgroundColor: soft },
  quoteImageFallback: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#EAFBFD", alignItems: "center", justifyContent: "center" },
  quoteNumber: { color: navy, fontSize: 12, fontWeight: "900", letterSpacing: 0.6 },
  quoteName: { color: text, fontSize: 15, fontWeight: "900", marginTop: 2, lineHeight: 19 },
  statusPill: { fontSize: 12, fontWeight: "900", marginTop: 5 },
  quoteMetaGrid: { flexDirection: "row", gap: 8, marginTop: 12 },
  metaItem: { flex: 1, borderRadius: 14, backgroundColor: soft, padding: 10 },
  metaLabel: { color: muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  metaValue: { color: text, fontSize: 13, fontWeight: "900", marginTop: 3 },
  priceBox: { borderRadius: 18, backgroundColor: greenSoft, padding: 12, marginTop: 12 },
  priceLabel: { color: green, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  priceArs: { color: text, fontSize: 22, fontWeight: "900", marginTop: 2 },
  priceUsd: { color: muted, fontSize: 12, fontWeight: "800", marginTop: 2 },
  pendingBox: { borderRadius: 18, backgroundColor: "#FFF7E6", padding: 12, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 9 },
  pendingText: { color: "#8A5A00", fontSize: 12, fontWeight: "800", flex: 1, lineHeight: 17 },
  quoteButton: { height: 48, borderRadius: 17, backgroundColor: navy, alignItems: "center", justifyContent: "center", marginTop: 12 },
  quoteButtonDisabled: { backgroundColor: "#94A3B8" },
  quoteButtonText: { color: white, fontSize: 14, fontWeight: "900" },
});
