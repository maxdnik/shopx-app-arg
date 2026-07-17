import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AppBottomNav } from "../../components/AppBottomNav";
import { ProductCard } from "../../components/ProductCard";
import {
  getProductsByStore,
  ShopXProduct,
} from "../../lib/api";
import {
  FALLBACK_STORES,
  getOfficialStores,
  ShopXStore,
} from "../../lib/stores";
import {
  canUseRemoteStoreLogo,
  getStoreLogoSource,
  getStoreLogoWordmark,
} from "../../lib/store-logos";
import { openShopXProduct } from "../../lib/product-navigation";

const navy = "#062B4F";
const navyDark = "#031A33";
const text = "#071E35";
const muted = "#718096";
const accent = "#18C7D8";
const soft = "#F7FAFC";
const softCard = "#F1F5F9";
const border = "#E2E8F0";
const white = "#FFFFFF";

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function normalizeStoreSlug(value: string) {
  return String(value || "").trim().toLowerCase();
}

export default function StoreScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const storeSlug = normalizeStoreSlug(getParamValue(params.slug));

  const [store, setStore] = useState<ShopXStore | null>(null);
  const [products, setProducts] = useState<ShopXProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const localLogo = useMemo(
    () => getStoreLogoSource(store?.slug || storeSlug),
    [store?.slug, storeSlug]
  );

  const remoteLogo = useMemo(
    () => canUseRemoteStoreLogo(store?.logo),
    [store?.logo]
  );

  const logoText = useMemo(
    () => getStoreLogoWordmark(store || { name: storeSlug, slug: storeSlug }),
    [store, storeSlug]
  );

  async function loadStorefront(options?: { refresh?: boolean }) {
    if (!storeSlug) {
      setErrorMessage("No encontramos esta tienda.");
      setLoading(false);
      return;
    }

    try {
      if (options?.refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      const [storesResult, productsResult] = await Promise.all([
        getOfficialStores(),
        getProductsByStore(storeSlug, 36),
      ]);

      const matchedStore =
        storesResult.find((item) => item.slug === storeSlug) ||
        FALLBACK_STORES.find((item) => item.slug === storeSlug) ||
        null;

      setStore(matchedStore);
      setProducts(productsResult);
    } catch (error) {
      console.log("ERROR STORE SCREEN:", error);

      const fallbackStore =
        FALLBACK_STORES.find((item) => item.slug === storeSlug) || null;

      setStore(fallbackStore);
      setErrorMessage(
        "No pudimos cargar la tienda ahora. Podés buscar la marca o cotizar un link."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadStorefront();
  }, [storeSlug]);

  function openProduct(product: ShopXProduct) {
  openShopXProduct(product);
}

  function openSearch() {
    router.push({
      pathname: "/search",
      params: { q: store?.searchQuery || store?.name || storeSlug },
    });
  }

  return (
    <View style={styles.app}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadStorefront({ refresh: true })}
            tintColor={accent}
          />
        }
      >
        <View style={styles.headerShell}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.85}
              onPress={() => router.back()}
            >
              <Feather name="chevron-left" size={23} color={white} />
            </TouchableOpacity>

            <View style={styles.headerBadge}>
              <Feather name="shield" size={14} color={accent} />
              <Text style={styles.headerBadgeText}>Tienda oficial USA</Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.storeColorRail} />

            <View style={styles.logoBox}>
              {localLogo ? (
                <Image
                  source={localLogo}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              ) : remoteLogo && store?.logo ? (
                <Image
                  source={{ uri: store.logo }}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.logoWordmark} numberOfLines={2}>
                  {logoText}
                </Text>
              )}
            </View>

            <View style={styles.heroTextBox}>
              <Text style={styles.eyebrow}>SHOPX ACCESS</Text>
              <Text style={styles.title} numberOfLines={2}>
                {store?.name || "Tienda ShopX"}
              </Text>
              <Text style={styles.subtitle}>
                Productos curados de USA con precio final Argentina: impuestos,
                aduana, gestión y entrega incluidos.
              </Text>
            </View>
          </View>

          <View style={styles.trustRow}>
            <View style={styles.trustPill}>
              <MaterialCommunityIcons
                name="cash-check"
                size={17}
                color={accent}
              />
              <Text style={styles.trustText}>Precio final</Text>
            </View>

            <View style={styles.trustPill}>
              <Feather name="truck" size={16} color={accent} />
              <Text style={styles.trustText}>Entrega local</Text>
            </View>

            <View style={styles.trustPill}>
              <Feather name="map-pin" size={16} color={accent} />
              <Text style={styles.trustText}>Tracking</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>CURADO POR SHOPX</Text>
              <Text style={styles.sectionTitle}>Productos disponibles</Text>
            </View>

            <TouchableOpacity
              style={styles.searchButton}
              activeOpacity={0.85}
              onPress={openSearch}
            >
              <Text style={styles.searchButtonText}>Buscar más</Text>
              <Feather name="arrow-up-right" size={15} color={accent} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={accent} />
              <Text style={styles.stateTitle}>Cargando tienda...</Text>
              <Text style={styles.stateText}>
                Estamos preparando los productos con precio final Argentina.
              </Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.stateCard}>
              <View style={styles.stateIconCircle}>
                <Feather name="wifi-off" size={22} color={accent} />
              </View>
              <Text style={styles.stateTitle}>No pudimos cargar todo</Text>
              <Text style={styles.stateText}>{errorMessage}</Text>

              <View style={styles.stateActionsRow}>
                <TouchableOpacity
                  style={styles.primaryAction}
                  activeOpacity={0.9}
                  onPress={openSearch}
                >
                  <Text style={styles.primaryActionText}>Buscar marca</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryAction}
                  activeOpacity={0.9}
                  onPress={() => router.push("/quote")}
                >
                  <Text style={styles.secondaryActionText}>Cotizar link</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : products.length > 0 ? (
            <View style={styles.productsGrid}>
              {products.map((product) => (
                <View
                  key={product.slug || product.id || product._id}
                  style={styles.productColumn}
                >
                  <ProductCard
                    product={product}
                    variant="grid"
                    onPress={() => openProduct(product)}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.stateCard}>
              <View style={styles.stateIconCircle}>
                <Feather name="shopping-bag" size={22} color={accent} />
              </View>
              <Text style={styles.stateTitle}>Todavía no hay productos cargados</Text>
              <Text style={styles.stateText}>
                Podés buscar esta marca en ShopX o pegar un link específico para
                que lo coticemos.
              </Text>

              <View style={styles.stateActionsRow}>
                <TouchableOpacity
                  style={styles.primaryAction}
                  activeOpacity={0.9}
                  onPress={openSearch}
                >
                  <Text style={styles.primaryActionText}>Buscar marca</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryAction}
                  activeOpacity={0.9}
                  onPress={() => router.push("/quote")}
                >
                  <Text style={styles.secondaryActionText}>Cotizar link</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <AppBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: soft,
  },

  screen: {
    flex: 1,
  },

  content: {
    paddingBottom: 104,
  },

  headerShell: {
    backgroundColor: navy,
    paddingTop: 58,
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: "hidden",
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.11)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  headerBadgeText: {
    color: white,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.35,
  },

  heroCard: {
    position: "relative",
    backgroundColor: white,
    borderRadius: 28,
    padding: 18,
    overflow: "hidden",
    shadowColor: navyDark,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },

  storeColorRail: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: accent,
  },

  logoBox: {
    width: 82,
    height: 82,
    borderRadius: 26,
    backgroundColor: softCard,
    borderWidth: 1,
    borderColor: border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  logoImage: {
    width: 62,
    height: 44,
  },

  logoWordmark: {
    color: navy,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.25,
  },

  heroTextBox: {
    maxWidth: "94%",
  },

  eyebrow: {
    color: accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginBottom: 5,
  },

  title: {
    color: text,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  subtitle: {
    color: muted,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 10,
  },

  trustRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },

  trustPill: {
    flex: 1,
    minHeight: 42,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  trustText: {
    color: white,
    fontSize: 10.5,
    fontWeight: "900",
  },

  body: {
    paddingHorizontal: 18,
    paddingTop: 20,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  sectionEyebrow: {
    color: accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.35,
  },

  sectionTitle: {
    color: text,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.45,
    marginTop: 3,
  },

  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingBottom: 3,
  },

  searchButtonText: {
    color: accent,
    fontSize: 13,
    fontWeight: "900",
  },

  productsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  productColumn: {
    width: "48.2%",
  },

  stateCard: {
    backgroundColor: white,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: border,
    padding: 22,
    alignItems: "center",
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  stateIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "#EAF8FB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  stateTitle: {
    color: text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 10,
  },

  stateText: {
    color: muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },

  stateActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },

  primaryAction: {
    minWidth: 118,
    height: 44,
    borderRadius: 15,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  primaryActionText: {
    color: white,
    fontSize: 13,
    fontWeight: "900",
  },

  secondaryAction: {
    minWidth: 118,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#EAF8FB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  secondaryActionText: {
    color: navy,
    fontSize: 13,
    fontWeight: "900",
  },
});
