import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBottomNav } from "../../components/AppBottomNav";
import { PriceSummary } from "../../components/PriceSummary";
import { getStoredUser, ShopXUser } from "../../lib/auth";
import { formatUSD } from "../../lib/api";
import { addProductsToCart } from "../../lib/cart-store";
import {
  basketCartProducts,
  calculateQuoteBasket,
  QuoteBasket,
  quoteLinks,
  supportsAutomaticQuote,
  withQuantity,
} from "../../lib/quote-basket";
import { request } from "../../lib/request";

export default function QuoteScreen() {
  const params = useLocalSearchParams<{ url?: string }>();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState(params.url || "");
  const [urls, setUrls] = useState<string[]>([]);
  const [basket, setBasket] = useState<QuoteBasket>();
  const [manual, setManual] = useState(false);
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [user, setUser] = useState<ShopXUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(Date.now());
  const busy = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getStoredUser().then((value) => {
        if (active) setUser(value);
      });
      return () => {
        active = false;
      };
    }, []),
  );
  useEffect(() => {
    if (params.url) {
      setInput(params.url);
      setBasket(undefined);
      setManual(false);
      setSaved(false);
    }
  }, [params.url]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const expired =
    !!basket?.expiresAt && new Date(basket.expiresAt).getTime() <= now;
  async function calculate(nextUrls: string[]) {
    if (busy.current) return;
    if (!nextUrls.length) {
      setBasket(undefined);
      setUrls([]);
      return;
    }
    busy.current = true;
    setLoading(true);
    setError("");
    setBasket(undefined);
    setSaved(false);
    setUrls(nextUrls);
    try {
      const value = await calculateQuoteBasket(nextUrls, user?.address);
      setBasket(value);
      setNow(Date.now());
      setInput("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos calcular el precio. Volvé a intentar.",
      );
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }
  function submit() {
    try {
      const next = quoteLinks(input);
      const combined = basket ? [...new Set([...urls, ...next])] : next;
      if (combined.length > 5)
        throw new Error("Podés sumar hasta cinco links por operación.");
      if (combined.some((url) => !supportsAutomaticQuote(url))) {
        setUrls(combined);
        setManual(true);
        setBasket(undefined);
        setError("");
        return;
      }
      setManual(false);
      void calculate(combined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revisá los links.");
    }
  }
  async function sendManual() {
    if (!user) {
      router.push("/profile");
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      await request("/api/quotes", {
        method: "POST",
        authenticated: true,
        body: {
          source: "app_quotes",
          products: urls.map((sourceUrl) => ({
            sourceUrl,
            productTitle: title,
            customerNotes: notes,
            requestedQuantity: 1,
          })),
        },
      });
      setSaved(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos guardar la solicitud.",
      );
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }
  async function addBasket() {
    if (
      !basket ||
      loading ||
      basket.errors?.length ||
      basket.pricing.checkoutEnabled === false
    )
      return;
    if (
      basket.expiresAt &&
      new Date(basket.expiresAt).getTime() <= Date.now()
    ) {
      setNow(Date.now());
      return;
    }
    try {
      await addProductsToCart(basketCartProducts(basket));
      router.push("/cart");
    } catch (e) {
      Alert.alert(
        "Revisá el carrito",
        e instanceof Error ? e.message : "No pudimos agregar los productos.",
      );
    }
  }
  const button = (label: string, action: () => void, disabled = false) => (
    <TouchableOpacity
      style={[s.button, disabled && { opacity: 0.5 }]}
      onPress={action}
      disabled={disabled}
    >
      <Text style={s.buttonText}>{label}</Text>
      <Feather name="arrow-right" size={18} color="#062B4F" />
    </TouchableOpacity>
  );
  return (
    <View style={s.app}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 18,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 120,
          gap: 18,
        }}
      >
        <View style={s.header}>
          <Text style={s.title}>Cotizá tu producto de USA.</Text>
          <Text style={s.subtitle}>
            Pegá el link una sola vez. Conocé producto, impuestos y envío antes
            de pagar.
          </Text>
        </View>
        <TouchableOpacity
          style={s.history}
          onPress={() => router.push("/quotes")}
        >
          <Feather name="file-text" size={20} color="#062B4F" />
          <Text style={s.heading}>Mis cotizaciones</Text>
          <Feather name="chevron-right" size={20} color="#062B4F" />
        </TouchableOpacity>
        {saved ? (
          <View style={s.card}>
            <Feather name="check-circle" size={36} color="#07865F" />
            <Text style={s.heading}>Solicitud recibida</Text>
            <Text style={s.text}>
              Podés seguir la respuesta y pagar desde Mis cotizaciones.
            </Text>
            {button("Ver mis cotizaciones", () => router.push("/quotes"))}
            {button("Cotizar otro producto", () => {
              setSaved(false);
              setManual(false);
              setInput("");
              setUrls([]);
            })}
          </View>
        ) : (
          <>
            <View style={s.card}>
              <Text style={s.heading}>
                {basket ? "Sumá otro producto" : "Link del producto"}
              </Text>
              <TextInput
                accessibilityLabel="Links de productos de USA"
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                value={input}
                onChangeText={setInput}
                editable={!loading}
                placeholder="Pegá uno o varios links de tiendas de USA"
                style={s.input}
              />
              {button("Cotizar", submit, loading || !input.trim())}
              <Text style={s.text}>
                Automático: Amazon, eBay, Walmart, Target, Best Buy, Sephora,
                Newegg, Abercrombie y Hollister. Hasta cinco links de dos
                tiendas.
              </Text>
            </View>
            {loading && (
              <View style={s.card}>
                <ActivityIndicator color="#062B4F" />
                <Text style={s.heading}>Estamos calculando tu compra</Text>
                <Text style={s.text}>
                  Revisamos precio, disponibilidad y datos de envío. Algunas
                  tiendas pueden tardar unos minutos.
                </Text>
              </View>
            )}
            {!!error && (
              <View style={s.card}>
                <Text style={s.error}>{error}</Text>
                {urls.length > 0 &&
                  !manual &&
                  button("Volver a calcular", () => calculate(urls), loading)}
              </View>
            )}
            {manual && !loading && (
              <View style={s.card}>
                <Text style={s.heading}>Completá los datos del producto</Text>
                <Text style={s.text}>
                  Para esta tienda necesitamos revisar la información.
                  Conservamos tus links.
                </Text>
                {urls.map((url) => (
                  <Text key={url} numberOfLines={2} style={s.text}>
                    {url}
                  </Text>
                ))}
                <TextInput
                  accessibilityLabel="Producto o modelo"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Producto o modelo (opcional)"
                  style={s.input}
                />
                <TextInput
                  accessibilityLabel="Talle, color y comentarios"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Talle, color, cantidad y comentarios"
                  multiline
                  style={s.input}
                />
                {button(
                  user ? "Enviar solicitud" : "Iniciar sesión para solicitar",
                  sendManual,
                  loading,
                )}
              </View>
            )}
            {basket && (
              <>
                {basket.products.map((product, index) => (
                  <View style={s.card} key={product.id}>
                    <View style={s.row}>
                      {!!product.imageUrl && (
                        <Image
                          source={{ uri: product.imageUrl }}
                          style={s.image}
                        />
                      )}
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={s.store}>{product.store}</Text>
                        <Text style={s.heading}>{product.title}</Text>
                        <Text style={s.text}>
                          {[product.selectedColor, product.selectedSize]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                        <Text style={s.text}>
                          Precio USA: USD {formatUSD(product.priceUSD)}
                        </Text>
                      </View>
                    </View>
                    <View style={s.row}>
                      <TouchableOpacity
                        accessibilityLabel={`Quitar una unidad de ${product.title}`}
                        disabled={
                          loading ||
                          !!basket.errors?.length ||
                          Number(product.quantity || 1) <= 1
                        }
                        onPress={() =>
                          calculate(
                            urls.map((url, i) =>
                              i === index
                                ? withQuantity(
                                    url,
                                    Number(product.quantity || 1) - 1,
                                  )
                                : url,
                            ),
                          )
                        }
                      >
                        <Text style={s.control}>−</Text>
                      </TouchableOpacity>
                      <Text style={s.heading}>{product.quantity || 1}</Text>
                      <TouchableOpacity
                        accessibilityLabel={`Sumar una unidad de ${product.title}`}
                        disabled={
                          loading ||
                          !!basket.errors?.length ||
                          Number(product.quantity || 1) >= 3
                        }
                        onPress={() =>
                          calculate(
                            urls.map((url, i) =>
                              i === index
                                ? withQuantity(
                                    url,
                                    Number(product.quantity || 1) + 1,
                                  )
                                : url,
                            ),
                          )
                        }
                      >
                        <Text style={s.control}>+</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ marginLeft: "auto" }}
                        disabled={loading || !!basket.errors?.length}
                        onPress={() =>
                          calculate(urls.filter((_, i) => i !== index))
                        }
                      >
                        <Text style={s.error}>Quitar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {!!basket.errors?.length && (
                  <View style={s.card}>
                    {basket.errors.map((item) => (
                      <Text key={item.url} style={s.error}>
                        {item.error}
                      </Text>
                    ))}
                    <Text style={s.text}>
                      Revisá los enlaces que no se pudieron calcular antes de
                      continuar.
                    </Text>
                    {button(
                      "Reintentar cotización completa",
                      () => calculate(urls),
                      loading,
                    )}
                  </View>
                )}
                <View style={s.card}>
                  <Text style={s.heading}>Resumen de la compra</Text>
                  <PriceSummary rows={basket.pricing.breakdown || []} />
                  <Text style={s.total}>
                    USD {formatUSD(basket.pricing.totalFinal)}
                  </Text>
                  <Text style={s.text}>
                    Total estimado puesto en Argentina. El carrito vuelve a
                    confirmar el importe con tu dirección.
                  </Text>
                  {basket.warnings?.map((warning) => (
                    <Text style={s.text} key={warning}>
                      {warning}
                    </Text>
                  ))}
                  {expired
                    ? button(
                        "Actualizar cotización vencida",
                        () => calculate(urls),
                        loading,
                      )
                    : button(
                        "Continuar al carrito",
                        addBasket,
                        loading ||
                          !!basket.errors?.length ||
                          !basket.cartItems?.length ||
                          basket.pricing.checkoutEnabled === false,
                      )}
                  {!!basket.pricing.reason && (
                    <Text style={s.error}>{basket.pricing.reason}</Text>
                  )}
                </View>
              </>
            )}
          </>
        )}
        <Text style={s.text}>
          Pagá con tarjeta y cuotas mediante Mercado Pago. Las cuotas y su costo
          dependen del medio seleccionado y se muestran al pagar.
        </Text>
      </ScrollView>
      <AppBottomNav />
    </View>
  );
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
