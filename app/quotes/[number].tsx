import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBottomNav } from "../../components/AppBottomNav";
import { getAppAccount } from "../../lib/auth";
import {
  CustomerQuote,
  getCustomerQuote,
  confirmQuoteProfile,
  payCustomerQuote,
  quoteMoney,
} from "../../lib/customer-quotes";

const fields = [
  ["firstName", "Nombre"],
  ["lastName", "Apellido"],
  ["phone", "Teléfono"],
  ["documentNumber", "CUIT (11 dígitos)"],
  ["streetName", "Calle"],
  ["streetNumber", "Número"],
  ["floor", "Piso (opcional)"],
  ["apartment", "Departamento (opcional)"],
  ["city", "Ciudad"],
  ["province", "Provincia"],
  ["postalCode", "Código postal"],
];
const taxes = [
  ["consumidor_final", "Consumidor final"],
  ["monotributo", "Monotributo"],
  ["responsable_inscripto", "Responsable inscripto"],
  ["exento", "Exento"],
];
export default function QuoteDetail() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const insets = useSafeAreaInsets();
  const [quote, setQuote] = useState<CustomerQuote>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const load = useCallback(async () => {
    if (!number) return;
    setLoading(true);
    setError("");
    try {
      const detail = await getCustomerQuote(number);
      setQuote(detail.quote);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos cargar la cotización.",
      );
    } finally {
      setLoading(false);
    }
  }, [number]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  async function prepareProfile() {
    setBusy(true);
    try {
      const { user } = await getAppAccount();
      const names = (user.fullName || user.name || "").split(/\s+/);
      setForm({
        firstName: names[0] || "",
        lastName: names.slice(1).join(" "),
        phone: user.phone || "",
        documentNumber: user.dni || "",
        taxCondition: user.taxCondition || "",
        streetName: user.address?.streetName || "",
        streetNumber: user.address?.streetNumber || "",
        floor: user.address?.floor || "",
        apartment: user.address?.apartment || "",
        city: user.address?.city || "",
        province: user.address?.province || "",
        postalCode: user.address?.postalCode || "",
      });
      setShowForm(true);
    } catch (e) {
      Alert.alert(
        "Completá tu cuenta",
        e instanceof Error ? e.message : "Iniciá sesión.",
        [{ text: "Ir a mi cuenta", onPress: () => router.push("/profile") }],
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile() {
    setBusy(true);
    try {
      await confirmQuoteProfile(number, { ...form, documentType: "CUIT" });
      setShowForm(false);
      await load();
    } catch (e) {
      Alert.alert(
        "Revisá tus datos",
        e instanceof Error ? e.message : "Completá los campos requeridos.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function pay() {
    if (busy) return;
    setBusy(true);
    try {
      const latest = await getCustomerQuote(number);
      if (
        latest.quote.pricing?.totalArs !== quote?.pricing?.totalArs ||
        latest.quote.status !== quote?.status
      ) {
        setQuote(latest.quote);
        Alert.alert(
          "Cotización actualizada",
          "Revisá el importe y el estado antes de continuar.",
        );
        return;
      }
      const payment = await payCustomerQuote(number);
      if (!payment.init_point)
        throw new Error("No se pudo obtener el enlace de Mercado Pago.");
      await Linking.openURL(payment.init_point);
    } catch (e) {
      Alert.alert(
        "No pudimos iniciar el pago",
        e instanceof Error ? e.message : "Volvé a intentar.",
      );
      await load();
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.app}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 18,
          paddingTop: insets.top + 18,
          paddingBottom: insets.bottom + 120,
          gap: 18,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.link}>‹ Mis cotizaciones</Text>
        </TouchableOpacity>
        <Text style={s.title}>{quote?.quoteNumber || number}</Text>
        {loading && <ActivityIndicator color="#062B4F" />}
        {!!error && (
          <TouchableOpacity onPress={load}>
            <Text style={s.error}>{error} Reintentar</Text>
          </TouchableOpacity>
        )}
        {quote && (
          <>
            <View style={s.card}>
              <Text style={s.link}>{quote.statusLabel}</Text>
              {!!quote.productImage && (
                <Image source={{ uri: quote.productImage }} style={s.image} />
              )}
              <Text style={s.heading}>{quote.productTitle}</Text>
              {quote.items?.map((item) => (
                <Text style={s.text} key={item.lineId}>
                  {item.requestedQuantity || item.quantity || 1} ×{" "}
                  {item.title || item.productTitle || quote.productTitle}
                  {item.totalArs ? ` · ${quoteMoney(item.totalArs)}` : ""}
                </Text>
              ))}
              {!!quote.pricing?.totalArs && (
                <>
                  <Text style={s.text}>Precio final de la cotización</Text>
                  <Text style={s.title}>
                    {quoteMoney(quote.pricing.totalArs)}
                  </Text>
                </>
              )}
              {!!quote.expiresAt && (
                <Text style={s.text}>
                  Válida hasta{" "}
                  {new Date(quote.expiresAt).toLocaleString("es-AR")}
                </Text>
              )}
              {!!quote.mergedQuoteNumbers?.length && (
                <Text style={s.text}>
                  Incluye {quote.mergedQuoteNumbers.join(", ")}
                </Text>
              )}
            </View>
            {["sent", "profile_required"].includes(quote.status) && (
              <TouchableOpacity
                style={s.button}
                disabled={busy}
                onPress={prepareProfile}
              >
                <Text style={s.buttonText}>Confirmar datos para pagar</Text>
              </TouchableOpacity>
            )}
            {showForm && (
              <View style={s.card}>
                <Text style={s.heading}>Datos de facturación y entrega</Text>
                {fields.map(([key, label]) => (
                  <View key={key} style={{ gap: 5 }}>
                    <Text style={s.text}>{label}</Text>
                    <TextInput
                      accessibilityLabel={label}
                      value={form[key] || ""}
                      onChangeText={(value) =>
                        setForm((current) => ({ ...current, [key]: value }))
                      }
                      keyboardType={
                        ["phone", "documentNumber", "streetNumber"].includes(
                          key,
                        )
                          ? "number-pad"
                          : "default"
                      }
                      style={s.input}
                    />
                  </View>
                ))}
                <Text style={s.heading}>Condición fiscal</Text>
                {taxes.map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{
                      selected: form.taxCondition === value,
                    }}
                    onPress={() =>
                      setForm((current) => ({
                        ...current,
                        taxCondition: value,
                      }))
                    }
                  >
                    <Text style={s.link}>
                      {form.taxCondition === value ? "✓ " : ""}
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={s.button}
                  disabled={busy || !form.taxCondition}
                  onPress={saveProfile}
                >
                  <Text style={s.buttonText}>
                    {busy ? "Guardando..." : "Confirmar datos"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {["ready_to_pay", "payment_pending"].includes(quote.status) && (
              <TouchableOpacity style={s.button} disabled={busy} onPress={pay}>
                <Text style={s.buttonText}>
                  {busy ? "Preparando el pago..." : "Pagar con Mercado Pago"}
                </Text>
              </TouchableOpacity>
            )}
            {!!quote.orderNumber && (
              <TouchableOpacity
                style={s.button}
                onPress={() =>
                  router.push({
                    pathname: "/order/[id]",
                    params: { id: quote.orderNumber! },
                  })
                }
              >
                <Text style={s.buttonText}>Ver pedido {quote.orderNumber}</Text>
              </TouchableOpacity>
            )}
            <View style={s.card}>
              <Text style={s.heading}>Historial</Text>
              {quote.timeline?.map((event, index) => (
                <Text style={s.text} key={`${event.at}-${index}`}>
                  {new Date(event.at).toLocaleString("es-AR")} · {event.label}
                </Text>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <AppBottomNav />
    </View>
  );
}
const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#F7FAFC" },
  title: { color: "#062B4F", fontSize: 30, fontWeight: "900" },
  heading: { color: "#062B4F", fontSize: 18, fontWeight: "800" },
  text: { color: "#617590", fontSize: 13, lineHeight: 21 },
  link: { color: "#087F91", fontWeight: "700", paddingVertical: 8 },
  error: { color: "#B42318" },
  card: {
    padding: 18,
    backgroundColor: "#FFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 14,
  },
  image: { height: 170, width: "100%", resizeMode: "contain" },
  button: { backgroundColor: "#22D3EE", borderRadius: 14, padding: 17 },
  buttonText: { fontWeight: "800", color: "#062B4F", textAlign: "center" },
  input: {
    backgroundColor: "#F3F6FA",
    padding: 13,
    borderRadius: 12,
    color: "#062B4F",
  },
});
