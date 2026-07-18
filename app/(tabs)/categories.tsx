import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBottomNav } from "../../components/AppBottomNav";
import { ScreenHeader } from "../../components/ScreenHeader";
import {
  CatalogAudience,
  CatalogCategory,
  CatalogSubcategory,
  formatUSD,
  getCatalogNavigation,
  getCatalogProducts,
  getDisplayFinalPriceUSD,
  getProductImage,
  ShopXProduct,
} from "../../lib/api";
import { openShopXProduct } from "../../lib/product-navigation";

const navy = "#062B4F";
const text = "#071E35";
const muted = "#718096";
const accent = "#18C7D8";
const soft = "#F7FAFC";
const softCard = "#F1F5F9";
const border = "#E2E8F0";
const white = "#FFFFFF";

const CATEGORY_ICONS: Record<string, string> = {
  all: "view-grid-outline",
  clothing: "tshirt-crew-outline",
  technology: "laptop",
  toys: "toy-brick-outline",
  sports: "shoe-sneaker",
  outdoor: "pine-tree",
  home: "sofa-outline",
  jewelry: "watch-variant",
  beauty: "face-woman-shimmer-outline",
  food: "food-apple-outline",
  arts: "palette-outline",
  other: "shape-outline",
};

const AUDIENCE_OPTIONS: {
  key: CatalogAudience;
  label: string;
  icon: string;
}[] = [
  { key: "all", label: "Todos", icon: "account-group-outline" },
  { key: "men", label: "Hombre", icon: "human-male" },
  { key: "women", label: "Mujer", icon: "human-female" },
  { key: "kids", label: "Niños", icon: "human-child" },
];

type ViewMode = "explore" | "results";

type CategoryCardItem = {
  key: string;
  label: string;
  count: number;
  image?: string;
  icon: string;
  onPress: () => void;
};

function getCategoryIcon(key: string): string {
  return CATEGORY_ICONS[key] || "shape-outline";
}

function getProductKey(product: ShopXProduct, index: number): string {
  return (
    product._id ||
    product.id ||
    product.slug ||
    product.externalId ||
    `${product.title}-${index}`
  );
}

function createSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function CatalogHorizontalCard({
  product,
  onPress,
}: {
  product: ShopXProduct;
  onPress: () => void;
}) {
  const image = getProductImage(product);
  const finalPrice = getDisplayFinalPriceUSD(product);
  const store = product.store || product.brand || product.vendor || "ShopX";

  return (
    <TouchableOpacity
      style={styles.horizontalCard}
      onPress={onPress}
      activeOpacity={0.92}
    >
      <View style={styles.horizontalImageShell}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.horizontalImage}
            resizeMode="contain"
          />
        ) : (
          <MaterialCommunityIcons
            name="image-outline"
            size={38}
            color={muted}
          />
        )}
      </View>

      <View style={styles.horizontalContent}>
        <Text style={styles.horizontalStore} numberOfLines={1}>
          {store}
        </Text>
        <Text style={styles.horizontalTitle} numberOfLines={3}>
          {product.title}
        </Text>

        <View style={styles.horizontalPriceBlock}>
          <Text style={styles.horizontalPriceEyebrow}>FINAL ARGENTINA</Text>
          <Text style={styles.horizontalPrice}>{formatUSD(finalPrice)}</Text>
        </View>

        <View style={styles.horizontalFooter}>
          <Text style={styles.horizontalDetail}>Ver detalle</Text>
          <Feather name="arrow-right" size={18} color={accent} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [products, setProducts] = useState<ShopXProduct[]>([]);
  const [navigationLoading, setNavigationLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [navigationError, setNavigationError] = useState("");
  const [productsError, setProductsError] = useState("");
  const [selectedMainCategory, setSelectedMainCategory] = useState("all");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [selectedAudience, setSelectedAudience] =
    useState<CatalogAudience>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("explore");
  const [page, setPage] = useState(1);
  const [resultTotal, setResultTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [randomSeed, setRandomSeed] = useState(createSeed);

  async function loadNavigation() {
    setNavigationLoading(true);
    setNavigationError("");

    try {
      const result = await getCatalogNavigation();
      setCategories(result.categories);
      setTotalProducts(result.totalProducts);
    } catch (error) {
      console.log("ERROR CATALOG NAVIGATION:", error);
      setNavigationError("No pudimos cargar las categorías.");
    } finally {
      setNavigationLoading(false);
    }
  }

  useEffect(() => {
    loadNavigation();
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.key === selectedMainCategory),
    [categories, selectedMainCategory],
  );

  const selectedSubcategory = useMemo(
    () =>
      selectedCategory?.subcategories.find(
        (subcategory) => subcategory.key === selectedSubCategory,
      ),
    [selectedCategory, selectedSubCategory],
  );

  async function fetchProducts(nextPage: number, append: boolean) {
    if (append) setLoadingMore(true);
    else setProductsLoading(true);

    setProductsError("");

    try {
      const result = await getCatalogProducts({
        category: selectedMainCategory,
        subcategory: selectedSubcategory?.label,
        audience:
          selectedMainCategory === "clothing" ? selectedAudience : "all",
        page: nextPage,
        limit: 24,
        seed: randomSeed,
      });

      setProducts((current) =>
        append ? [...current, ...result.products] : result.products,
      );
      setPage(result.pagination.page);
      setResultTotal(result.pagination.total);
      setHasMore(result.pagination.hasMore);
    } catch (error) {
      console.log("ERROR CATALOG PRODUCTS:", error);
      if (!append) setProducts([]);
      setProductsError("No pudimos cargar los productos.");
    } finally {
      setProductsLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (viewMode !== "results") return;
    fetchProducts(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewMode,
    selectedMainCategory,
    selectedSubCategory,
    selectedAudience,
    randomSeed,
  ]);

  function openResults(categoryKey: string, subcategoryKey = "") {
    setSelectedMainCategory(categoryKey);
    setSelectedSubCategory(subcategoryKey);
    setSelectedAudience("all");
    setRandomSeed(createSeed());
    setPage(1);
    setProducts([]);
    setViewMode("results");

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }

  function changeSubcategory(key: string) {
    setSelectedSubCategory(key);
    setRandomSeed(createSeed());
    setPage(1);
    setProducts([]);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function changeAudience(audience: CatalogAudience) {
    setSelectedAudience(audience);
    setRandomSeed(createSeed());
    setPage(1);
    setProducts([]);
  }

  function returnToExplore() {
    setViewMode("explore");
    setSelectedSubCategory("");
    setSelectedAudience("all");
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }

  const railCategories = useMemo(
    () => [
      {
        key: "all",
        label: "Todo",
        count: totalProducts,
        icon: getCategoryIcon("all"),
      },
      ...categories.map((category) => ({
        key: category.key,
        label: category.label,
        count: category.count,
        icon: getCategoryIcon(category.key),
      })),
    ],
    [categories, totalProducts],
  );

  const rightPanelCards = useMemo<CategoryCardItem[]>(() => {
    if (selectedMainCategory === "all") {
      return categories.map((category) => ({
        key: category.key,
        label: category.label,
        count: category.count,
        image: category.image,
        icon: getCategoryIcon(category.key),
        onPress: () => {
          setSelectedMainCategory(category.key);
          setSelectedSubCategory("");
          if (category.subcategories.length === 0) {
            openResults(category.key);
          }
        },
      }));
    }

    return (selectedCategory?.subcategories || []).map(
      (subcategory: CatalogSubcategory) => ({
        key: subcategory.key,
        label: subcategory.label,
        count: subcategory.count,
        image: subcategory.image,
        icon: getCategoryIcon(selectedMainCategory),
        onPress: () =>
          openResults(selectedMainCategory, subcategory.key),
      }),
    );
  }, [categories, selectedCategory, selectedMainCategory]);

  const selectedMainLabel = selectedCategory?.label || "Todo";

  return (
    <View style={styles.app}>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === "explore" ? (
          <>
            <ScreenHeader title="Categorías" compact />

            <View style={styles.explorerShell}>
              <View style={styles.railColumn}>
                <Text style={styles.railTitle}>Explorar</Text>

                {navigationLoading ? (
                  <View style={styles.navigationMiniLoader}>
                    <ActivityIndicator size="small" color={navy} />
                  </View>
                ) : (
                  railCategories.map((category) => {
                    const active = category.key === selectedMainCategory;

                    return (
                      <TouchableOpacity
                        key={category.key}
                        style={[
                          styles.railItem,
                          active && styles.railItemActive,
                        ]}
                        onPress={() => {
                          setSelectedMainCategory(category.key);
                          setSelectedSubCategory("");
                        }}
                      >
                        {active ? <View style={styles.railActiveBar} /> : null}
                        <MaterialCommunityIcons
                          name={category.icon as never}
                          size={18}
                          color={active ? white : muted}
                        />
                        <Text
                          style={[
                            styles.railItemText,
                            active && styles.railItemTextActive,
                          ]}
                          numberOfLines={2}
                        >
                          {category.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>

              <View style={styles.rightPanel}>
                <View style={styles.rightPanelHeader}>
                  <View style={styles.rightPanelHeaderText}>
                    <Text style={styles.rightPanelEyebrow}>
                      {selectedMainCategory === "all"
                        ? "Mundos ShopX"
                        : "Subcategorías"}
                    </Text>
                    <Text style={styles.rightPanelTitle} numberOfLines={2}>
                      {selectedMainLabel}
                    </Text>
                  </View>

                  <View style={styles.badgeCount}>
                    <Text style={styles.badgeCountText}>
                      {navigationLoading ? "—" : rightPanelCards.length}
                    </Text>
                  </View>
                </View>

                {navigationError ? (
                  <View style={styles.navigationErrorBox}>
                    <Text style={styles.navigationErrorText}>
                      {navigationError}
                    </Text>
                    <TouchableOpacity onPress={loadNavigation}>
                      <Text style={styles.navigationRetryText}>Reintentar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.rightPanelGrid}>
                    {rightPanelCards.map((item) => (
                      <TouchableOpacity
                        key={item.key}
                        style={styles.categoryCard}
                        onPress={item.onPress}
                        activeOpacity={0.9}
                      >
                        <View style={styles.categoryVisual}>
                          {item.image ? (
                            <Image
                              source={{ uri: item.image }}
                              style={styles.categoryVisualImage}
                            />
                          ) : (
                            <MaterialCommunityIcons
                              name={item.icon as never}
                              size={28}
                              color={navy}
                            />
                          )}
                        </View>
                        <Text
                          style={styles.categoryCardLabel}
                          numberOfLines={2}
                        >
                          {item.label}
                        </Text>
                        <Text style={styles.categoryCardCount}>
                          {item.count} productos
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => openResults(selectedMainCategory)}
              activeOpacity={0.9}
            >
              <Text style={styles.viewAllButtonText}>
                {selectedMainCategory === "all"
                  ? "Ver todos los productos"
                  : `Ver todo en ${selectedMainLabel}`}
              </Text>
              <Feather name="arrow-right" size={18} color={white} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View
              style={[
                styles.resultsTopArea,
                { paddingTop: insets.top + 10 },
              ]}
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={returnToExplore}
                activeOpacity={0.85}
              >
                <Feather name="arrow-left" size={20} color={navy} />
                <Text style={styles.backButtonText}>Cambiar categoría</Text>
              </TouchableOpacity>

              <View style={styles.breadcrumbRow}>
                <Text style={styles.breadcrumbMain}>{selectedMainLabel}</Text>
                {selectedSubcategory ? (
                  <>
                    <Feather name="chevron-right" size={15} color={muted} />
                    <Text style={styles.breadcrumbCurrent}>
                      {selectedSubcategory.label}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>

            {selectedCategory?.subcategories.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsContent}
                style={styles.chipsScroll}
              >
                <TouchableOpacity
                  style={[
                    styles.categoryChip,
                    !selectedSubCategory && styles.categoryChipActive,
                  ]}
                  onPress={() => changeSubcategory("")}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      !selectedSubCategory &&
                        styles.categoryChipTextActive,
                    ]}
                  >
                    Todo
                  </Text>
                </TouchableOpacity>

                {selectedCategory.subcategories.map((subcategory) => {
                  const active = selectedSubCategory === subcategory.key;
                  return (
                    <TouchableOpacity
                      key={subcategory.key}
                      style={[
                        styles.categoryChip,
                        active && styles.categoryChipActive,
                      ]}
                      onPress={() => changeSubcategory(subcategory.key)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          active && styles.categoryChipTextActive,
                        ]}
                      >
                        {subcategory.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}

            {selectedMainCategory === "clothing" ? (
              <View style={styles.audienceSection}>
                <Text style={styles.audienceTitle}>¿Para quién?</Text>
                <View style={styles.audienceRow}>
                  {AUDIENCE_OPTIONS.map((option) => {
                    const active = selectedAudience === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[
                          styles.audienceButton,
                          active && styles.audienceButtonActive,
                        ]}
                        onPress={() => changeAudience(option.key)}
                      >
                        <MaterialCommunityIcons
                          name={option.icon as never}
                          size={18}
                          color={active ? white : navy}
                        />
                        <Text
                          style={[
                            styles.audienceButtonText,
                            active && styles.audienceButtonTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.resultsSummary}>
              <Text style={styles.resultsSummaryText}>
                {productsLoading && products.length === 0
                  ? "Cargando productos..."
                  : `Mostrando ${products.length} de ${resultTotal}`}
              </Text>
            </View>

            {productsLoading && products.length === 0 ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={navy} />
                <Text style={styles.loadingText}>Cargando productos...</Text>
              </View>
            ) : productsError && products.length === 0 ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>
                  No pudimos cargar los productos
                </Text>
                <Text style={styles.errorText}>{productsError}</Text>
              </View>
            ) : products.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={42}
                  color={muted}
                />
                <Text style={styles.emptyTitle}>No encontramos productos</Text>
                <Text style={styles.emptyText}>
                  Probá seleccionando otro filtro.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.horizontalList}>
                  {products.map((product, index) => (
                    <CatalogHorizontalCard
                      key={getProductKey(product, index)}
                      product={product}
                      onPress={() => openShopXProduct(product)}
                    />
                  ))}
                </View>

                {hasMore ? (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={() => fetchProducts(page + 1, true)}
                    disabled={loadingMore}
                    activeOpacity={0.9}
                  >
                    {loadingMore ? (
                      <ActivityIndicator color={white} />
                    ) : (
                      <>
                        <Text style={styles.loadMoreButtonText}>
                          Ver más productos
                        </Text>
                        <Feather name="chevron-down" size={18} color={white} />
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.endMessage}>
                    Ya viste todos los productos de esta selección
                  </Text>
                )}
              </>
            )}
          </>
        )}

        <View style={{ height: 130 }} />
      </ScrollView>

      <AppBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: soft },
  screen: { flex: 1, backgroundColor: soft },
  content: { paddingBottom: 0 },
  explorerShell: {
    marginTop: 14,
    marginHorizontal: 18,
    flexDirection: "row",
    gap: 12,
  },
  railColumn: { width: 104 },
  railTitle: {
    color: text,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 10,
    paddingLeft: 4,
  },
  navigationMiniLoader: {
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  railItem: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: white,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
    position: "relative",
  },
  railItemActive: {
    backgroundColor: navy,
    borderColor: navy,
    shadowColor: navy,
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  railActiveBar: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: accent,
  },
  railItemText: {
    marginTop: 6,
    color: text,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  railItemTextActive: { color: white },
  rightPanel: { flex: 1 },
  rightPanelHeader: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  rightPanelHeaderText: { flex: 1, paddingRight: 8 },
  rightPanelEyebrow: {
    color: accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  rightPanelTitle: {
    color: text,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginTop: 2,
  },
  badgeCount: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  badgeCountText: { color: navy, fontSize: 12, fontWeight: "900" },
  navigationErrorBox: {
    borderWidth: 1,
    borderColor: border,
    borderRadius: 18,
    backgroundColor: white,
    padding: 16,
  },
  navigationErrorText: { color: muted, fontSize: 13, lineHeight: 18 },
  navigationRetryText: {
    color: navy,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 8,
  },
  rightPanelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  categoryCard: {
    width: "48.3%",
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 20,
    padding: 12,
    marginBottom: 10,
    minHeight: 138,
    shadowColor: navy,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  categoryVisual: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: softCard,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 12,
  },
  categoryVisualImage: { width: "100%", height: "100%", resizeMode: "cover" },
  categoryCardLabel: {
    color: text,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
    minHeight: 36,
  },
  categoryCardCount: {
    color: muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },
  viewAllButton: {
    marginHorizontal: 18,
    marginTop: 14,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: navy,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
  },
  viewAllButtonText: { color: white, fontSize: 15, fontWeight: "900" },
  resultsTopArea: { paddingHorizontal: 18, paddingBottom: 4 },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButtonText: { color: navy, fontSize: 13, fontWeight: "900" },
  breadcrumbRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 14,
  },
  breadcrumbMain: { color: muted, fontSize: 13, fontWeight: "800" },
  breadcrumbCurrent: { color: navy, fontSize: 13, fontWeight: "900" },
  chipsScroll: { marginTop: 10 },
  chipsContent: { paddingHorizontal: 18, gap: 8 },
  categoryChip: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: white,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryChipActive: { backgroundColor: navy, borderColor: navy },
  categoryChipText: { color: text, fontSize: 13, fontWeight: "800" },
  categoryChipTextActive: { color: white },
  audienceSection: { marginHorizontal: 18, marginTop: 18 },
  audienceTitle: {
    color: text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 10,
  },
  audienceRow: { flexDirection: "row", gap: 8 },
  audienceButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: white,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  audienceButtonActive: { backgroundColor: navy, borderColor: navy },
  audienceButtonText: { color: navy, fontSize: 11, fontWeight: "800" },
  audienceButtonTextActive: { color: white },
  resultsSummary: {
    paddingHorizontal: 18,
    marginTop: 20,
    marginBottom: 12,
  },
  resultsSummaryText: { color: muted, fontSize: 14, fontWeight: "800" },
  horizontalList: { paddingHorizontal: 18, gap: 12 },
  horizontalCard: {
    height: 190,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: white,
    padding: 12,
    flexDirection: "row",
    gap: 14,
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  horizontalImageShell: {
    width: 132,
    height: 166,
    borderRadius: 17,
    backgroundColor: softCard,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  horizontalImage: { width: "100%", height: "100%" },
  horizontalContent: {
    flex: 1,
    minWidth: 0,
    height: 166,
  },
  horizontalStore: {
    color: muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  horizontalTitle: {
    color: text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
  },
  horizontalPriceBlock: { marginTop: 12 },
  horizontalPriceEyebrow: {
    color: muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  horizontalPrice: {
    color: navy,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2,
  },
  horizontalFooter: {
    marginTop: "auto",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  horizontalDetail: { color: text, fontSize: 13, fontWeight: "900" },
  loadingBox: {
    marginHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: white,
    padding: 26,
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
    marginHorizontal: 18,
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
  errorText: { color: muted, fontSize: 14, lineHeight: 20 },
  emptyBox: {
    marginHorizontal: 18,
    borderRadius: 24,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 26,
    alignItems: "center",
  },
  emptyTitle: {
    color: text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 12,
    marginBottom: 6,
  },
  emptyText: {
    color: muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  loadMoreButton: {
    marginHorizontal: 18,
    marginTop: 22,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: navy,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadMoreButtonText: { color: white, fontSize: 15, fontWeight: "900" },
  endMessage: {
    color: muted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 22,
    paddingHorizontal: 18,
  },
});
