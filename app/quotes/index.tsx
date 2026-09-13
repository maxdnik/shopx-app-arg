import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBottomNav } from "../../components/AppBottomNav";
import {
  CustomerQuote,
  getCustomerQuotes,
  quoteMoney,
} from "../../lib/customer-quotes";
import { ApiError, request } from "../../lib/request";

export default function QuotesScreen() {
  const insets = useSafeAreaInsets();
  const [quotes, setQuotes] = useState<CustomerQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setQuotes((await getCustomerQuotes()).quotes);
      setAuthRequired(false);
      setSelected([]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos cargar tus cotizaciones.",
      );
      setAuthRequired(e instanceof ApiError && e.status === 401);
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  async function previewMerge() {
    if (merging) return;
    setMerging(true);
    try {
      const data = await request<{
        preview: {
          totalArs: number;
          targetQuoteNumber: string;
          previewToken: string;
        };
      }>("/api/quotes/merge", {
        method: "POST",
        authenticated: true,
        body: { action: "preview", quoteNumbers: selected },
      });
      Alert.alert(
        "Agrupar cotizaciones",
        `${selected.join(" + ")}\nTotal: ${quoteMoney(data.preview.totalArs)}\nQuedarán reunidas en ${data.preview.targetQuoteNumber}.`,
        [
          {
            text: "Cancelar",
            style: "cancel",
            onPress: () => setMerging(false),
          },
          {
            text: "Confirmar agrupación",
            onPress: async () => {
              try {
                const result = await request<{ quote: CustomerQuote }>(
                  "/api/quotes/merge",
                  {
                    method: "POST",
                    authenticated: true,
                    body: {
                      action: "confirm",
                      quoteNumbers: selected,
                      previewToken: data.preview.previewToken,
                    },
                  },
                );
                router.push({
                  pathname: "/quotes/[number]",
                  params: { number: result.quote.quoteNumber },
                });
              } catch (e) {
                Alert.alert(
                  "No se pudo agrupar",
                  e instanceof Error ? e.message : "Volvé a intentar.",
                );
              } finally {
                setMerging(false);
                void load();
              }
            },
          },
        ],
        { cancelable: true, onDismiss: () => setMerging(false) },
      );
    } catch (e) {
      Alert.alert(
        "Revisá la selección",
        e instanceof Error ? e.message : "No pudimos agrupar.",
      );
      setMerging(false);
    }
  }
  return (
    <View style={s.app}>
      <FlatList
        data={quotes}
        keyExtractor={(item) => item.quoteNumber}
        contentContainerStyle={{
          padding: 18,
          paddingTop: insets.top + 18,
          paddingBottom: insets.bottom + 120,
          gap: 12,
        }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
        ListHeaderComponent={
          <View style={{ gap: 14, paddingBottom: 10 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={s.link}>‹ Volver</Text>
            </TouchableOpacity>
            <Text style={s.title}>Mis cotizaciones</Text>
            <Text style={s.text}>
              Revisá respuestas, importes actualizados y pagos de tus
              solicitudes.
            </Text>
            {selected.length >= 2 && (
              <TouchableOpacity
                disabled={merging}
                style={s.button}
                onPress={previewMerge}
              >
                <Text style={s.buttonText}>
                  {merging
                    ? "Revisando..."
                    : `Agrupar ${selected.length} cotizaciones`}
                </Text>
              </TouchableOpacity>
            )}
            {!!error && (
              <TouchableOpacity
                onPress={() =>
                  authRequired ? router.push("/profile") : load()
                }
              >
                <Text style={s.text}>
                  {error} {authRequired ? "Ir a mi cuenta" : "Reintentar"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/quotes/[number]",
                  params: { number: item.quoteNumber },
                })
              }
            >
              <Text style={s.label}>
                {item.quoteNumber} · {item.statusLabel}
              </Text>
              <Text style={s.heading}>
                {item.productTitle || "Cotización ShopX"}
              </Text>
              {!!item.pricing?.totalArs && (
                <Text style={s.amount}>
                  {quoteMoney(item.pricing.totalArs)}
                </Text>
              )}
              {!!item.expiresAt && (
                <Text style={s.text}>
                  Vigencia:{" "}
                  {new Date(item.expiresAt).toLocaleDateString("es-AR")}
                </Text>
              )}
              <Text style={s.link}>Ver detalle →</Text>
            </TouchableOpacity>
            {!item.mergeBlockedReason &&
              ["sent", "profile_required", "ready_to_pay"].includes(
                item.status,
              ) && (
                <TouchableOpacity
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: selected.includes(item.quoteNumber),
                  }}
                  disabled={merging}
                  onPress={() =>
                    setSelected((current) =>
                      current.includes(item.quoteNumber)
                        ? current.filter(
                            (number) => number !== item.quoteNumber,
                          )
                        : [...current, item.quoteNumber],
                    )
                  }
                >
                  <Text style={s.link}>
                    {selected.includes(item.quoteNumber)
                      ? "✓ Seleccionada"
                      : "Seleccionar para agrupar"}
                  </Text>
                </TouchableOpacity>
              )}
          </View>
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <View style={s.card}>
              <Text style={s.heading}>Todavía no tenés cotizaciones</Text>
              <TouchableOpacity onPress={() => router.push("/quote")}>
                <Text style={s.link}>Cotizar mi producto →</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading ? <ActivityIndicator color="#062B4F" /> : null
        }
      />
      <AppBottomNav />
    </View>
  );
}
const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#F7FAFC" },
  title: { fontSize: 31, fontWeight: "900", color: "#062B4F" },
  heading: {
    color: "#062B4F",
    fontSize: 17,
    fontWeight: "800",
    marginVertical: 10,
  },
  text: { color: "#617590", fontSize: 13, lineHeight: 21 },
  link: { color: "#087F91", fontWeight: "700", paddingVertical: 8 },
  card: {
    backgroundColor: "#FFF",
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  label: { fontSize: 12, color: "#087F91", fontWeight: "700" },
  amount: {
    color: "#062B4F",
    fontSize: 25,
    fontWeight: "900",
    marginBottom: 8,
  },
  button: { padding: 15, borderRadius: 14, backgroundColor: "#22D3EE" },
  buttonText: { color: "#062B4F", fontWeight: "800" },
});
