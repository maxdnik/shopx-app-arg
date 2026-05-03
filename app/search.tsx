import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

function getSourceLabel(source: SearchResult["source"]) {
  if (source === "mongo") return "SHOPX";
  return "EBAY USA";
}

function getFinalPriceUSD(item: SearchResult) {
  const rawItem = item as any;

  const price =
    rawItem.finalPriceUSD ||
    rawItem.pricing?.finalUSD ||
    rawItem.pricing?.totalFinal ||
    rawItem.estimatedUSD ||
    rawItem.priceUSD ||
    0;

  return Number(price) || 0;
}

function getResultImage(item: SearchResult) {
  return item.image || null;
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string }>();

  const [query, setQuery] = useState(
    typeof params.q === "string" ? params.q : ""
  );
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSearch(nextQuery = query) {
    const cleanQuery = nextQuery.trim();

    if (!cleanQuery) return;

    try {
      setLoading(true);
      setSearched(true);
      setErrorMessage("");
      Keyboard.dismiss();

      const data = await searchShopX(cleanQuery);
      setResults(data);
    } catch (error) {
      console.log("ERROR SEARCH:", error);
      setErrorMessage("No pudimos realizar la búsqueda.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof params.q === "string" && params.q.trim()) {
      handleSearch(params.q);
    }
  }, [params.q]);

  const internalCount = useMemo(
    () => results.filter((item) => item.source === "mongo").length,
    [results]
  );

  const ebayCount = useMemo(
    () => results.filter((item) => item.source === "ebay").length,
    [results]
  );

  function openResult(item: SearchResult) {
    if (item.source === "mongo" && item.slug) {
      router.push(`/product/${item.slug}`);
      return;
    }

    router.push({
      pathname: "/ebay-product/[id]",
      params: {
        id: item.id,
        title: item.title,
        priceUSD: String(getFinalPriceUSD(item) || ""),
        image: item.image || "",
        url: item.url || "",
        condition: item.condition || "",
        seller: item.seller || "",
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
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹ Volver</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Buscar en USA</Text>

          <Text style={styles.subtitle}>
            Buscá productos del catálogo ShopX y resultados reales de eBay USA
            con precio final estimado en Argentina.
          </Text>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="MacBook, Nike, Apple Watch..."
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
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={navy} />
            <Text style={styles.loadingText}>Buscando productos...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>⚠️</Text>
            <Text style={styles.emptyTitle}>No se pudo buscar</Text>
            <Text style={styles.emptyText}>{errorMessage}</Text>
          </View>
        ) : !searched ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔎</Text>
            <Text style={styles.emptyTitle}>Buscá cualquier producto</Text>
            <Text style={styles.emptyText}>
              Probá con marcas, modelos o productos específicos. Ejemplo:
              MacBook Pro, Nike Air Force, Apple Watch.
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No encontramos resultados</Text>
            <Text style={styles.emptyText}>
              Probá con otra búsqueda o solicitá una cotización manual.
            </Text>

            <TouchableOpacity
              style={styles.quoteButton}
              onPress={() => router.push("/quote")}
            >
              <Text style={styles.quoteButtonText}>Solicitar cotización</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.resultsHeader}>
              <View>
                <Text style={styles.resultsTitle}>Resultados</Text>
                <Text style={styles.resultsCount}>
                  {results.length} encontrados · {internalCount} ShopX ·{" "}
                  {ebayCount} eBay
                </Text>
              </View>
            </View>

            <View style={styles.resultsList}>
              {results.map((item) => {
                const image = getResultImage(item);
                const finalPriceUSD = getFinalPriceUSD(item);

                return (
                  <TouchableOpacity
                    key={`${item.source}-${item.id}`}
                    style={styles.resultCard}
                    activeOpacity={0.88}
                    onPress={() => openResult(item)}
                  >
                    <View style={styles.imageBox}>
                      {image ? (
                        <Image source={{ uri: image }} style={styles.image} />
                      ) : (
                        <Text style={styles.imageFallback}>📦</Text>
                      )}
                    </View>

                    <View style={styles.resultInfo}>
                      <View style={styles.sourceRow}>
                        <Text
                          style={[
                            styles.sourceBadge,
                            item.source === "ebay" && styles.sourceBadgeEbay,
                          ]}
                        >
                          {getSourceLabel(item.source)}
                        </Text>

                        {!!item.condition ? (
                          <Text style={styles.conditionText}>
                            {item.condition}
                          </Text>
                        ) : null}
                      </View>

                      <Text style={styles.resultTitle} numberOfLines={2}>
                        {item.title}
                      </Text>

                      {!!item.seller ? (
                        <Text style={styles.sellerText} numberOfLines={1}>
                          Vendedor: {item.seller}
                        </Text>
                      ) : null}

                      <Text style={styles.finalArgentina}>FINAL ARGENTINA</Text>

                      <Text style={styles.price}>
                        {finalPriceUSD
                          ? `USD ${formatUSD(finalPriceUSD)}`
                          : "Consultar"}
                      </Text>

                      <Text style={styles.hintText}>
                        {item.source === "ebay"
                          ? "Precio final estimado por ShopX"
                          : "Ver producto ShopX"}
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

const navy = "#082A4D";
const text = "#08294A";
const muted = "#617590";
const accent = "#16C5DF";
const soft = "#F6F8FB";
const border = "#E3EAF2";

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingTop: 58,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 22,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 18,
  },
  backText: {
    color: navy,
    fontSize: 18,
    fontWeight: "900",
  },
  title: {
    color: navy,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  subtitle: {
    color: muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    marginBottom: 18,
  },
  searchBox: {
    minHeight: 58,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 8,
  },
  searchIcon: {
    color: navy,
    fontSize: 28,
    marginRight: 8,
    transform: [{ rotate: "-20deg" }],
  },
  searchInput: {
    flex: 1,
    color: text,
    fontSize: 15,
    fontWeight: "700",
  },
  searchButton: {
    backgroundColor: navy,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  loadingCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: soft,
    padding: 28,
    alignItems: "center",
  },
  loadingText: {
    color: muted,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
  },
  emptyCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: soft,
    padding: 28,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 46,
    marginBottom: 12,
  },
  emptyTitle: {
    color: text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    color: muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  quoteButton: {
    backgroundColor: navy,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 20,
  },
  quoteButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  resultsHeader: {
    marginBottom: 16,
  },
  resultsTitle: {
    color: text,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  resultsCount: {
    color: muted,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  resultsList: {
    gap: 14,
  },
  resultCard: {
    flexDirection: "row",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: "#FFFFFF",
    padding: 12,
    shadowColor: navy,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  imageBox: {
    width: 112,
    height: 112,
    borderRadius: 18,
    backgroundColor: soft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 14,
  },
  image: {
    width: "92%",
    height: "92%",
    resizeMode: "contain",
  },
  imageFallback: {
    fontSize: 42,
  },
  resultInfo: {
    flex: 1,
    minWidth: 0,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 7,
  },
  sourceBadge: {
    overflow: "hidden",
    backgroundColor: "#EAF8FB",
    color: accent,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  sourceBadgeEbay: {
    backgroundColor: "#EEF2FF",
    color: "#173F92",
  },
  conditionText: {
    color: muted,
    fontSize: 11,
    fontWeight: "800",
  },
  resultTitle: {
    color: text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },
  sellerText: {
    color: muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
  },
  finalArgentina: {
    color: "#9AA6B8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 12,
    marginBottom: 3,
  },
  price: {
    color: navy,
    fontSize: 21,
    fontWeight: "900",
  },
  hintText: {
    color: muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
  },
});