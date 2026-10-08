import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { StorefrontProductCard } from "../components/StorefrontProductCard";
import type { ShopXProduct } from "../lib/api";
import { getStorefrontExchangeRate, getWantItProducts } from "../lib/storefront";

export default function WantItScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const shellWidth = Math.min(width, 640);
  const [products, setProducts] = useState<ShopXProduct[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const load = useCallback(async (force = false) => {
    const id = ++generation.current;
    setLoading(true);
    setError("");
    await Promise.allSettled([
      getWantItProducts(force).then((value) => { if (id === generation.current) setProducts(value); }).catch(() => {
        if (id === generation.current) setError("No pudimos cargar los productos. Tocá para reintentar.");
      }),
      getStorefrontExchangeRate().then((rate) => { if (id === generation.current) setExchangeRate(rate); }).catch(() => {
        if (id === generation.current) setExchangeRate(undefined);
      }),
    ]);
    if (id === generation.current) setLoading(false);
  }, []);
  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load]);
  return <View style={s.app}>
    <FlatList data={products} numColumns={2} keyExtractor={(item) => item.slug}
      style={{ width: shellWidth, alignSelf: "center" }} columnWrapperStyle={s.row}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 88 }}
      refreshControl={<RefreshControl refreshing={loading && products.length > 0} onRefresh={() => { void load(true); }} tintColor="#087C91" />}
      ListHeaderComponent={<View style={s.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver al inicio" style={s.back} onPress={() => router.canGoBack() ? router.back() : router.replace("/")}><Feather name="arrow-left" size={24} color="#082A49" /></TouchableOpacity>
        <Text accessibilityRole="header" style={s.title}>No lo necesito,{"\n"}pero lo quiero</Text>
        {error ? <TouchableOpacity accessibilityRole="button" onPress={() => { void load(true); }}><Text style={s.message}>{error}</Text></TouchableOpacity> : null}
      </View>}
      ListEmptyComponent={loading ? <ActivityIndicator style={s.empty} color="#087C91" /> : !error ? <Text style={[s.message, s.empty]}>Pronto vas a encontrar nuevos productos acá.</Text> : null}
      renderItem={({ item }) => <View style={{ width: (shellWidth - 44) / 2 }}><StorefrontProductCard product={item} exchangeRate={exchangeRate} /></View>} />
    <AppBottomNav />
  </View>;
}
const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { paddingHorizontal: 16, paddingBottom: 20 },
  back: { width: 44, height: 44, justifyContent: "center" },
  title: { fontSize: 29, fontWeight: "900", lineHeight: 31, letterSpacing: -1, color: "#082A49", marginTop: 8 },
  row: { paddingHorizontal: 16, gap: 12, marginBottom: 12, alignItems: "stretch" },
  message: { color: "#667992", fontSize: 14, lineHeight: 20, marginTop: 12 },
  empty: { margin: 24 },
});
