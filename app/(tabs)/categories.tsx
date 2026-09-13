import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBottomNav } from "../../components/AppBottomNav";
import { ProductCard } from "../../components/ProductCard";
import {
  CatalogCategory,
  getCatalogNavigation,
  getCatalogProducts,
} from "../../lib/catalog";
import type { ShopXProduct } from "../../lib/api";
import { saveProductToCache } from "../../lib/product-cache";

export default function CategoriesScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [category, setCategory] = useState(params.category || "all");
  const [subcategory, setSubcategory] = useState("");
  const [audience, setAudience] = useState("all");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [products, setProducts] = useState<ShopXProduct[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const busy = useRef(false);
  useEffect(() => {
    getCatalogNavigation()
      .then(setCategories)
      .catch(() =>
        setError("No pudimos cargar las categorías. Deslizá para reintentar."),
      );
  }, []);
  useEffect(() => {
    if (params.category) {
      setCategory(params.category);
      setSubcategory("");
    }
  }, [params.category]);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timeout);
  }, [query]);
  const load = useCallback(
    async (nextPage: number) => {
      if (nextPage > 1 && busy.current) return;
      const id = ++generation.current;
      busy.current = true;
      setLoading(true);
      setError("");
      if (nextPage === 1) {
        setProducts([]);
        setHasMore(false);
      }
      try {
        const result = await getCatalogProducts({
          category,
          subcategory,
          audience,
          query: debounced,
          page: nextPage,
        });
        if (id !== generation.current) return;
        setProducts((current) =>
          nextPage === 1
            ? result.products
            : [
                ...current,
                ...result.products.filter(
                  (item) =>
                    !current.some(
                      (existing) =>
                        (existing._id || existing.slug) ===
                        (item._id || item.slug),
                    ),
                ),
              ],
        );
        setPage(nextPage);
        setHasMore(result.pagination.hasMore);
        setTotal(result.pagination.total);
      } catch (e) {
        if (id === generation.current)
          setError(
            e instanceof Error ? e.message : "No pudimos cargar el catálogo.",
          );
      } finally {
        if (id === generation.current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [category, subcategory, audience, debounced],
  );
  useEffect(() => {
    void load(1);
    return () => {
      generation.current += 1;
      busy.current = false;
    };
  }, [load]);
  const selected = categories.find((item) => item.key === category);
  const chip = (
    key: string,
    label: string,
    active: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      style={[s.chip, active && s.active]}
    >
      <Text style={[s.chipText, active && s.activeText]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={s.app}>
      <FlatList
        data={products}
        numColumns={2}
        keyExtractor={(item) => item._id || item.slug || item.id || item.title}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 18 }}
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: insets.bottom + 120,
          gap: 12,
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading && page === 1}
            onRefresh={() => {
              getCatalogNavigation()
                .then(setCategories)
                .catch(() => undefined);
              void load(1);
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <View style={{ paddingHorizontal: 18, gap: 10 }}>
              <Text style={s.title}>Explorá el catálogo</Text>
              <Text style={s.text}>
                Productos y categorías actualizados con ShopX.
              </Text>
              <TextInput
                accessibilityLabel="Buscar en el catálogo"
                placeholder="Marca, modelo o producto"
                value={query}
                onChangeText={setQuery}
                style={s.input}
                returnKeyType="search"
              />
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: "/search", params: { q: query } })
                }
              >
                <Text style={s.link}>Buscar también en Amazon y eBay →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chips}
            >
              {chip("all", "Todo", category === "all", () => {
                setCategory("all");
                setSubcategory("");
              })}
              {categories.map((item) =>
                chip(item.key, item.label, category === item.key, () => {
                  setCategory(item.key);
                  setSubcategory("");
                  setAudience("all");
                }),
              )}
            </ScrollView>
            {!!selected?.subcategories.length && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chips}
              >
                {chip("", "Todos", !subcategory, () => setSubcategory(""))}
                {selected.subcategories.map((item) =>
                  chip(item.key, item.label, subcategory === item.label, () =>
                    setSubcategory(item.label),
                  ),
                )}
              </ScrollView>
            )}
            {category === "clothing" && (
              <ScrollView horizontal contentContainerStyle={s.chips}>
                {[
                  ["all", "Todos"],
                  ["women", "Mujer"],
                  ["men", "Hombre"],
                  ["kids", "Niños"],
                ].map(([key, label]) =>
                  chip(key, label, audience === key, () => setAudience(key)),
                )}
              </ScrollView>
            )}
            <Text style={[s.text, { paddingHorizontal: 18 }]}>
              {total} productos
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: "50%" }}>
            <ProductCard
              product={item}
              variant="grid"
              onPress={() => {
                saveProductToCache(item);
                router.push({
                  pathname: "/product/[id]",
                  params: { id: item.slug || item._id || "" },
                });
              }}
            />
          </View>
        )}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={{ margin: 24, color: "#617590" }}>
              No encontramos productos con estos filtros.
            </Text>
          ) : null
        }
        ListFooterComponent={
          <View style={{ padding: 18, gap: 12 }}>
            {loading && <ActivityIndicator color="#062B4F" />}
            {!!error && (
              <TouchableOpacity
                onPress={() => load(products.length ? page + 1 : 1)}
              >
                <Text style={s.text}>{error} Reintentar</Text>
              </TouchableOpacity>
            )}
            {hasMore && !loading && (
              <TouchableOpacity style={s.chip} onPress={() => load(page + 1)}>
                <Text style={s.chipText}>Cargar más productos</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
      <AppBottomNav />
    </View>
  );
}
const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#F7FAFC" },
  title: { fontSize: 30, fontWeight: "900", color: "#062B4F" },
  text: { color: "#617590", fontSize: 14, lineHeight: 21 },
  input: {
    backgroundColor: "#FFF",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    color: "#062B4F",
  },
  link: { color: "#087F91", fontWeight: "700" },
  chips: { paddingHorizontal: 18, gap: 8 },
  chip: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  active: { backgroundColor: "#062B4F" },
  chipText: { color: "#062B4F", fontWeight: "700" },
  activeText: { color: "#FFF" },
});
