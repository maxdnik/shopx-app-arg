import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { AppBottomNav } from "../../components/AppBottomNav";
import { ProductCard } from "../../components/ProductCard";
import { useCartCount } from "../../hooks/useCartCount";
import { useFavorites } from "../../hooks/useFavorites";
import { useUnreadNotificationsCount } from "../../hooks/useNotifications";
import {
  formatUSD,
  getDisplayFinalPriceUSD,
  getProductImage,
  getHomeSections,
  getProducts,
  getWeeklyMostRequestedProducts,
  HomeSectionsResponse,
  searchProducts,
  ShopXProduct,
} from "../../lib/api";
import { saveProductToCache } from "../../lib/product-cache";
import { getAppAccount, getStoredUser, ShopXUser } from "../../lib/auth";
import { getOfficialStores, ShopXStore } from "../../lib/stores";
import {
  canUseRemoteStoreLogo,
  getStoreLogoSource,
  getStoreLogoWordmark,
} from "../../lib/store-logos";

const navy = "#062B4F";
const navyDark = "#031A33";
const navyDeep = "#021326";
const text = "#071E35";
const muted = "#718096";
const accent = "#18C7D8";
const soft = "#F7FAFC";
const border = "#E2E8F0";
const white = "#FFFFFF";
const yellow = "#F6C343";

const categories = [
  { icon: "view-grid-outline", label: "Todo", type: "material" },
  { icon: "headphones", label: "Tecnología", type: "feather" },
  { icon: "sofa-outline", label: "Hogar", type: "material" },
  { icon: "tshirt-crew-outline", label: "Moda", type: "material" },
  { icon: "watch-variant", label: "Relojes", type: "material" },
  { icon: "shoe-sneaker", label: "Deportes", type: "material" },
];

const HOME_PRODUCTS_LOAD_LIMIT = 60;

const EMPTY_HOME_SECTIONS: HomeSectionsResponse = {
  clothing: [],
  technology: [],
  toys: [],
  outdoor: [],
};

const homeCategorySections = [
  { key: "clothing" as const, title: "Ropa", viewAllText: "Ver ropa", categoryParam: "Moda" },
  { key: "technology" as const, title: "Tecnología", viewAllText: "Ver tecnología", categoryParam: "Tecnología" },
  { key: "toys" as const, title: "Juguetes", viewAllText: "Ver juguetes", categoryParam: "Juguetes" },
  { key: "outdoor" as const, title: "Outdoor", viewAllText: "Ver outdoor", categoryParam: "Deportes" },
];

function getProductSlug(product: ShopXProduct) {
  return product.slug || product._id || product.id || product.externalId || "";
}

function isEbayProduct(product: ShopXProduct) {
  const source = String(product.source || "").toLowerCase();
  const store = String(product.store || "").toLowerCase();
  const sourceUrl = String(product.sourceUrl || "").toLowerCase();

  return (
    source.includes("ebay") ||
    store.includes("ebay") ||
    sourceUrl.includes("ebay.com")
  );
}

function openProduct(product: ShopXProduct) {
  const slug = getProductSlug(product);
  if (!slug) return;

  saveProductToCache(product);

  const pathname = isEbayProduct(product)
    ? `/ebay-product/${encodeURIComponent(slug)}`
    : `/product/${encodeURIComponent(slug)}`;

  router.push(pathname as any);
}

function getUserCity(user: ShopXUser | null) {
  const city = user?.address?.city || user?.billing?.city || "";
  return String(city || "").trim();
}

function getUserProvince(user: ShopXUser | null) {
  const province = user?.address?.province || user?.billing?.province || "";
  return String(province || "").trim();
}

function buildDeliveryLabel(user: ShopXUser | null) {
  const city = getUserCity(user);
  const province = getUserProvince(user);

  if (!city) return "";

  return [city, province].filter(Boolean).join(", ");
}

function CategoryIcon({
  icon,
  type,
  active,
}: {
  icon: string;
  type: string;
  active: boolean;
}) {
  const color = active ? white : navy;

  if (type === "feather") {
    return <Feather name={icon as any} size={22} color={color} />;
  }

  return <MaterialCommunityIcons name={icon as any} size={25} color={color} />;
}


function sortProductsByWeeklyPickOrder(products: ShopXProduct[]) {
  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => {
      const aOrder = Number(a.product.weeklyPickOrder);
      const bOrder = Number(b.product.weeklyPickOrder);
      const aHasOrder = Number.isFinite(aOrder);
      const bHasOrder = Number.isFinite(bOrder);

      if (aHasOrder && bHasOrder && aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      if (aHasOrder && !bHasOrder) return -1;
      if (!aHasOrder && bHasOrder) return 1;

      return a.index - b.index;
    })
    .map(({ product }) => product);
}



export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const cartCount = useCartCount();
  const { favoritesCount } = useFavorites();
  const { unreadCount } = useUnreadNotificationsCount({ seedDemo: false });

  const [products, setProducts] = useState<ShopXProduct[]>([]);
  const [weeklyProducts, setWeeklyProducts] = useState<ShopXProduct[]>([]);
  const [homeSections, setHomeSections] = useState<HomeSectionsResponse>(EMPTY_HOME_SECTIONS);
  const [homeSectionsLoading, setHomeSectionsLoading] = useState(true);
  const [stores, setStores] = useState<ShopXStore[]>([]);
  const [searchResults, setSearchResults] = useState<ShopXProduct[]>([]);
  const [homeSearch, setHomeSearch] = useState("");
  const [deliveryLabel, setDeliveryLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchError, setSearchError] = useState("");

  const isSearching = homeSearch.trim().length > 0;

  async function loadStores() {
    try {
      const result = await getOfficialStores();
      setStores(result);
    } catch (error) {
      console.log("ERROR HOME STORES:", error);
      setStores([]);
    }
  }

  function openStore(store: ShopXStore) {
    if (!store?.slug) return;

    router.push({
      pathname: "/store/[slug]",
      params: { slug: store.slug },
    });
  }


  async function loadProducts() {
    setLoading(true);
    setHomeSectionsLoading(true);
    setErrorMessage("");

    try {
      const [result, weeklyResult, sectionsResult] = await Promise.all([
        getProducts(HOME_PRODUCTS_LOAD_LIMIT),
        getWeeklyMostRequestedProducts(10).catch((error) => {
          console.log("ERROR HOME WEEKLY PRODUCTS:", error);
          return [] as ShopXProduct[];
        }),
        getHomeSections().catch((error) => {
          console.log("ERROR HOME CURATED SECTIONS:", error);
          return EMPTY_HOME_SECTIONS;
        }),
      ]);

      setProducts(result);
      setWeeklyProducts(weeklyResult);
      setHomeSections(sectionsResult);
    } catch (error) {
      console.log("ERROR HOME PRODUCTS:", error);
      setErrorMessage("No pudimos cargar los productos.");
    } finally {
      setLoading(false);
      setHomeSectionsLoading(false);
    }
  }

  async function loadDeliveryProfile() {
    try {
      const storedUser = await getStoredUser();
      const storedLabel = buildDeliveryLabel(storedUser);

      setDeliveryLabel(storedLabel || "");

      if (!storedUser) return;

      try {
        const account = await getAppAccount();
        const freshLabel = buildDeliveryLabel(account.user);
        setDeliveryLabel(freshLabel || "");
      } catch (error) {
        console.log("ERROR HOME DELIVERY PROFILE:", error);
      }
    } catch (error) {
      console.log("ERROR HOME STORED DELIVERY PROFILE:", error);
      setDeliveryLabel("");
    }
  }

  useEffect(() => {
    loadProducts();
    loadStores();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDeliveryProfile();
    }, []),
  );

  useEffect(() => {
    const cleanQuery = homeSearch.trim();

    if (!cleanQuery) {
      setSearchResults([]);
      setSearchError("");
      setSearchLoading(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");

      try {
        const result = await searchProducts(cleanQuery);
        setSearchResults(result);
      } catch (error) {
        console.log("ERROR HOME SEARCH:", error);
        setSearchResults([]);
        setSearchError("No pudimos buscar productos en este momento.");
      }

      setSearchLoading(false);
    }, 400);

    return () => clearTimeout(timeout);
  }, [homeSearch]);

  const databaseProducts = useMemo(
    () => products.filter((product) => !isEbayProduct(product)),
    [products],
  );

  const mostRequestedProducts = useMemo(() => {
    const internalWeeklyProducts = weeklyProducts.filter(
      (product) => !isEbayProduct(product),
    );

    if (internalWeeklyProducts.length > 0) {
      return sortProductsByWeeklyPickOrder(internalWeeklyProducts).slice(0, 10);
    }

    return databaseProducts.slice(0, 10);
  }, [databaseProducts, weeklyProducts]);

  const categorySections = useMemo(
    () =>
      homeCategorySections.map((section) => ({
        ...section,
        products: homeSections[section.key] || [],
      })),
    [homeSections],
  );
  const heroProduct = databaseProducts[0];
  const visibleProducts = searchResults;
  const heroImage = heroProduct ? getProductImage(heroProduct) : "";
  const locationText = deliveryLabel || "Configurar ubicación";

  return (
    <View style={styles.app}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.topArea, { paddingTop: insets.top + 10 }]}>
          <View style={styles.cleanHeader}>
            <Image
              source={require("../../assets/images/shopx-logo-horizontal.png")}
              style={styles.cleanLogo}
              resizeMode="contain"
            />

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.notificationButton}
                activeOpacity={0.9}
                onPress={() => router.push("/notifications")}
              >
                <Ionicons name="notifications-outline" size={19} color={text} />

                {unreadCount > 0 ? (
                  <View style={styles.notificationDot} />
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.favoriteHeaderButton,
                  favoritesCount > 0 && styles.favoriteHeaderButtonActive,
                ]}
                activeOpacity={0.9}
                onPress={() => router.push("/favorites")}
              >
                <Feather
                  name="heart"
                  size={19}
                  color={favoritesCount > 0 ? white : text}
                />

                {favoritesCount > 0 ? (
                  <View style={styles.favoriteBadge}>
                    <Text style={styles.favoriteBadgeText}>
                      {favoritesCount > 99 ? "99+" : favoritesCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cartButton}
                activeOpacity={0.9}
                onPress={() => router.push("/cart")}
              >
                <Feather name="shopping-cart" size={20} color={white} />

                {cartCount > 0 ? (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>
                      {cartCount > 99 ? "99+" : cartCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.searchLocationCard}>
            <View style={styles.cyanAccent} />

            <View style={styles.searchLocationRow}>
              <Feather name="search" size={23} color="#64748B" />

              <TextInput
                value={homeSearch}
                onChangeText={setHomeSearch}
                placeholder="Buscar productos, marcas..."
                placeholderTextColor="#95A3B8"
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />

              {homeSearch.length > 0 ? (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setHomeSearch("")}
                >
                  <Text style={styles.clearSearch}>×</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.integratedDivider} />

            <TouchableOpacity
              style={styles.deliveryRow}
              activeOpacity={0.9}
              onPress={() => router.push("/profile")}
            >
              <Feather name="map-pin" size={19} color={text} />

              <Text style={styles.deliveryText} numberOfLines={1}>
                Enviar a:{" "}
                <Text style={styles.deliveryStrong}>{locationText}</Text>
              </Text>

              <Feather name="chevron-down" size={17} color={text} />
            </TouchableOpacity>
          </View>

          {!isSearching && (
            <>
              <View style={styles.benefitStrip}>
                <View style={styles.benefitStripItem}>
                  <View style={styles.benefitStripIcon}>
                    <MaterialCommunityIcons
                      name="currency-usd"
                      size={21}
                      color={navy}
                    />
                  </View>

                  <View style={styles.benefitTextBox}>
                    <Text style={styles.benefitMain}>Precio final</Text>
                    <Text style={styles.benefitAccent}>en pesos</Text>
                  </View>
                </View>

                <View style={styles.benefitVerticalDivider} />

                <View style={styles.benefitStripItem}>
                  <View style={styles.benefitStripIcon}>
                    <MaterialCommunityIcons
                      name="truck-delivery-outline"
                      size={23}
                      color={navy}
                    />
                  </View>

                  <View style={styles.benefitTextBox}>
                    <Text style={styles.benefitMain}>Entrega</Text>
                    <Text style={styles.benefitAccent}>5–10 días</Text>
                  </View>
                </View>

                <View style={styles.benefitVerticalDivider} />

                <View style={styles.benefitStripItem}>
                  <View style={styles.benefitStripIcon}>
                    <MaterialCommunityIcons
                      name="shield-check-outline"
                      size={23}
                      color={navy}
                    />
                  </View>

                  <View style={styles.benefitTextBox}>
                    <Text style={styles.benefitMain}>Compra</Text>
                    <Text style={styles.benefitAccent}>protegida</Text>
                  </View>
                </View>
              </View>

              {stores.length > 0 ? (
                <View style={styles.storesBlock}>
                  <View style={styles.storesHeader}>
                    <View>
                      <Text style={styles.storesEyebrow}>SHOPX ACCESS</Text>
                      <Text style={styles.storesTitle}>Tiendas oficiales</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.storesViewAllButton}
                      activeOpacity={0.85}
                      onPress={() => router.push("/stores")}
                    >
                      <Text style={styles.storesViewAllText}>Ver todas</Text>
                      <Feather name="arrow-up-right" size={15} color={accent} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.storesRow}
                  >
                    {stores.map((store) => {
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
                          <View style={styles.storeAccent} />

                          <View style={styles.storeLogoBox}>
                            {localLogo ? (
                              <Image
                                source={localLogo}
                                style={styles.storeLogo}
                                resizeMode="contain"
                              />
                            ) : remoteLogo ? (
                              <Image
                                source={{ uri: store.logo }}
                                style={styles.storeLogo}
                                resizeMode="contain"
                              />
                            ) : (
                              <Text
                                style={styles.storeWordmark}
                                numberOfLines={2}
                              >
                                {logoText}
                              </Text>
                            )}
                          </View>

                          <Text style={styles.storeName} numberOfLines={1}>
                            {store.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesRow}
              >
                {categories.map((category, index) => {
                  const active = index === 0;

                  return (
                    <TouchableOpacity
                      key={category.label}
                      style={styles.categoryItem}
                      activeOpacity={0.9}
                      onPress={() =>
                        router.push({
                          pathname: "/categories",
                          params: { category: category.label },
                        })
                      }
                    >
                      <View
                        style={[
                          styles.categoryIcon,
                          active && styles.categoryIconActive,
                        ]}
                      >
                        <CategoryIcon
                          icon={category.icon}
                          type={category.type}
                          active={active}
                        />
                      </View>

                      <Text
                        style={[
                          styles.categoryLabel,
                          active && styles.categoryLabelActive,
                        ]}
                        numberOfLines={1}
                      >
                        {category.label}
                      </Text>

                      {active && <View style={styles.activeUnderline} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => {
                  if (heroProduct) {
                    openProduct(heroProduct);
                  } else {
                    router.push("/categories");
                  }
                }}
              >
                <LinearGradient
                  colors={[navyDeep, navyDark, "#083B69"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCard}
                >
                  <View style={styles.heroLeft}>
                    <View style={styles.heroPill}>
                      <Text style={styles.heroFlag}>🇺🇸</Text>
                      <Text style={styles.heroPillText}>Comprá en USA</Text>
                    </View>

                    <Text style={styles.heroTitle}>
                      Comprá en USA.{"\n"}
                      Recibí en <Text style={styles.heroAccent}>Argentina</Text>
                    </Text>

                    <Text style={styles.heroSubtitle}>
                      Productos originales, precio final y seguimiento real.
                    </Text>

                    <TouchableOpacity
                      style={styles.heroButton}
                      onPress={() => router.push("/categories")}
                    >
                      <Text style={styles.heroButtonText}>Ver productos</Text>
                      <Feather name="arrow-right" size={18} color={text} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.heroProduct}>
                    <Text style={styles.heroProductLabel} numberOfLines={2}>
                      {heroProduct?.title || 'MacBook Pro 16"'}
                    </Text>

                    <Text style={styles.heroProductPrice}>
                      {heroProduct
                        ? `USD ${formatUSD(
                            getDisplayFinalPriceUSD(heroProduct),
                          )}`
                        : "USD 2,499"}
                    </Text>

                    <View style={styles.starsRow}>
                      <Text style={styles.stars}>★ ★ ★ ★ ◐</Text>
                      <Text style={styles.reviews}>(128)</Text>
                    </View>

                    <View style={styles.productVisual}>
                      {heroImage ? (
                        <Image
                          source={{ uri: heroImage }}
                          style={styles.heroProductImage}
                        />
                      ) : (
                        <Image
                          source={{
                            uri: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp16-spaceblack-select-202410",
                          }}
                          style={styles.heroProductImage}
                        />
                      )}
                    </View>

                    <View style={styles.heroDots}>
                      <View style={styles.dotActive} />
                      <View style={styles.dot} />
                      <View style={styles.dot} />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>

        {isSearching ? (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIcon}>
                  <Feather name="search" size={17} color={white} />
                </View>

                <Text
                  style={styles.sectionTitle}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                >
                  {`Resultados para "${homeSearch}"`}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => setHomeSearch("")}
              >
                <Text style={styles.viewAll}>Limpiar</Text>
                <Feather name="chevron-right" size={22} color={accent} />
              </TouchableOpacity>
            </View>

            {searchLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={navy} />
                <Text style={styles.loadingText}>Buscando productos...</Text>
              </View>
            ) : searchError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>
                  No pudimos buscar productos
                </Text>
                <Text style={styles.errorText}>{searchError}</Text>

                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    const currentSearch = homeSearch;
                    setHomeSearch("");
                    setTimeout(() => setHomeSearch(currentSearch), 80);
                  }}
                >
                  <Text style={styles.retryButtonText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : visibleProducts.length === 0 ? (
              <View style={styles.emptySearchBox}>
                <Feather name="search" size={42} color={muted} />
                <Text style={styles.emptySearchTitle}>
                  No encontramos productos
                </Text>
                <Text style={styles.emptySearchText}>
                  Probá buscar por marca, modelo o categoría.
                </Text>
              </View>
            ) : (
              <View style={styles.productsGrid}>
                {visibleProducts.map((product, index) => {
                  const key =
                    product._id ||
                    product.id ||
                    product.slug ||
                    `${product.title}-${index}`;

                  return (
                    <View key={key} style={styles.productGridItem}>
                      <ProductCard
                        product={product}
                        variant="deal"
                        onPress={() => openProduct(product)}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIcon}>
                  <Feather name="trending-up" size={17} color={white} />
                </View>

                <Text style={styles.sectionTitle} numberOfLines={2}>
                  Lo más pedido de esta semana
                </Text>
              </View>

              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => router.push("/categories")}
              >
                <Text style={styles.viewAll}>Ver todos</Text>
                <Feather name="chevron-right" size={22} color={accent} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={navy} />
                <Text style={styles.loadingText}>Cargando productos...</Text>
              </View>
            ) : errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>
                  No pudimos cargar productos
                </Text>
                <Text style={styles.errorText}>{errorMessage}</Text>

                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={loadProducts}
                >
                  <Text style={styles.retryButtonText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : mostRequestedProducts.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalProductsRow}
              >
                {mostRequestedProducts.map((product, index) => {
                  const key =
                    product._id ||
                    product.id ||
                    product.slug ||
                    `most-requested-${product.title}-${index}`;

                  return (
                    <View key={key} style={styles.horizontalProductItem}>
                      <ProductCard
                        product={product}
                        variant="deal"
                        onPress={() => openProduct(product)}
                      />
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.emptySearchBox}>
                <Feather name="shopping-bag" size={42} color={muted} />
                <Text style={styles.emptySearchTitle}>
                  No hay productos disponibles
                </Text>
                <Text style={styles.emptySearchText}>
                  Volvé a intentar en unos minutos.
                </Text>
              </View>
            )}

            <LinearGradient
              colors={[navyDark, navy]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quoteBanner}
            >
              <View style={styles.quoteIcon}>
                <Feather name="link" size={24} color={navy} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.quoteTitle}>¿Viste algo en USA?</Text>
                <Text style={styles.quoteText}>
                  Pegá el link y te cotizamos el precio final en Argentina.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.quoteButton}
                onPress={() => router.push("/quote")}
              >
                <Text style={styles.quoteButtonText}>Cotizar</Text>
              </TouchableOpacity>
            </LinearGradient>

            {categorySections.map((section) => (
              <View key={section.title} style={styles.homeCategoryBlock}>
                <View style={styles.sectionHeaderSimple}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>

                  <TouchableOpacity
                    style={styles.viewAllButton}
                    onPress={() =>
                      router.push({
                        pathname: "/categories",
                        params: { category: section.categoryParam },
                      })
                    }
                  >
                    <Text style={styles.viewAll}>{section.viewAllText}</Text>
                    <Feather name="chevron-right" size={22} color={accent} />
                  </TouchableOpacity>
                </View>

                {homeSectionsLoading && section.products.length === 0 ? (
                  <View style={styles.loadingBoxCompact}>
                    <ActivityIndicator color={navy} />
                    <Text style={styles.loadingText}>Cargando {section.title.toLowerCase()}...</Text>
                  </View>
                ) : section.products.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalProductsRow}
                  >
                    {section.products.map((product, index) => {
                      const key =
                        product._id ||
                        product.id ||
                        product.slug ||
                        `${section.title}-${product.title}-${index}`;

                      return (
                        <View key={key} style={styles.horizontalProductItem}>
                          <ProductCard
                            product={product}
                            variant="deal"
                            onPress={() => openProduct(product)}
                          />
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <View style={styles.emptyCategoryBox}>
                    <Text style={styles.emptyCategoryText}>
                      Todavía no seleccionaste productos para esta sección desde el panel de administración.
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        <View style={{ height: 145 }} />
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
    backgroundColor: soft,
  },

  content: {
    paddingBottom: 0,
  },

  topArea: {
    paddingHorizontal: 18,
    paddingBottom: 4,
    backgroundColor: soft,
  },

  cleanHeader: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cleanLogo: {
    width: 132,
    height: 40,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: "#DDE7F0",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",

    shadowColor: navy,
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  notificationDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: accent,
  },

  favoriteHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: "#DDE7F0",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",

    shadowColor: navy,
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  favoriteHeaderButtonActive: {
    backgroundColor: accent,
    borderColor: accent,
    shadowColor: accent,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  favoriteBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: soft,
  },

  favoriteBadgeText: {
    color: white,
    fontSize: 10,
    fontWeight: "900",
  },

  cartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",

    shadowColor: navy,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  cartBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: soft,
  },

  cartBadgeText: {
    color: white,
    fontSize: 10,
    fontWeight: "900",
  },

  searchLocationCard: {
    marginTop: 5,
    minHeight: 116,
    borderRadius: 24,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: "#DDE7F0",
    overflow: "hidden",

    shadowColor: navy,
    shadowOpacity: 0.055,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },

  cyanAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: accent,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },

  searchLocationRow: {
    minHeight: 59,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 21,
    paddingRight: 15,
  },

  searchInput: {
    flex: 1,
    color: text,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 11,
    paddingVertical: 0,
  },

  clearButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  clearSearch: {
    color: "#8FA0B6",
    fontSize: 28,
    fontWeight: "900",
  },

  integratedDivider: {
    height: 1,
    backgroundColor: "#E6ECF2",
    marginLeft: 21,
    marginRight: 21,
  },

  deliveryRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 21,
    paddingRight: 17,
  },

  deliveryText: {
    flex: 1,
    marginLeft: 11,
    color: muted,
    fontSize: 13,
    fontWeight: "700",
  },

  deliveryStrong: {
    color: text,
    fontWeight: "900",
  },

  benefitStrip: {
    marginTop: 17,
    minHeight: 72,
    borderRadius: 22,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: "#E0E8F0",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",

    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  benefitStripItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  benefitStripIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  benefitTextBox: {
    minWidth: 0,
  },

  benefitMain: {
    color: text,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "800",
  },

  benefitAccent: {
    color: accent,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "900",
  },

  benefitVerticalDivider: {
    width: 1,
    height: 38,
    backgroundColor: "#DDE6EF",
  },

  storesBlock: {
    marginTop: 17,
  },

  storesHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  storesEyebrow: {
    color: accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  storesTitle: {
    marginTop: 3,
    color: text,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.45,
  },

  storesViewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingBottom: 3,
  },

  storesViewAllText: {
    color: accent,
    fontSize: 13,
    fontWeight: "900",
  },

  storesRow: {
    gap: 12,
    paddingLeft: 1,
    paddingRight: 18,
    paddingBottom: 4,
  },

  storeCard: {
    width: 126,
    minHeight: 116,
    borderRadius: 24,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: "#DDE7F0",
    padding: 13,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: navy,
    shadowOpacity: 0.055,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },

  storeAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: accent,
  },

  storeLogoBox: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E7EEF5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
    marginBottom: 12,
    alignSelf: "center",
  },

  storeLogo: {
    width: 45,
    height: 32,
  },

  storeWordmark: {
    color: navy,
    fontSize: 13,
    lineHeight: 15,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.2,
  },

  storeName: {
    color: text,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    width: "100%",
  },

  storeSubtitle: {
    marginTop: 3,
    color: muted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
  },

  categoriesRow: {
    paddingTop: 21,
    paddingBottom: 12,
    gap: 14,
  },

  categoryItem: {
    width: 62,
    alignItems: "center",
    position: "relative",
    paddingBottom: 10,
  },

  categoryIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: "#DDE7F0",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  categoryIconActive: {
    backgroundColor: navy,
    borderColor: navy,
    shadowOpacity: 0.13,
  },

  categoryLabel: {
    marginTop: 8,
    color: "#667995",
    fontSize: 11.5,
    fontWeight: "800",
  },

  categoryLabelActive: {
    color: text,
    fontWeight: "900",
  },

  activeUnderline: {
    position: "absolute",
    bottom: 0,
    width: 42,
    height: 3,
    borderRadius: 99,
    backgroundColor: accent,
  },

  heroCard: {
    marginTop: 12,
    minHeight: 255,
    borderRadius: 26,
    padding: 16,
    flexDirection: "row",
    overflow: "hidden",
    shadowColor: navy,
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  heroLeft: {
    flex: 1,
    justifyContent: "space-between",
    zIndex: 2,
    paddingRight: 8,
  },

  heroPill: {
    alignSelf: "flex-start",
    height: 26,
    borderRadius: 99,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 130,
  },

  heroFlag: {
    fontSize: 13,
  },

  heroPillText: {
    color: white,
    fontSize: 11,
    fontWeight: "700",
  },

  heroTitle: {
    marginTop: 10,
    color: white,
    fontSize: 23,
    lineHeight: 26,
    fontWeight: "900",
    letterSpacing: -0.7,
  },

  heroAccent: {
    color: accent,
  },

  heroSubtitle: {
    marginTop: 10,
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },

  heroButton: {
    marginTop: 14,
    width: 132,
    height: 40,
    borderRadius: 14,
    backgroundColor: white,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  heroButtonText: {
    color: text,
    fontSize: 13,
    fontWeight: "900",
  },

  heroProduct: {
    width: 145,
    borderRadius: 22,
    borderWidth: 1.4,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 12,
    alignSelf: "center",
  },

  heroProductLabel: {
    color: white,
    fontSize: 13,
    fontWeight: "900",
  },

  heroProductPrice: {
    marginTop: 5,
    color: accent,
    fontSize: 15,
    fontWeight: "900",
  },

  starsRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  stars: {
    color: yellow,
    fontSize: 10,
    fontWeight: "900",
  },

  reviews: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    fontWeight: "700",
  },

  productVisual: {
    marginTop: 11,
    height: 88,
    borderRadius: 9,
    backgroundColor: white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  heroProductImage: {
    width: "95%",
    height: "95%",
    resizeMode: "contain",
  },

  heroDots: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
  },

  dotActive: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: accent,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.35)",
  },

  sectionHeader: {
    paddingHorizontal: 22,
    marginTop: 24,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  sectionHeaderSimple: {
    paddingHorizontal: 22,
    marginTop: 30,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    gap: 12,
  },

  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: accent,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: {
    flex: 1,
    color: text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  viewAllButton: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
  },

  viewAll: {
    color: accent,
    fontSize: 15,
    fontWeight: "900",
  },


  loadingBoxCompact: {
    minHeight: 92,
    marginHorizontal: 18,
    borderRadius: 20,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: "#E3EBF3",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  emptyCategoryBox: {
    marginHorizontal: 18,
    padding: 18,
    borderRadius: 20,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: "#E3EBF3",
  },

  emptyCategoryText: {
    color: muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  loadingBox: {
    marginHorizontal: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: white,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: muted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10,
  },

  errorBox: {
    marginHorizontal: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: white,
    padding: 24,
  },

  errorTitle: {
    color: text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },

  errorText: {
    color: muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },

  retryButton: {
    alignSelf: "flex-start",
    backgroundColor: navy,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },

  retryButtonText: {
    color: white,
    fontWeight: "900",
    fontSize: 14,
  },

  emptySearchBox: {
    marginHorizontal: 22,
    borderRadius: 24,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 26,
    alignItems: "center",
  },

  emptySearchTitle: {
    color: text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 12,
    marginBottom: 6,
  },

  emptySearchText: {
    color: muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  horizontalProductsRow: {
    paddingLeft: 22,
    paddingRight: 22,
    paddingBottom: 4,
    gap: 12,
  },

  horizontalProductItem: {
    width: 190,
  },

  productsGrid: {
    paddingHorizontal: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 0.2,
  },

  homeCategoryBlock: {
    marginTop: 4,
  },

  productGridItem: {
    width: "50%",
    paddingHorizontal: 0.2,
    marginBottom: 0.2,
  },

  quoteBanner: {
    marginHorizontal: 22,
    marginTop: 30,
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: navy,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },

  quoteIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  quoteTitle: {
    color: white,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 4,
  },

  quoteText: {
    color: "#D7E2EF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },

  quoteButton: {
    backgroundColor: white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginLeft: 10,
  },

  quoteButtonText: {
    color: text,
    fontSize: 13,
    fontWeight: "900",
  },
});
