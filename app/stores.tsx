import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AppBottomNav } from "../components/AppBottomNav";
import { FALLBACK_STORES, getOfficialStores, ShopXStore } from "../lib/stores";
import {
  canUseRemoteStoreLogo,
  getStoreLogoSource,
  getStoreLogoWordmark,
} from "../lib/store-logos";

const navy = "#062B4F";
const navyDark = "#031A33";
const navyDeep = "#021326";
const text = "#071E35";
const muted = "#718096";
const accent = "#18C7D8";
const soft = "#F7FAFC";
const softCard = "#F1F5F9";
const border = "#E2E8F0";
const white = "#FFFFFF";

function normalizeSearch(value: string) {
  return String(value || "").trim().toLowerCase();
}

function sortStores(stores: ShopXStore[]) {
  return [...stores].sort((a, b) => {
    const aOrder = Number.isFinite(a.sortOrder as number) ? Number(a.sortOrder) : 999;
    const bOrder = Number.isFinite(b.sortOrder as number) ? Number(b.sortOrder) : 999;

    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

export default function StoresScreen() {
  const [stores, setStores] = useState<ShopXStore[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const filteredStores = useMemo(() => {
    const cleanQuery = normalizeSearch(query);
    const orderedStores = sortStores(stores.length > 0 ? stores : FALLBACK_STORES);

    if (!cleanQuery) return orderedStores;

    return orderedStores.filter((store) => {
      const haystack = normalizeSearch(
        [store.name, store.slug, store.searchQuery].filter(Boolean).join(" ")
      );

      return haystack.includes(cleanQuery);
    });
  }, [query, stores]);

  async function loadStores(options?: { refresh?: boolean }) {
    try {
      if (options?.refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      const result = await getOfficialStores();
      setStores(sortStores(result));
    } catch (error) {
      console.log("ERROR STORES SCREEN:", error);
      setStores(FALLBACK_STORES);
      setErrorMessage(
        "No pudimos actualizar las tiendas ahora. Te mostramos las principales tiendas disponibles."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadStores();
  }, []);

  function openStore(store: ShopXStore) {
    if (!store?.slug) return;

    router.push({
      pathname: "/store/[slug]",
      params: { slug: store.slug },
    });
  }

  return (
    <View style={styles.app}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadStores({ refresh: true })}
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
              <Text style={styles.headerBadgeText}>SHOPX ACCESS</Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />

            <View style={styles.heroIconBox}>
              <MaterialCommunityIcons name="storefront-outline" size={34} color={navy} />
            </View>

            <Text style={styles.eyebrow}>TIENDAS OFICIALES</Text>
            <Text style={styles.title}>Comprá en las mejores tiendas de USA</Text>
            <Text style={styles.subtitle}>
              Accedé a marcas curadas por ShopX con precio final Argentina,
              impuestos, aduana, gestión y entrega incluidos.
            </Text>

            <View style={styles.trustRow}>
              <View style={styles.trustPill}>
                <MaterialCommunityIcons name="cash-check" size={17} color={accent} />
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
        </View>

        <View style={styles.body}>
          <View style={styles.searchCard}>
            <Feather name="search" size={21} color="#64748B" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar tienda o marca..."
              placeholderTextColor="#95A3B8"
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />

            {query.length > 0 ? (
              <TouchableOpacity style={styles.clearButton} onPress={() => setQuery("")}>
                <Text style={styles.clearText}>×</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {errorMessage ? (
            <View style={styles.noticeCard}>
              <Feather name="info" size={16} color={accent} />
              <Text style={styles.noticeText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>CURADO POR SHOPX</Text>
              <Text style={styles.sectionTitle}>Todas las tiendas</Text>
            </View>

            <Text style={styles.storeCount}>{filteredStores.length}</Text>
          </View>

          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={accent} />
              <Text style={styles.stateTitle}>Cargando tiendas...</Text>
              <Text style={styles.stateText}>
                Estamos preparando el acceso a marcas oficiales de USA.
              </Text>
            </View>
          ) : filteredStores.length > 0 ? (
            <View style={styles.storesGrid}>
              {filteredStores.map((store) => {
                const localLogo = getStoreLogoSource(store.slug);
                const remoteLogo = canUseRemoteStoreLogo(store.logo);
                const logoText = getStoreLogoWordmark(store);

                return (
                  <TouchableOpacity
                    key={store.slug}
                    style={styles.storeCard}
                    activeOpacity={0.9}
                    onPress={() => openStore(store)}
                  >
                    <View style={styles.storeColorRail} />

                    <View style={styles.storeTopRow}>
                      <View style={styles.logoBox}>
                        {localLogo ? (
                          <Image
                            source={localLogo}
                            style={styles.logoImage}
                            resizeMode="contain"
                          />
                        ) : remoteLogo ? (
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

                      <View style={styles.arrowCircle}>
                        <Feather name="arrow-up-right" size={16} color={accent} />
                      </View>
                    </View>

                    <Text style={styles.storeName} numberOfLines={1}>
                      {store.name}
                    </Text>
                    <Text style={styles.storeSubtitle}>Tienda oficial USA</Text>

                    <View style={styles.storeFooter}>
                      <Feather name="shield" size={13} color={accent} />
                      <Text style={styles.storeFooterText}>ShopX verified</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.stateCard}>
              <View style={styles.stateIconCircle}>
                <Feather name="search" size={22} color={accent} />
              </View>
              <Text style={styles.stateTitle}>No encontramos esa tienda</Text>
              <Text style={styles.stateText}>
                Probá con otra marca o pegá un link para que lo coticemos.
              </Text>

              <TouchableOpacity
                style={styles.primaryAction}
                activeOpacity={0.9}
                onPress={() => router.push("/quote")}
              >
                <Text style={styles.primaryActionText}>Cotizar link</Text>
              </TouchableOpacity>
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
    letterSpacing: 0.6,
  },

  heroCard: {
    position: "relative",
    backgroundColor: navyDeep,
    borderRadius: 28,
    padding: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  heroGlow: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    right: -72,
    top: -92,
    backgroundColor: "rgba(24,199,216,0.22)",
  },

  heroIconBox: {
    width: 68,
    height: 68,
    borderRadius: 23,
    backgroundColor: white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: navyDark,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  eyebrow: {
    color: accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.7,
    marginBottom: 7,
  },

  title: {
    color: white,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: "900",
    letterSpacing: -0.8,
    maxWidth: "92%",
  },

  subtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 10,
    maxWidth: "94%",
  },

  trustRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },

  trustPill: {
    flex: 1,
    minHeight: 42,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
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
    paddingTop: 18,
  },

  searchCard: {
    minHeight: 58,
    borderRadius: 21,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  searchInput: {
    flex: 1,
    color: text,
    fontSize: 15,
    fontWeight: "800",
    paddingVertical: 12,
  },

  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: softCard,
    alignItems: "center",
    justifyContent: "center",
  },

  clearText: {
    color: muted,
    fontSize: 23,
    lineHeight: 25,
    fontWeight: "800",
  },

  noticeCard: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: "#EAF8FB",
    borderWidth: 1,
    borderColor: "rgba(24,199,216,0.22)",
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  noticeText: {
    flex: 1,
    color: navy,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "800",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 20,
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
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.45,
    marginTop: 3,
  },

  storeCount: {
    minWidth: 36,
    height: 32,
    borderRadius: 13,
    backgroundColor: "#EAF8FB",
    color: navy,
    textAlign: "center",
    textAlignVertical: "center",
    paddingTop: 7,
    overflow: "hidden",
    fontSize: 13,
    fontWeight: "900",
  },

  storesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  storeCard: {
    position: "relative",
    width: "48.2%",
    minHeight: 178,
    borderRadius: 24,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 14,
    overflow: "hidden",
    shadowColor: navy,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  storeColorRail: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: accent,
  },

  storeTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 14,
  },

  logoBox: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: softCard,
    borderWidth: 1,
    borderColor: border,
    alignItems: "center",
    justifyContent: "center",
  },

  logoImage: {
    width: 45,
    height: 34,
  },

  logoWordmark: {
    color: navy,
    fontSize: 13,
    lineHeight: 15,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.2,
  },

  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 13,
    backgroundColor: "#EAF8FB",
    alignItems: "center",
    justifyContent: "center",
  },

  storeName: {
    color: text,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.25,
  },

  storeSubtitle: {
    color: muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    marginTop: 4,
  },

  storeFooter: {
    marginTop: "auto",
    paddingTop: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  storeFooterText: {
    color: navy,
    fontSize: 11,
    fontWeight: "900",
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

  primaryAction: {
    minWidth: 136,
    height: 45,
    borderRadius: 15,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 18,
  },

  primaryActionText: {
    color: white,
    fontSize: 13,
    fontWeight: "900",
  },
});
