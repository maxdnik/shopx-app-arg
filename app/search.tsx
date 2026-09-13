import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AppBottomNav } from "../components/AppBottomNav";
import { formatUSD } from "../lib/api";
import { SearchResult, searchShopX } from "../lib/search";

const navy = "#082A4D";
const muted = "#617590";
const soft = "#F6F8FB";
const border = "#E3EAF2";

function sourceLabel(source: SearchResult["source"]) {
  if (source === "amazon") return "AMAZON";
  if (source === "mongo") return "SHOPX";
  return "EBAY USA";
}

function finalPrice(item: SearchResult) {
  return (
    Number(
      item.finalPriceUSD ||
        item.pricing?.finalUSD ||
        item.pricing?.totalFinal ||
        item.estimatedUSD ||
        0,
    ) || 0
  );
}

export default function SearchScreen() {
  const requestId = useRef(0);
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(
    typeof params.q === "string" ? params.q : "",
  );
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSearch(nextQuery = query) {
    const cleanQuery = nextQuery.trim();
    if (!cleanQuery) return;
    const id = ++requestId.current;
    try {
      setLoading(true);
      setSearched(true);
      setErrorMessage("");
      Keyboard.dismiss();
      const found = await searchShopX(cleanQuery);
      if (id === requestId.current) setResults(found);
    } catch (error) {
      console.log("ERROR SEARCH:", error);
      if (id === requestId.current)
        setErrorMessage("No pudimos realizar la búsqueda. Volvé a intentar.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof params.q === "string" && params.q.trim()) handleSearch(params.q);
  }, [params.q]);

  const counts = useMemo(
    () => ({
      amazon: results.filter((item) => item.source === "amazon").length,
      mongo: results.filter((item) => item.source === "mongo").length,
      ebay: results.filter((item) => item.source === "ebay").length,
    }),
    [results],
  );

  function openResult(item: SearchResult) {
    if (item.source === "mongo" && item.slug) {
      router.push(`/product/${item.slug}`);
      return;
    }
    router.push({
      pathname: "/external-product/[id]",
      params: {
        id: item.id,
        source: item.source,
        title: item.title,
        brand: item.brand || "",
        basePriceUSD: String(item.priceUSD || ""),
        finalPriceUSD: String(finalPrice(item) || ""),
        image: item.image || "",
        url: item.url || "",
        condition: item.condition || "",
        seller: item.seller || "",
        rating: String(item.rating || ""),
        reviewsCount: String(item.reviewsCount || ""),
      },
    });
  }

  return (
    <View style={styles.app}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Buscar en USA</Text>
        <Text style={styles.subtitle}>
          Buscá en Amazon, eBay y marcas de USA. Vas a ver todos los resultados
          juntos con precio final estimado en Argentina.
        </Text>

        <View style={styles.searchBox}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar en Amazon, eBay y marcas de USA"
            placeholderTextColor="#8FA0B6"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => handleSearch()}
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => handleSearch()}
          >
            <Text style={styles.searchButtonText}>Buscar</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={navy} size="large" />
            <Text style={styles.loadingEyebrow}>Buscando “{query.trim()}”</Text>
            <Text style={styles.loadingTitle}>
              Estamos comparando Amazon, ShopX y eBay
            </Text>
            <Text style={styles.loadingText}>
              En unos segundos vas a ver todos los resultados juntos y
              ordenados.
            </Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No se pudo buscar</Text>
            <Text style={styles.emptyText}>{errorMessage}</Text>
          </View>
        ) : !searched ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔎</Text>
            <Text style={styles.emptyTitle}>Buscá cualquier producto</Text>
            <Text style={styles.emptyText}>
              Probá con una marca, modelo o producto específico.
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No encontramos resultados</Text>
            <Text style={styles.emptyText}>
              Probá con otra búsqueda o solicitá una cotización.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Resultados</Text>
              <Text style={styles.resultsCount}>
                {results.length} encontrados · {counts.amazon} Amazon ·{" "}
                {counts.mongo} ShopX · {counts.ebay} eBay
              </Text>
            </View>
            <View style={styles.resultsList}>
              {results.map((item) => {
                const price = finalPrice(item);
                return (
                  <TouchableOpacity
                    key={`${item.source}-${item.id}`}
                    style={styles.card}
                    activeOpacity={0.88}
                    onPress={() => openResult(item)}
                  >
                    <View style={styles.imageBox}>
                      {item.image ? (
                        <Image
                          source={{ uri: item.image }}
                          style={styles.image}
                        />
                      ) : (
                        <Text style={styles.emptyIcon}>📦</Text>
                      )}
                    </View>
                    <View style={styles.info}>
                      <View style={styles.sourceRow}>
                        <Text
                          style={[
                            styles.badge,
                            item.source === "amazon" && styles.badgeAmazon,
                            item.source === "ebay" && styles.badgeEbay,
                          ]}
                        >
                          {sourceLabel(item.source)}
                        </Text>
                        {!!item.condition && (
                          <Text style={styles.condition}>{item.condition}</Text>
                        )}
                      </View>
                      <Text style={styles.productTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      {!!item.rating && (
                        <Text style={styles.rating}>
                          {item.rating.toFixed(1)} ★{" "}
                          {item.reviewsCount
                            ? `(${item.reviewsCount.toLocaleString("es-AR")})`
                            : ""}
                        </Text>
                      )}
                      <Text style={styles.finalArgentina}>FINAL ARGENTINA</Text>
                      <Text style={styles.price}>
                        {price ? `USD ${formatUSD(price)}` : "Consultar"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
        <View style={{ height: 140 }} />
      </ScrollView>
      <AppBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#FFF" },
  screen: { flex: 1, backgroundColor: "#FFF" },
  content: { paddingTop: 58, paddingHorizontal: 20 },
  backButton: { alignSelf: "flex-start", marginBottom: 16 },
  backText: { color: navy, fontSize: 17, fontWeight: "900" },
  title: {
    color: navy,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  subtitle: {
    color: muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 18,
  },
  searchBox: {
    minHeight: 58,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: border,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 18,
    paddingRight: 8,
  },
  searchInput: { flex: 1, color: navy, fontSize: 14, fontWeight: "700" },
  searchButton: {
    backgroundColor: navy,
    borderRadius: 999,
    paddingHorizontal: 17,
    paddingVertical: 12,
  },
  searchButtonText: { color: "#FFF", fontWeight: "900" },
  loadingCard: {
    marginTop: 18,
    borderRadius: 28,
    backgroundColor: soft,
    borderWidth: 1,
    borderColor: border,
    padding: 28,
    alignItems: "center",
  },
  loadingEyebrow: {
    marginTop: 15,
    color: "#8EA1BB",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  loadingTitle: {
    color: navy,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 10,
  },
  loadingText: {
    color: muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },
  emptyCard: {
    marginTop: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: soft,
    padding: 28,
    alignItems: "center",
  },
  emptyIcon: { fontSize: 38 },
  emptyTitle: {
    color: navy,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 8,
    textAlign: "center",
  },
  emptyText: {
    color: muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },
  resultsHeader: { marginTop: 22, marginBottom: 14 },
  resultsTitle: { color: navy, fontSize: 28, fontWeight: "900" },
  resultsCount: { color: muted, fontSize: 12, fontWeight: "700", marginTop: 4 },
  resultsList: { gap: 14 },
  card: {
    flexDirection: "row",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: "#FFF",
    padding: 12,
  },
  imageBox: {
    width: 112,
    height: 112,
    borderRadius: 18,
    backgroundColor: soft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%", resizeMode: "contain" },
  info: { flex: 1, paddingLeft: 13, justifyContent: "center" },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 7,
  },
  badge: {
    backgroundColor: "#E8F8FB",
    color: navy,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 9,
    fontWeight: "900",
  },
  badgeAmazon: { backgroundColor: "#FFF3D6" },
  badgeEbay: { backgroundColor: "#EEF1F5" },
  condition: { color: muted, fontSize: 10, fontWeight: "700" },
  productTitle: {
    color: navy,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  rating: { color: "#F59E0B", fontSize: 12, fontWeight: "900", marginTop: 6 },
  finalArgentina: {
    color: "#8EA1BB",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 9,
  },
  price: { color: navy, fontSize: 24, fontWeight: "900", marginTop: 2 },
});
