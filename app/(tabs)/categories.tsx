import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { AppBottomNav } from "../../components/AppBottomNav";
import { ProductCard } from "../../components/ProductCard";
import { ScreenHeader } from "../../components/ScreenHeader";
import { getProductImage, getProducts, ShopXProduct } from "../../lib/api";
import { saveProductToCache } from "../../lib/product-cache";

const navy = "#062B4F";
const text = "#071E35";
const muted = "#718096";
const accent = "#18C7D8";
const soft = "#F7FAFC";
const softCard = "#F1F5F9";
const border = "#E2E8F0";
const white = "#FFFFFF";

type MainCategoryKey =
  | "all"
  | "tech"
  | "fashion"
  | "home"
  | "watches"
  | "sports";

type MainCategoryDef = {
  key: MainCategoryKey;
  label: string;
  icon: string;
};

type SubcategoryDef = {
  key: string;
  label: string;
  icon: string;
  keywords: string[];
};

const mainCategories: MainCategoryDef[] = [
  { key: "all", label: "Todo", icon: "view-grid-outline" },
  { key: "tech", label: "Tecnología", icon: "laptop" },
  { key: "fashion", label: "Moda", icon: "tshirt-crew-outline" },
  { key: "home", label: "Hogar", icon: "sofa-outline" },
  { key: "watches", label: "Relojes", icon: "watch-variant" },
  { key: "sports", label: "Deportes", icon: "shoe-sneaker" },
];

const subcategories: Record<Exclude<MainCategoryKey, "all">, SubcategoryDef[]> = {
  tech: [
    {
      key: "computacion",
      label: "Computación",
      icon: "laptop",
      keywords: [
        "laptop",
        "notebook",
        "macbook",
        "pc",
        "monitor",
        "dell",
        "apple",
        "lenovo",
      ],
    },
    {
      key: "audio",
      label: "Audio",
      icon: "headphones",
      keywords: [
        "audio",
        "headphones",
        "earbuds",
        "speaker",
        "airpods",
        "beats",
        "bose",
        "sony",
      ],
    },
    {
      key: "gaming",
      label: "Gaming",
      icon: "controller-classic-outline",
      keywords: ["gaming", "playstation", "xbox", "nintendo", "game", "console"],
    },
    {
      key: "smartphones",
      label: "Smartphones",
      icon: "cellphone",
      keywords: ["iphone", "phone", "smartphone", "samsung", "pixel", "galaxy"],
    },
    {
      key: "tablets",
      label: "Tablets",
      icon: "tablet-ipad",
      keywords: ["ipad", "tablet"],
    },
    {
      key: "accesorios-tech",
      label: "Accesorios",
      icon: "usb-port",
      keywords: ["charger", "case", "keyboard", "mouse", "cable", "adapter", "dock"],
    },
  ],
  fashion: [
    {
      key: "camperas",
      label: "Camperas",
      icon: "hanger",
      keywords: ["jacket", "coat", "parka", "canada goose", "outerwear"],
    },
    {
      key: "remeras",
      label: "Remeras",
      icon: "tshirt-crew-outline",
      keywords: ["shirt", "tee", "t-shirt", "polo", "top"],
    },
    {
      key: "jeans",
      label: "Jeans",
      icon: "human-male",
      keywords: ["jean", "pants", "denim", "trouser"],
    },
    {
      key: "zapatillas",
      label: "Zapatillas",
      icon: "shoe-sneaker",
      keywords: ["shoe", "sneaker", "adidas", "nike", "new balance", "reebok"],
    },
    {
      key: "bolsos",
      label: "Bolsos",
      icon: "bag-suitcase-outline",
      keywords: ["bag", "backpack", "duffel", "luggage", "wallet"],
    },
    {
      key: "accesorios-moda",
      label: "Accesorios",
      icon: "sunglasses",
      keywords: ["cap", "hat", "belt", "glasses", "scarf"],
    },
  ],
  home: [
    {
      key: "living",
      label: "Living",
      icon: "sofa-outline",
      keywords: ["sofa", "living", "chair", "table", "lamp"],
    },
    {
      key: "cocina",
      label: "Cocina",
      icon: "silverware-fork-knife",
      keywords: ["kitchen", "cook", "coffee", "pan", "knife", "appliance"],
    },
    {
      key: "deco",
      label: "Deco",
      icon: "palette-outline",
      keywords: ["deco", "decor", "frame", "vase", "candle"],
    },
    {
      key: "organizacion",
      label: "Organización",
      icon: "archive-outline",
      keywords: ["storage", "organizer", "shelf", "box"],
    },
    {
      key: "bath",
      label: "Baño",
      icon: "shower",
      keywords: ["bath", "towel", "bathroom"],
    },
    {
      key: "smart-home",
      label: "Smart Home",
      icon: "home-automation",
      keywords: ["smart home", "alexa", "google home", "security", "camera"],
    },
  ],
  watches: [
    {
      key: "smartwatch",
      label: "Smartwatch",
      icon: "watch-variant",
      keywords: ["apple watch", "smartwatch", "garmin", "fitbit"],
    },
    {
      key: "luxury",
      label: "Luxury",
      icon: "watch",
      keywords: ["rolex", "omega", "luxury watch", "chronograph"],
    },
    {
      key: "sport",
      label: "Sport",
      icon: "run-fast",
      keywords: ["sport watch", "running watch", "outdoor watch"],
    },
    {
      key: "bands",
      label: "Correas",
      icon: "watch-vibrate",
      keywords: ["watch band", "strap", "bracelet"],
    },
  ],
  sports: [
    {
      key: "running",
      label: "Running",
      icon: "run-fast",
      keywords: ["running", "runner", "run", "asics"],
    },
    {
      key: "training",
      label: "Training",
      icon: "dumbbell",
      keywords: ["gym", "training", "fitness", "workout"],
    },
    {
      key: "outdoor",
      label: "Outdoor",
      icon: "pine-tree",
      keywords: ["outdoor", "camping", "hiking", "yeti", "patagonia"],
    },
    {
      key: "surf",
      label: "Surf",
      icon: "surfing",
      keywords: ["surf", "boardshort", "wetsuit"],
    },
    {
      key: "recovery",
      label: "Recovery",
      icon: "heart-pulse",
      keywords: ["recovery", "massage", "foam roller", "theragun"],
    },
    {
      key: "calzado",
      label: "Calzado",
      icon: "shoe-sneaker",
      keywords: ["shoe", "sneaker", "boot", "cleat"],
    },
  ],
};

function normalize(value?: string) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getCategoryStrings(product: ShopXProduct) {
  const category =
    typeof product.category === "string"
      ? product.category
      : `${product.category?.main || ""} ${product.category?.sub || ""} ${
          product.category?.leaf || ""
        }`;

  return normalize(
    [
      product.title,
      product.brand,
      product.store,
      product.source,
      product.vendor,
      category,
      product.productType,
      ...(product.tags || []),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function productMatchesKeywords(product: ShopXProduct, keywords: string[]) {
  const haystack = getCategoryStrings(product);
  return keywords.some((keyword) => haystack.includes(normalize(keyword)));
}

function inferMainCategory(product: ShopXProduct): MainCategoryKey {
  if (
    productMatchesKeywords(product, [
      "watch",
      "smartwatch",
      "rolex",
      "omega",
      "garmin",
      "fitbit",
    ])
  ) {
    return "watches";
  }

  if (
    productMatchesKeywords(product, [
      "shoe",
      "sneaker",
      "running",
      "fitness",
      "training",
      "outdoor",
      "surf",
      "sport",
      "camping",
      "yeti",
      "hiking",
    ])
  ) {
    return "sports";
  }

  if (
    productMatchesKeywords(product, [
      "jacket",
      "coat",
      "parka",
      "t-shirt",
      "shirt",
      "jean",
      "pants",
      "fashion",
      "bag",
      "backpack",
      "wallet",
      "adidas",
      "nike",
      "canada goose",
    ])
  ) {
    return "fashion";
  }

  if (
    productMatchesKeywords(product, [
      "sofa",
      "lamp",
      "kitchen",
      "coffee",
      "decor",
      "deco",
      "home",
      "bath",
      "smart home",
    ])
  ) {
    return "home";
  }

  return "tech";
}

function getProductSlug(product: ShopXProduct) {
  return product.slug || product._id || product.id || product.externalId || "";
}

function openProduct(product: ShopXProduct) {
  const slug = getProductSlug(product);
  if (!slug) return;

  saveProductToCache(product);
  router.push(`/product/${slug}`);
}

function getSortPrice(product: ShopXProduct) {
  const anyProduct = product as any;

  return (
    Number(anyProduct.finalPriceUSD) ||
    Number(anyProduct.displayFinalPriceUSD) ||
    Number(anyProduct.priceUSD) ||
    Number(anyProduct.price) ||
    0
  );
}

function sortProducts(
  products: ShopXProduct[],
  mode: "featured" | "priceAsc" | "priceDesc"
) {
  const copy = [...products];

  if (mode === "priceAsc") {
    return copy.sort((a, b) => getSortPrice(a) - getSortPrice(b));
  }

  if (mode === "priceDesc") {
    return copy.sort((a, b) => getSortPrice(b) - getSortPrice(a));
  }

  return copy;
}

export default function CategoriesScreen() {
  const [products, setProducts] = useState<ShopXProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [selectedMainCategory, setSelectedMainCategory] =
    useState<MainCategoryKey>("all");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [sortMode, setSortMode] = useState<"featured" | "priceAsc" | "priceDesc">(
    "featured"
  );

  async function loadProducts() {
    setLoading(true);
    setErrorMessage("");

    try {
      const result = await getProducts(120);
      setProducts(result);
    } catch (error) {
      console.log("ERROR CATEGORIES:", error);
      setErrorMessage("No pudimos cargar las categorías y productos.");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    setSelectedSubCategory("");
  }, [selectedMainCategory]);

  const searchableProducts = useMemo(() => {
    let result = [...products];

    if (selectedMainCategory !== "all") {
      result = result.filter(
        (product) => inferMainCategory(product) === selectedMainCategory
      );
    }

    if (selectedSubCategory && selectedMainCategory !== "all") {
      const subcategoryConfig = subcategories[selectedMainCategory]?.find(
        (item) => item.key === selectedSubCategory
      );

      if (subcategoryConfig) {
        result = result.filter((product) =>
          productMatchesKeywords(product, subcategoryConfig.keywords)
        );
      }
    }

    if (query.trim()) {
      const normalizedQuery = normalize(query.trim());

      result = result.filter((product) => {
        const haystack = getCategoryStrings(product);
        return haystack.includes(normalizedQuery);
      });
    }

    return sortProducts(result, sortMode);
  }, [products, query, selectedMainCategory, selectedSubCategory, sortMode]);

  const rightPanelCards = useMemo(() => {
    if (selectedMainCategory === "all") {
      return mainCategories
        .filter((category) => category.key !== "all")
        .map((category) => {
          const categoryProducts = products.filter(
            (product) => inferMainCategory(product) === category.key
          );
          const previewImage = categoryProducts[0]
            ? getProductImage(categoryProducts[0])
            : "";

          return {
            key: category.key,
            label: category.label,
            icon: category.icon,
            count: categoryProducts.length,
            image: previewImage,
            onPress: () => setSelectedMainCategory(category.key),
            active: false,
          };
        });
    }

    const list = subcategories[selectedMainCategory] || [];

    return list.map((subcategory) => {
      const matchingProducts = products.filter(
        (product) =>
          inferMainCategory(product) === selectedMainCategory &&
          productMatchesKeywords(product, subcategory.keywords)
      );

      return {
        key: subcategory.key,
        label: subcategory.label,
        icon: subcategory.icon,
        count: matchingProducts.length,
        image: matchingProducts[0] ? getProductImage(matchingProducts[0]) : "",
        onPress: () =>
          setSelectedSubCategory((prev) =>
            prev === subcategory.key ? "" : subcategory.key
          ),
        active: selectedSubCategory === subcategory.key,
      };
    });
  }, [products, selectedMainCategory, selectedSubCategory]);

  const selectedMainLabel =
    mainCategories.find((item) => item.key === selectedMainCategory)?.label ||
    "Todo";

  const sortLabel =
    sortMode === "featured"
      ? "Destacados"
      : sortMode === "priceAsc"
      ? "Menor precio"
      : "Mayor precio";

  const visibleProducts = searchableProducts.slice(0, 12);

  return (
    <View style={styles.app}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Categorías"
          subtitle="Explorá productos reales de USA con una experiencia más curada, clara y premium."
          compact
        />

        <View style={styles.searchWrapper}>
          <View style={styles.searchBox}>
            <Feather name="search" size={20} color={muted} />

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por producto, marca o categoría..."
              placeholderTextColor="#8FA0B6"
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />

            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Text style={styles.clearSearch}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.explorerShell}>
          <View style={styles.railColumn}>
            <Text style={styles.railTitle}>Explorar</Text>

            {mainCategories.map((category) => {
              const active = category.key === selectedMainCategory;

              return (
                <TouchableOpacity
                  key={category.key}
                  style={[styles.railItem, active && styles.railItemActive]}
                  onPress={() => setSelectedMainCategory(category.key)}
                >
                  {active && <View style={styles.railActiveBar} />}

                  <MaterialCommunityIcons
                    name={category.icon as any}
                    size={18}
                    color={active ? white : muted}
                  />

                  <Text
                    style={[
                      styles.railItemText,
                      active && styles.railItemTextActive,
                    ]}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.rightPanel}>
            <View style={styles.rightPanelHeader}>
              <View>
                <Text style={styles.rightPanelEyebrow}>
                  {selectedMainCategory === "all"
                    ? "Mundos ShopX"
                    : "Subcategorías"}
                </Text>
                <Text style={styles.rightPanelTitle}>{selectedMainLabel}</Text>
              </View>

              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>
                  {rightPanelCards.length || 0}
                </Text>
              </View>
            </View>

            <View style={styles.rightPanelGrid}>
              {rightPanelCards.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.categoryCard,
                    item.active ? styles.categoryCardActive : undefined,
                  ]}
                  onPress={item.onPress}
                  activeOpacity={0.9}
                >
                  <View
                    style={[
                      styles.categoryVisual,
                      item.active ? styles.categoryVisualActive : undefined,
                    ]}
                  >
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        style={styles.categoryVisualImage}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name={item.icon as any}
                        size={28}
                        color={item.active ? white : navy}
                      />
                    )}
                  </View>

                  <Text
                    style={[
                      styles.categoryCardLabel,
                      item.active ? styles.categoryCardLabelActive : undefined,
                    ]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>

                  <Text
                    style={[
                      styles.categoryCardCount,
                      item.active ? styles.categoryCardCountActive : undefined,
                    ]}
                  >
                    {item.count} productos
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.productsSectionHeader}>
          <View>
            <Text style={styles.productsTitle}>
              {selectedSubCategory
                ? `Selección de ${
                    rightPanelCards.find(
                      (item) => item.key === selectedSubCategory
                    )?.label || "categoría"
                  }`
                : selectedMainCategory === "all"
                ? "Todos los productos"
                : `${selectedMainLabel} destacados`}
            </Text>

            <Text style={styles.productsSubtitle}>
              {searchableProducts.length} productos encontrados
            </Text>
          </View>

          <TouchableOpacity
            style={styles.sortButton}
            onPress={() =>
              setSortMode((prev) =>
                prev === "featured"
                  ? "priceAsc"
                  : prev === "priceAsc"
                  ? "priceDesc"
                  : "featured"
              )
            }
          >
            <Text style={styles.sortButtonText}>{sortLabel}</Text>
            <Feather name="chevron-down" size={16} color={text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={navy} />
            <Text style={styles.loadingText}>Cargando categorías...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>No pudimos cargar la pantalla</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>

            <TouchableOpacity style={styles.retryButton} onPress={loadProducts}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : visibleProducts.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="magnify" size={42} color={muted} />
            <Text style={styles.emptyTitle}>No encontramos productos</Text>
            <Text style={styles.emptyText}>
              Probá cambiando la búsqueda o navegando otra categoría.
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
                <ProductCard
                  key={key}
                  product={product}
                  variant="grid"
                  showFooter
                  showCartButton={false}
                  onPress={() => openProduct(product)}
                />
              );
            })}
          </View>
        )}

        <View style={{ height: 130 }} />
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

  searchWrapper: {
    paddingHorizontal: 18,
    marginBottom: 6,
  },
  searchBox: {
    height: 50,
    backgroundColor: white,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: border,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 10,
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    color: text,
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 10,
  },
  clearSearch: {
    color: "#8FA0B6",
    fontSize: 28,
    fontWeight: "900",
    paddingHorizontal: 6,
  },

  explorerShell: {
    marginTop: 14,
    marginHorizontal: 18,
    flexDirection: "row",
    gap: 12,
  },
  railColumn: {
    width: 104,
  },
  railTitle: {
    color: text,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 10,
    paddingLeft: 4,
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
  railItemTextActive: {
    color: white,
  },

  rightPanel: {
    flex: 1,
  },
  rightPanelHeader: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
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
  badgeCountText: {
    color: navy,
    fontSize: 12,
    fontWeight: "900",
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
  categoryCardActive: {
    borderColor: accent,
    backgroundColor: "#F4FEFF",
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
  categoryVisualActive: {
    backgroundColor: navy,
  },
  categoryVisualImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  categoryCardLabel: {
    color: text,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
    minHeight: 36,
  },
  categoryCardLabelActive: {
    color: navy,
  },
  categoryCardCount: {
    color: muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
  },
  categoryCardCountActive: {
    color: "#3F5B7A",
  },

  productsSectionHeader: {
    paddingHorizontal: 18,
    marginTop: 20,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  productsTitle: {
    color: text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  productsSubtitle: {
    marginTop: 4,
    color: muted,
    fontSize: 14,
    fontWeight: "700",
  },
  sortButton: {
    height: 40,
    borderRadius: 999,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: white,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sortButtonText: {
    color: text,
    fontSize: 13,
    fontWeight: "800",
  },

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

  productsGrid: {
    paddingHorizontal: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
});