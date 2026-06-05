import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { addProductToCart } from "../../lib/cart-store";
import { useFavoriteProduct } from "../../hooks/useFavorites";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  useWindowDimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { AppBottomNav } from "../../components/AppBottomNav";
import {
  applySelectedProductOptions,
  buildInitialSelectedOptions,
  formatUSD,
  getDisplayFinalPriceUSD,
  getProductBySlug,
  DomesticPricingDestination,
  getProductImage,
  getProductImages,
  getProducts,
  getSelectableOptionGroups,
  resolveProductsForCartItems,
  SelectedProductOptions,
  ShopXProduct,
} from "../../lib/api";
import { getAppAccount, getStoredUser, ShopXUser } from "../../lib/auth";

const navy = "#062B4F";
const text = "#071E35";
const muted = "#718096";
const accent = "#18C7D8";
const soft = "#F7FAFC";
const softCard = "#F1F5F9";
const border = "#E2E8F0";
const white = "#FFFFFF";
const green = "#0EA371";
const greenSoft = "#E7FFF4";
const orangeSoft = "#FFF7E6";
const DESCRIPTION_PREVIEW_LINES = 5;
const DESCRIPTION_PREVIEW_CHAR_LIMIT = 220;

function getProductSlug(product: ShopXProduct) {
  return product.slug || product._id || product.id || product.externalId || "";
}

function getBrand(product: ShopXProduct) {
  return (product.brand || product.store || product.source || "SHOPX").toUpperCase();
}

function getCategoryLabel(product: ShopXProduct) {
  if (typeof product.category === "string") return product.category;

  return (
    product.category?.leaf ||
    product.category?.sub ||
    product.category?.main ||
    "Producto USA"
  );
}

function getSourceLabel(product: ShopXProduct) {
  const source = String(product.source || product.store || "").toLowerCase();

  if (source.includes("amazon")) return "AMAZON USA";
  if (source.includes("ebay")) return "EBAY USA";
  if (source.includes("manual") || source.includes("shopx")) return "SHOPX CURATED";

  return getBrand(product);
}

function getShortDescription(product: ShopXProduct) {
  const description = String(product.description || "").trim();

  if (!description) {
    return "Producto seleccionado por ShopX para comprar en USA y recibir en Argentina con precio final claro.";
  }

  return description;
}

type CleanBreakdownRow = {
  label: string;
  amount: number;
};

type SpecificationRow = {
  label: string;
  value: string;
};

const REQUIRED_BREAKDOWN_ROWS = [
  "Precio Productos USA",
  "IVA importación (21%)",
  "Flete Internacional",
  "Aduana y Tasas",
  "Gestión y Seguro ShopX",
  "Logística Nacional",
];

function normalizeText(value?: string | number | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeBreakdownLabel(label: string) {
  const clean = normalizeText(label);

  if (clean.includes("producto")) return "Precio Productos USA";
  if (clean.includes("iva")) return "IVA importación (21%)";
  if (clean.includes("flete") || clean.includes("internacional")) {
    return "Flete Internacional";
  }
  if (clean.includes("aduana") || clean.includes("tasas")) {
    return "Aduana y Tasas";
  }
  if (
    clean.includes("gestión") ||
    clean.includes("gestion") ||
    clean.includes("seguro") ||
    clean.includes("shopx")
  ) {
    return "Gestión y Seguro ShopX";
  }
  if (clean.includes("nacional") || clean.includes("local")) {
    return "Logística Nacional";
  }

  return String(label || "Concepto");
}

function getBreakdownAmount(row: any) {
  const value =
    row?.amount ??
    row?.amountUSD ??
    row?.value ??
    row?.usd ??
    row?.priceUSD ??
    row?.totalUSD ??
    row?.total ??
    0;

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getPricingBreakdown(product: ShopXProduct): CleanBreakdownRow[] {
  const rows = Array.isArray(product.pricing?.breakdown)
    ? product.pricing.breakdown
    : [];

  const totals: Record<string, number> = REQUIRED_BREAKDOWN_ROWS.reduce(
    (acc, label) => {
      acc[label] = 0;
      return acc;
    },
    {} as Record<string, number>
  );

  rows.forEach((row: any) => {
    const label = normalizeBreakdownLabel(String(row?.label || ""));
    const amount = getBreakdownAmount(row);

    if (label && Number.isFinite(amount)) {
      totals[label] = (totals[label] || 0) + amount;
    }
  });

  return REQUIRED_BREAKDOWN_ROWS.map((label) => ({
    label,
    amount: Number((totals[label] || 0).toFixed(2)),
  }));
}

function productHasPricingBreakdown(product: ShopXProduct) {
  return Array.isArray(product.pricing?.breakdown) && product.pricing.breakdown.length > 0;
}

function buildDomesticPricingDestination(
  user?: ShopXUser | null
): DomesticPricingDestination | undefined {
  if (!user) return undefined;

  const province = String(
    user.address?.province || user.billing?.province || ""
  ).trim();
  const city = String(user.address?.city || user.billing?.city || "").trim();
  const postalCode = String(
    user.address?.postalCode || user.billing?.postalCode || ""
  ).trim();

  if (!province && !city && !postalCode) return undefined;

  return { province, city, postalCode };
}

async function getCurrentPricingDestination() {
  try {
    const account = await getAppAccount();
    return buildDomesticPricingDestination(account.user);
  } catch {
    const storedUser = await getStoredUser();
    return buildDomesticPricingDestination(storedUser);
  }
}

function humanizeSpecLabel(label: string) {
  const clean = String(label || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();

  if (!clean) return "Especificación";

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function specValueToText(value: any) {
  if (value === null || value === undefined) return "";

  if (Array.isArray(value)) {
    return value
      .map((item) => specValueToText(item))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => {
        const textValue = specValueToText(item);
        return textValue ? `${humanizeSpecLabel(key)}: ${textValue}` : "";
      })
      .filter(Boolean)
      .join(" · ");
  }

  const raw = String(value).trim();

  if ((raw.startsWith("[") && raw.endsWith("]")) || (raw.startsWith("{") && raw.endsWith("}"))) {
    try {
      const parsed = JSON.parse(raw);
      return specValueToText(parsed);
    } catch {
      return raw;
    }
  }

  return raw;
}

function normalizeSpecKey(value: any) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_/\\|()[\]{}"'`´’:.+-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSpecListLike(value: any): any[] {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    }
  }

  return [];
}

function shouldHideSpecification(label: string, value: any) {
  const key = normalizeSpecKey(label);
  const textValue = specValueToText(value);
  const normalizedValue = normalizeSpecKey(textValue);
  const listLike = parseSpecListLike(value);

  if (!key || !textValue) return true;

  const exactHidden = [
    "id",
    "sku",
    "mpn",
    "upc",
    "ean",
    "currency",
    "source",
    "vendor",
    "peso",
    "weight",
    "weight kg",
  ];

  const containsHidden = [
    "product id",
    "variant id",
    "source id",
    "source handle",
    "source url",
    "url",
    "link",
    "precio",
    "price",
    "estimated usd",
    "final price usd",
    "style code",
    "stock",
    "inventory",
    "available",
    "availability",
    "image",
    "tags",
  ];

  if (exactHidden.includes(key)) return true;
  if (containsHidden.some((hidden) => key.includes(hidden))) return true;

  const optionKeys = [
    "color",
    "colors",
    "color selected",
    "selected color",
    "colors all",
    "size",
    "sizes",
    "size selected",
    "selected size",
    "sizes all",
    "sizes available",
    "shoe size",
    "talle",
    "talla",
    "capacity",
    "capacidad",
    "storage",
    "almacenamiento",
    "memoria",
  ];

  if (optionKeys.some((optionKey) => key === optionKey || key.includes(optionKey))) {
    return true;
  }

  if (textValue.includes("http://") || textValue.includes("https://") || textValue.includes("www.")) {
    return true;
  }

  if (listLike.length > 1) return true;

  // Evita objetos/arrays serializados tipo ["US 6", "US 7"] dentro de especificaciones.
  if ((textValue.startsWith("[") && textValue.endsWith("]")) || (textValue.startsWith("{") && textValue.endsWith("}"))) {
    return true;
  }

  if (normalizedValue === "usd" || normalizedValue === "ars") return true;

  return false;
}

function pushSpecRow(
  rows: SpecificationRow[],
  label: string,
  value: any,
  seen: Set<string>
) {
  if (shouldHideSpecification(label, value)) return;

  const cleanLabel = humanizeSpecLabel(label);
  const cleanValue = specValueToText(value);

  if (!cleanLabel || !cleanValue) return;

  const key = `${cleanLabel.toLowerCase()}::${cleanValue.toLowerCase()}`;

  if (seen.has(key)) return;

  seen.add(key);
  rows.push({ label: cleanLabel, value: cleanValue });
}

function getProductSpecifications(product: ShopXProduct): SpecificationRow[] {
  const rawProduct = product as any;
  const rows: SpecificationRow[] = [];
  const seen = new Set<string>();

  const specs = rawProduct?.specs;

  if (Array.isArray(specs)) {
    specs.forEach((item: any) => {
      if (!item) return;

      if (typeof item === "string") {
        pushSpecRow(rows, "Detalle", item, seen);
        return;
      }

      pushSpecRow(
        rows,
        item.label || item.name || item.key || item.title || "Detalle",
        item.value || item.text || item.description,
        seen
      );
    });
  } else if (specs && typeof specs === "object") {
    const entries = specs instanceof Map ? Array.from(specs.entries()) : Object.entries(specs);

    entries.forEach(([key, value]) => {
      pushSpecRow(rows, key, value, seen);
    });
  }

  // Fallback: ficha técnica útil desde campos top-level si no vino en specs.
  const dimensions = rawProduct?.dimensionsCm;
  if (dimensions?.length || dimensions?.width || dimensions?.height) {
    const dimensionText = [dimensions.length, dimensions.width, dimensions.height]
      .filter(Boolean)
      .join(" × ");

    if (dimensionText) pushSpecRow(rows, "Dimensiones", `${dimensionText} cm`, seen);
  }

  return rows.slice(0, 12);
}

function TrustBadge({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.trustBadge}>
      <View style={styles.trustIcon}>
        <MaterialCommunityIcons name={icon as any} size={21} color={navy} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.trustBadgeTitle}>{title}</Text>
        <Text style={styles.trustBadgeSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function BreakdownRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={[styles.breakdownRow, strong && styles.breakdownRowStrong]}>
      <Text
        style={[styles.breakdownLabel, strong && styles.breakdownLabelStrong]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Text style={[styles.breakdownValue, strong && styles.breakdownValueStrong]}>
        {value}
      </Text>
    </View>
  );
}

function ProductOptionSelector({
  name,
  values,
  selectedValue,
  onSelect,
}: {
  name: string;
  values: string[];
  selectedValue?: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.optionGroupTitle}>{name}</Text>

      <View style={styles.optionValuesWrap}>
        {values.map((value) => {
          const isSelected = String(selectedValue || "") === String(value || "");

          return (
            <TouchableOpacity
              key={`${name}-${value}`}
              activeOpacity={0.84}
              style={[styles.optionChip, isSelected && styles.optionChipSelected]}
              onPress={() => onSelect(value)}
            >
              <Text
                style={[
                  styles.optionChipText,
                  isSelected && styles.optionChipTextSelected,
                ]}
              >
                {value}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function ProductDetailScreen() {
  const params = useLocalSearchParams();
  const routeSlug = String(params.slug || params.id || "");
  const { width: screenWidth } = useWindowDimensions();
  const imageCardWidth = Math.max(280, screenWidth - 36);

  const [product, setProduct] = useState<ShopXProduct | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState<ShopXProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<SelectedProductOptions>({});
  const [resolvedSelectionProduct, setResolvedSelectionProduct] = useState<ShopXProduct | null>(null);
  const [variantPricingLoading, setVariantPricingLoading] = useState(false);

  async function loadProduct(options?: { silent?: boolean }) {
    if (!routeSlug) {
      setProduct(null);
      setErrorMessage("No pudimos cargar el producto.");
      setLoading(false);
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      const destination = await getCurrentPricingDestination();
      const result = await getProductBySlug(routeSlug, destination);

      if (!result) {
        setProduct(null);
        setErrorMessage("No encontramos el producto.");
        return;
      }

      setProduct(result);
      setSelectedOptions(buildInitialSelectedOptions(result));
      setResolvedSelectionProduct(null);
      setActiveImageIndex(0);
      setDescriptionExpanded(false);

      try {
        const products = await getProducts(48, destination);
        const currentCategory = getCategoryLabel(result);
        const currentBrand = getBrand(result);

        const related = products
          .filter((item) => getProductSlug(item) !== getProductSlug(result))
          .sort((a, b) => {
            const aBrand = getBrand(a) === currentBrand ? 0 : 1;
            const bBrand = getBrand(b) === currentBrand ? 0 : 1;
            return aBrand - bBrand;
          })
          .filter(
            (item) =>
              getCategoryLabel(item) === currentCategory || getBrand(item) === currentBrand
          )
          .slice(0, 6);

        setRelatedProducts(related);
      } catch (relatedError) {
        console.log("ERROR RELATED PRODUCTS:", relatedError);
        setRelatedProducts([]);
      }
    } catch (error) {
      console.log("ERROR PRODUCT DETAIL:", error);
      setProduct(null);
      setErrorMessage("No pudimos cargar el producto.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadProduct();
  }, [routeSlug]);

  const selectedOptionsSignature = useMemo(() => {
    return Object.entries(selectedOptions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join("|");
  }, [selectedOptions]);

  const optionGroups = useMemo(
    () => (product ? getSelectableOptionGroups(product) : []),
    [product]
  );

  const locallySelectedProduct = useMemo(
    () => (product ? applySelectedProductOptions(product, selectedOptions) : null),
    [product, selectedOptionsSignature]
  );

  useEffect(() => {
    if (!product || !optionGroups.length) {
      setResolvedSelectionProduct(null);
      setVariantPricingLoading(false);
      return;
    }

    let cancelled = false;

    async function resolveSelectedVariantPricing() {
      const localProduct = applySelectedProductOptions(product, selectedOptions);
      const key = getProductSlug(product);

      if (!key) return;

      setVariantPricingLoading(true);

      try {
        const destination = await getCurrentPricingDestination();
        const resolved = await resolveProductsForCartItems(
          [
            {
              key,
              selectedOptions: localProduct.selectedOptions || selectedOptions,
              selectedVariantId: localProduct.selectedVariantId,
              quantity: 1,
            },
          ],
          destination
        );

        if (cancelled) return;

        const nextProduct = resolved[0]
          ? applySelectedProductOptions(
              {
                ...localProduct,
                ...resolved[0],
                selectedOptions: resolved[0].selectedOptions || localProduct.selectedOptions,
                selectedVariant: (resolved[0] as any).selectedVariant || localProduct.selectedVariant,
                selectedVariantId: resolved[0].selectedVariantId || localProduct.selectedVariantId,
              },
              resolved[0].selectedOptions || localProduct.selectedOptions || selectedOptions
            )
          : localProduct;

        setResolvedSelectionProduct(nextProduct);
      } catch (error) {
        console.log("ERROR RESOLVE SELECTED VARIANT PRICING:", error);
        if (!cancelled) setResolvedSelectionProduct(localProduct);
      } finally {
        if (!cancelled) setVariantPricingLoading(false);
      }
    }

    resolveSelectedVariantPricing();

    return () => {
      cancelled = true;
    };
  }, [product?._id, product?.slug, selectedOptionsSignature, optionGroups.length]);

  const effectiveProduct = resolvedSelectionProduct || locallySelectedProduct || product;

  const { isFavorite, updatingFavorite, toggleFavorite } = useFavoriteProduct(product);

  const finalPrice = effectiveProduct ? getDisplayFinalPriceUSD(effectiveProduct) : 0;
  const pricingBreakdown = useMemo(
    () => (effectiveProduct ? getPricingBreakdown(effectiveProduct) : []),
    [effectiveProduct]
  );
  const hasPricingBreakdown = effectiveProduct ? productHasPricingBreakdown(effectiveProduct) : false;
  const specifications = useMemo(
    () => (effectiveProduct ? getProductSpecifications(effectiveProduct) : []),
    [effectiveProduct]
  );

  async function handleToggleFavorite() {
    if (!product || updatingFavorite) return;

    try {
      await toggleFavorite();
    } catch (error) {
      console.log("ERROR TOGGLE FAVORITE DETAIL:", error);
      Alert.alert(
        "No pudimos actualizar favoritos",
        "Hubo un problema al guardar este producto. Probá de nuevo."
      );
    }
  }

  function handleOptionSelect(groupName: string, value: string) {
    setSelectedOptions((current) => ({
      ...current,
      [groupName]: value,
    }));
    setResolvedSelectionProduct(null);
    setActiveImageIndex(0);
  }

  async function handleAddToCart() {
    if (!product || addingToCart || variantPricingLoading) return;

    setAddingToCart(true);

    try {
      const productToAdd = effectiveProduct || applySelectedProductOptions(product, selectedOptions);
      await addProductToCart(productToAdd);

      Alert.alert("Producto agregado", "El producto fue agregado al carrito de ShopX.", [
        { text: "Seguir viendo", style: "cancel" },
        { text: "Ir al carrito", onPress: () => router.push("/cart") },
      ]);
    } catch (error) {
      console.log("ERROR ADD TO CART:", error);
      Alert.alert("No pudimos agregarlo", "Probá nuevamente en unos segundos.");
    } finally {
      setAddingToCart(false);
    }
  }


  if (loading) {
    return (
      <View style={styles.app}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={navy} />
          <Text style={styles.loadingText}>Cargando producto...</Text>
        </View>
      </View>
    );
  }

  if (errorMessage || !product) {
    return (
      <View style={styles.app}>
        <View style={styles.errorScreen}>
          <View style={styles.errorIcon}>
            <Feather name="alert-circle" size={34} color={navy} />
          </View>

          <Text style={styles.errorTitle}>No encontramos el producto</Text>
          <Text style={styles.errorText}>
            Puede que el producto ya no esté disponible o que haya cambiado el link.
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const displayProduct = effectiveProduct || product;
  const productImages = getProductImages(displayProduct);
  const imageUrl = getProductImage(displayProduct);
  const description = getShortDescription(displayProduct);
  const canToggleDescription = description.length > DESCRIPTION_PREVIEW_CHAR_LIMIT;

  return (
    <View style={styles.app}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={navy}
            onRefresh={() => {
              setRefreshing(true);
              loadProduct({ silent: true });
            }}
          />
        }
      >
        <View style={styles.headerBand}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.topIconButton} onPress={() => router.back()}>
              <Feather name="chevron-left" size={25} color={white} />
            </TouchableOpacity>

            <View style={styles.topTitleWrap}>
              <Text style={styles.topTitle}>Detalle del producto</Text>
              <Text style={styles.topSubtitle}>Compra en USA. Recibí en Argentina.</Text>
            </View>

            <TouchableOpacity
              style={[styles.topIconButton, isFavorite && styles.favoriteButtonActive]}
              activeOpacity={0.88}
              disabled={updatingFavorite}
              onPress={handleToggleFavorite}
            >
              <Feather name="heart" size={21} color={white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.imageCard}>
          <View style={styles.sourcePill}>
            <Text style={styles.sourcePillText}>{getSourceLabel(displayProduct)}</Text>
          </View>

          {productImages.length > 0 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(
                    event.nativeEvent.contentOffset.x / imageCardWidth
                  );
                  setActiveImageIndex(nextIndex);
                }}
              >
                {productImages.map((uri, index) => (
                  <View
                    key={`${uri}-${index}`}
                    style={[styles.imageSlide, { width: imageCardWidth }]}
                  >
                    <Image source={{ uri }} style={styles.productImage} />
                  </View>
                ))}
              </ScrollView>

              {productImages.length > 1 ? (
                <View style={styles.imageDots}>
                  {productImages.map((uri, index) => (
                    <View
                      key={`dot-${uri}-${index}`}
                      style={[
                        styles.imageDot,
                        index === activeImageIndex && styles.imageDotActive,
                      ]}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.productImage} />
          ) : (
            <MaterialCommunityIcons
              name="package-variant-closed"
              size={72}
              color={muted}
            />
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>{getBrand(displayProduct)}</Text>
            <View style={styles.verifiedPill}>
              <Feather name="check" size={12} color={green} />
              <Text style={styles.verifiedPillText}>ShopX verified</Text>
            </View>
          </View>

          <Text style={styles.productTitle}>{displayProduct.title}</Text>
          <Text style={styles.category}>{getCategoryLabel(displayProduct)}</Text>

          <View style={styles.descriptionBox}>
            <Text
              style={styles.description}
              numberOfLines={descriptionExpanded ? undefined : DESCRIPTION_PREVIEW_LINES}
            >
              {description}
            </Text>

            {canToggleDescription ? (
              <TouchableOpacity
                activeOpacity={0.82}
                style={styles.descriptionToggle}
                onPress={() => setDescriptionExpanded((current) => !current)}
              >
                <Text style={styles.descriptionToggleText}>
                  {descriptionExpanded ? "Ver menos" : "Ver más"}
                </Text>
                <Feather
                  name={descriptionExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={accent}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.priceBlock}>
            <View style={styles.priceTopRow}>
              <Text style={styles.priceEyebrow}>PRECIO FINAL ARGENTINA</Text>
              <View style={styles.noSurprisePill}>
                <Text style={styles.noSurprisePillText}>Sin sorpresas</Text>
              </View>
            </View>

            <Text style={styles.price}>
              {finalPrice ? `USD ${formatUSD(finalPrice)}` : "Consultar"}
            </Text>

            <Text style={styles.priceNote}>
              Incluye producto, impuestos, aduana, gestión ShopX y logística estimada.
            </Text>
          </View>
        </View>

        {optionGroups.length > 0 ? (
          <View style={styles.optionsCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <MaterialCommunityIcons name="tune-variant" size={22} color={navy} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Elegí tus opciones</Text>
                <Text style={styles.cardSubtitle}>
                  Capacidad, color, talle o dimensión según disponibilidad.
                </Text>
              </View>
            </View>

            {optionGroups.map((group) => (
              <ProductOptionSelector
                key={group.name}
                name={group.name}
                values={group.values}
                selectedValue={selectedOptions[group.name]}
                onSelect={(value) => handleOptionSelect(group.name, value)}
              />
            ))}

            {variantPricingLoading ? (
              <View style={styles.variantLoadingRow}>
                <ActivityIndicator size="small" color={navy} />
                <Text style={styles.variantLoadingText}>Actualizando precio final...</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {specifications.length > 0 ? (
          <View style={styles.specsCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <MaterialCommunityIcons name="format-list-bulleted" size={22} color={navy} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Especificaciones</Text>
                <Text style={styles.cardSubtitle}>Características principales del producto.</Text>
              </View>
            </View>

            <View style={styles.specsGrid}>
              {specifications.map((row, index) => (
                <View key={`${row.label}-${index}`} style={styles.specRow}>
                  <Text style={styles.specLabel}>{row.label}</Text>
                  <Text style={styles.specValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.trustGrid}>
          <TrustBadge
            icon="truck-delivery-outline"
            title="5–10 días"
            subtitle="A todo el país"
          />
          <TrustBadge
            icon="shield-check-outline"
            title="Compra protegida"
            subtitle="Acompañamiento real"
          />
          <TrustBadge
            icon="map-marker-path"
            title="Tracking"
            subtitle="Seguimiento real"
          />
          <TrustBadge
            icon="credit-card-outline"
            title="Pago local"
            subtitle="Mercado Pago"
          />
        </View>

        {hasPricingBreakdown ? (
          <View style={styles.breakdownCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <MaterialCommunityIcons name="receipt-text-outline" size={22} color={navy} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Qué incluye el precio</Text>
                <Text style={styles.cardSubtitle}>
                  Detalle de conceptos incluidos en el precio final.
                </Text>
              </View>
            </View>

            {pricingBreakdown.map((row, index) => (
              <BreakdownRow
                key={`${row.label}-${index}`}
                label={row.label}
                value={`USD ${formatUSD(row.amount)}`}
              />
            ))}

            <BreakdownRow
              label="Total final Argentina"
              value={finalPrice ? `USD ${formatUSD(finalPrice)}` : "USD 0"}
              strong
            />
          </View>
        ) : null}

        <View style={styles.deliveryCard}>
          <View style={styles.deliveryIcon}>
            <MaterialCommunityIcons name="airplane-takeoff" size={27} color={navy} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.deliveryTitle}>Entrega estimada</Text>
            <Text style={styles.deliveryText}>
              Recibís tu compra en Argentina en aproximadamente 5 a 10 días hábiles
              una vez comprado en origen.
            </Text>
          </View>
        </View>

        <View style={styles.actionsBlock}>
          <TouchableOpacity
            style={[
              styles.addToCartButton,
              (addingToCart || variantPricingLoading) && styles.buttonDisabled,
            ]}
            activeOpacity={0.9}
            disabled={addingToCart || variantPricingLoading}
            onPress={handleAddToCart}
          >
            {addingToCart || variantPricingLoading ? (
              <ActivityIndicator color={white} />
            ) : (
              <>
                <Feather name="shopping-cart" size={20} color={white} />
                <Text style={styles.addToCartText}>Agregar al carrito</Text>
              </>
            )}
          </TouchableOpacity>

        </View>

        {relatedProducts.length > 0 ? (
          <>
            <View style={styles.relatedHeader}>
              <View>
                <Text style={styles.relatedEyebrow}>SHOPX CURATED</Text>
                <Text style={styles.relatedTitle}>También puede interesarte</Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/categories")}>
                <Text style={styles.relatedLink}>Ver más</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedRow}
            >
              {relatedProducts.map((item) => {
                const relatedImage = getProductImage(item);
                const relatedPrice = getDisplayFinalPriceUSD(item);
                const key = getProductSlug(item);

                return (
                  <TouchableOpacity
                    key={key || item.title}
                    style={styles.relatedCard}
                    activeOpacity={0.88}
                    onPress={() => key && router.push(`/product/${encodeURIComponent(key)}`)}
                  >
                    <View style={styles.relatedImageBox}>
                      {relatedImage ? (
                        <Image source={{ uri: relatedImage }} style={styles.relatedImage} />
                      ) : (
                        <MaterialCommunityIcons
                          name="package-variant-closed"
                          size={38}
                          color={muted}
                        />
                      )}
                    </View>

                    <Text style={styles.relatedBrand}>{getBrand(item)}</Text>
                    <Text style={styles.relatedProductTitle} numberOfLines={2}>
                      {item.title}
                    </Text>

                    <Text style={styles.relatedPrice}>
                      {relatedPrice ? `USD ${formatUSD(relatedPrice)}` : "Consultar"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        ) : null}

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
  headerBand: {
    backgroundColor: navy,
    paddingTop: 42,
    paddingBottom: 76,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
  },
  topBar: {
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topIconButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteButtonActive: {
    backgroundColor: accent,
    borderColor: accent,
  },
  topTitleWrap: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 12,
  },
  topTitle: {
    color: white,
    fontSize: 16,
    fontWeight: "900",
  },
  topSubtitle: {
    marginTop: 3,
    color: "rgba(255,255,255,0.68)",
    fontSize: 11,
    fontWeight: "700",
  },
  imageCard: {
    marginHorizontal: 18,
    marginTop: -58,
    height: 310,
    borderRadius: 32,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    shadowColor: navy,
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  sourcePill: {
    position: "absolute",
    top: 16,
    left: 16,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: "#EAFBFD",
    zIndex: 2,
  },
  sourcePillText: {
    color: navy,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  imageSlide: {
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  productImage: {
    width: "86%",
    height: "82%",
    resizeMode: "contain",
  },
  imageDots: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  imageDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(6,43,79,0.22)",
  },
  imageDotActive: {
    width: 18,
    backgroundColor: navy,
  },
  infoCard: {
    marginHorizontal: 18,
    marginTop: 16,
    borderRadius: 28,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  brand: {
    color: "#9AA6B8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    flex: 1,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: greenSoft,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  verifiedPillText: {
    color: green,
    fontSize: 10,
    fontWeight: "900",
  },
  productTitle: {
    marginTop: 10,
    color: text,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  category: {
    marginTop: 8,
    color: muted,
    fontSize: 14,
    fontWeight: "700",
  },
  descriptionBox: {
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 10,
  },
  description: {
    color: "#41536A",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  descriptionToggle: {
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  descriptionToggleText: {
    color: accent,
    fontSize: 13,
    fontWeight: "900",
  },
  priceBlock: {
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: softCard,
    padding: 16,
  },
  priceTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  priceEyebrow: {
    color: "#9AA6B8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.35,
    flex: 1,
  },
  noSurprisePill: {
    borderRadius: 999,
    backgroundColor: white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: border,
  },
  noSurprisePillText: {
    color: navy,
    fontSize: 10,
    fontWeight: "900",
  },
  price: {
    marginTop: 5,
    color: navy,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
  },
  priceNote: {
    marginTop: 6,
    color: muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  trustGrid: {
    marginHorizontal: 18,
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  trustBadge: {
    width: "48.5%",
    borderRadius: 22,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: navy,
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  trustIcon: {
    width: 39,
    height: 39,
    borderRadius: 15,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  trustBadgeTitle: {
    color: text,
    fontSize: 13,
    fontWeight: "900",
  },
  trustBadgeSubtitle: {
    marginTop: 2,
    color: muted,
    fontSize: 11,
    fontWeight: "600",
  },
  optionsCard: {
    marginHorizontal: 18,
    marginTop: 16,
    borderRadius: 28,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  optionGroup: {
    borderTopWidth: 1,
    borderTopColor: border,
    paddingTop: 13,
    paddingBottom: 4,
  },
  optionGroupTitle: {
    color: text,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 10,
  },
  optionValuesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: softCard,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  optionChipSelected: {
    backgroundColor: navy,
    borderColor: navy,
  },
  optionChipText: {
    color: text,
    fontSize: 13,
    fontWeight: "900",
  },
  optionChipTextSelected: {
    color: white,
  },
  variantLoadingRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: border,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  variantLoadingText: {
    color: muted,
    fontSize: 12,
    fontWeight: "800",
  },
  specsCard: {
    marginHorizontal: 18,
    marginTop: 16,
    borderRadius: 28,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  specsGrid: {
    borderTopWidth: 1,
    borderTopColor: border,
  },
  specRow: {
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: border,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  specLabel: {
    flex: 0.88,
    color: muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  specValue: {
    flex: 1.12,
    color: text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
    textAlign: "right",
  },
  breakdownCard: {
    marginHorizontal: 18,
    marginTop: 16,
    borderRadius: 28,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  cardHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: text,
    fontSize: 17,
    fontWeight: "900",
  },
  cardSubtitle: {
    marginTop: 3,
    color: muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  breakdownRow: {
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  breakdownRowStrong: {
    marginTop: 8,
    borderTopWidth: 0,
    borderRadius: 18,
    backgroundColor: navy,
    paddingHorizontal: 14,
  },
  breakdownLabel: {
    color: muted,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  breakdownValue: {
    color: text,
    fontSize: 14,
    fontWeight: "900",
  },
  breakdownLabelStrong: {
    color: "rgba(255,255,255,0.74)",
  },
  breakdownValueStrong: {
    color: white,
    fontSize: 16,
  },
  quoteInlineButton: {
    height: 50,
    borderRadius: 18,
    backgroundColor: "#EAFBFD",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  quoteInlineButtonText: {
    color: navy,
    fontSize: 15,
    fontWeight: "900",
  },
  deliveryCard: {
    marginHorizontal: 18,
    marginTop: 16,
    borderRadius: 24,
    backgroundColor: orangeSoft,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFE3AA",
  },
  deliveryIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  deliveryTitle: {
    color: text,
    fontSize: 16,
    fontWeight: "900",
  },
  deliveryText: {
    marginTop: 4,
    color: "#7A5A18",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  actionsBlock: {
    marginHorizontal: 18,
    marginTop: 18,
    gap: 12,
  },
  addToCartButton: {
    height: 58,
    borderRadius: 999,
    backgroundColor: navy,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    shadowColor: navy,
    shadowOpacity: 0.13,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.74,
  },
  addToCartText: {
    color: white,
    fontSize: 16,
    fontWeight: "900",
  },
  relatedHeader: {
    paddingHorizontal: 18,
    marginTop: 28,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  relatedEyebrow: {
    color: "#9AA6B8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  relatedTitle: {
    color: text,
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  relatedLink: {
    color: accent,
    fontSize: 14,
    fontWeight: "900",
  },
  relatedRow: {
    paddingLeft: 18,
    paddingRight: 12,
    gap: 14,
  },
  relatedCard: {
    width: 145,
    minHeight: 214,
    borderRadius: 22,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 11,
  },
  relatedImageBox: {
    height: 98,
    borderRadius: 16,
    backgroundColor: softCard,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 10,
  },
  relatedImage: {
    width: "92%",
    height: "92%",
    resizeMode: "contain",
  },
  relatedBrand: {
    color: "#9AA6B8",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  relatedProductTitle: {
    color: text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    minHeight: 34,
    marginTop: 6,
  },
  relatedPrice: {
    marginTop: 8,
    color: navy,
    fontSize: 14,
    fontWeight: "900",
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: soft,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: muted,
    fontSize: 14,
    fontWeight: "700",
  },
  errorScreen: {
    flex: 1,
    backgroundColor: soft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 28,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  errorTitle: {
    color: text,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  errorText: {
    marginTop: 8,
    color: muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: 20,
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: white,
    fontSize: 15,
    fontWeight: "900",
  },
});