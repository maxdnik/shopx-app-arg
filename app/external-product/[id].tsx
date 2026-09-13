import {
  basketCartProducts,
  calculateQuoteBasket,
  QuoteBasket,
} from "../../lib/quote-basket";
import { PriceSummary } from "../../components/PriceSummary";
import { ImageViewer } from "../../components/ImageViewer";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { addProductsToCart } from "../../lib/cart-store";
import { formatUSD } from "../../lib/api";
import { buildApiUrl } from "../../lib/config";

const navy = "#082A4D";
const muted = "#617590";
const soft = "#F6F8FB";
const border = "#E3EAF2";
const green = "#00865A";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function number(value: any) {
  const parsed = Number(
    String(value || "")
      .replace(/[^0-9.,-]/g, "")
      .replace(/,/g, ""),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values: any[]) {
  return Array.from(
    new Set(
      values.filter(
        (value) => typeof value === "string" && value.startsWith("http"),
      ),
    ),
  );
}

function collectImages(value: any): string[] {
  const output: string[] = [];
  const visit = (entry: any) => {
    if (!entry) return;
    if (typeof entry === "string") {
      if (entry.startsWith("http")) output.push(entry);
      return;
    }
    if (Array.isArray(entry)) return entry.forEach(visit);
    if (typeof entry === "object") {
      visit(entry.url);
      visit(entry.src);
      visit(entry.image);
      visit(entry.imageUrl);
      visit(entry.image_url);
      visit(entry.main_image);
      visit(entry.thumbnail);
      visit(entry.variant_image);
      visit(entry.swatch_image);
      visit(entry.images);
      visit(entry.image_urls);
      visit(entry.media);
      visit(entry.imageDetails?.images);
    }
  };
  visit(value);
  return unique(output);
}

function labelFor(key: string) {
  const lower = key.toLowerCase();
  if (lower.includes("color") || lower.includes("colour")) return "Color";
  if (
    lower.includes("size") ||
    lower.includes("talle") ||
    lower.includes("talla")
  )
    return "Talle";
  if (lower.includes("capacity") || lower.includes("storage"))
    return "Capacidad";
  if (lower.includes("style")) return "Estilo";
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildAmazonData(rawProduct: any) {
  const raw = rawProduct?.raw || {};
  const groups: Record<string, string[]> = {};
  const matrix: any[] = [];
  const candidateKeys = [
    "color",
    "colour",
    "size",
    "style",
    "capacity",
    "storage",
    "pattern",
    "model",
  ];

  for (const group of Array.isArray(raw.variations_values)
    ? raw.variations_values
    : []) {
    const name = labelFor(String(group?.variant_name || group?.name || ""));
    const values = (Array.isArray(group?.values) ? group.values : [])
      .map((entry: any) =>
        String(
          typeof entry === "string"
            ? entry
            : entry?.value || entry?.label || entry?.name || "",
        ).trim(),
      )
      .filter(Boolean);
    if (name && values.length)
      groups[name] = Array.from(new Set([...(groups[name] || []), ...values]));
  }

  for (const variation of Array.isArray(rawProduct?.variations)
    ? rawProduct.variations
    : []) {
    const selections: Record<string, string> = {};
    for (const key of candidateKeys) {
      const value = String(variation?.[key] || "").trim();
      if (!value) continue;
      const label = labelFor(key);
      selections[label] = value;
      groups[label] = Array.from(new Set([...(groups[label] || []), value]));
    }
    if (!Object.keys(selections).length) continue;
    const images = collectImages(variation);
    matrix.push({
      selections,
      url: String(variation.url || variation.product_url || ""),
      sku: String(variation.asin || variation.sku || ""),
      price: number(
        variation.final_price || variation.price || variation.current_price,
      ),
      available: variation.is_available !== false,
      image: images[0],
      images,
    });
  }

  return { groups, matrix };
}

function selectionMatches(entry: any, selected: Record<string, string>) {
  const keys = Object.keys(selected).filter((key) => selected[key]);
  return (
    keys.length > 0 &&
    keys.every((key) => entry?.selections?.[key] === selected[key])
  );
}

export default function ExternalProductScreen() {
  const params = useLocalSearchParams<Record<string, string>>();
  const source = first(params.source).toLowerCase();
  const sourceUrl = first(params.url);
  const fallbackTitle = first(params.title);
  const fallbackImage = first(params.image);
  const [quote, setQuote] = useState<QuoteBasket>();
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState("");
  const [adding, setAdding] = useState(false);

  const [loading, setLoading] = useState(source === "amazon");
  const [error, setError] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [activeImage, setActiveImage] = useState(fallbackImage);
  const [selector, setSelector] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (source !== "amazon" || !sourceUrl) return;
    (async () => {
      try {
        const response = await fetch(
          buildApiUrl(
            `/api/app/external-product?source=amazon&url=${encodeURIComponent(sourceUrl)}`,
          ),
        );
        if (!response.ok) throw new Error("detail request failed");
        const data = await response.json();
        setProduct(data.product);
        const images = collectImages(data.product?.images || data.product);
        if (images[0]) setActiveImage(images[0]);
      } catch (err) {
        console.log("EXTERNAL PRODUCT ERROR", err);
        setError(
          "No pudimos cargar todas las opciones. Podés abrir la publicación original.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [source, sourceUrl]);

  const amazon = useMemo(() => buildAmazonData(product), [product]);
  const selectedCombination = useMemo(
    () => amazon.matrix.find((entry) => selectionMatches(entry, selected)),
    [amazon.matrix, selected],
  );

  useEffect(() => {
    if (!product || Object.keys(selected).length) return;
    const defaults: Record<string, string> = {};
    Object.entries(amazon.groups).forEach(([key, values]) => {
      if (values[0]) defaults[key] = values[0];
    });
    setSelected(defaults);
  }, [product, amazon.groups, selected]);

  useEffect(() => {
    const images = selectedCombination?.images?.length
      ? selectedCombination.images
      : selectedCombination?.image
        ? [selectedCombination.image]
        : [];
    if (images[0]) setActiveImage(images[0]);
  }, [selectedCombination]);

  const gallery = useMemo(() => {
    const variantImages = selectedCombination?.images || [];
    return unique([
      ...variantImages,
      ...collectImages(product?.images || product),
      fallbackImage,
    ]);
  }, [selectedCombination, product, fallbackImage]);

  const hasOptions = Object.keys(amazon.groups).length > 0;
  const variantUrlKnown =
    !!selectedCombination?.url ||
    /^[A-Z0-9]{10}$/.test(selectedCombination?.sku || "");
  const selectionReady =
    !error &&
    (!hasOptions ||
      (!!selectedCombination &&
        variantUrlKnown &&
        selectedCombination.available !== false &&
        Object.keys(amazon.groups).every((key) => selected[key])));
  const selectedUrl =
    selectedCombination?.url ||
    (source === "amazon" &&
    /^[A-Z0-9]{10}$/.test(selectedCombination?.sku || "")
      ? `https://www.amazon.com/dp/${selectedCombination.sku}`
      : sourceUrl);
  useEffect(() => {
    if (!selectedUrl || loading || !selectionReady) {
      setQuote(undefined);
      return;
    }
    let active = true;
    setPricingLoading(true);
    setPricingError("");
    setQuote(undefined);
    calculateQuoteBasket([selectedUrl])
      .then((result) => {
        if (active) setQuote(result);
      })
      .catch((error) => {
        if (active)
          setPricingError(
            error instanceof Error
              ? error.message
              : "No pudimos calcular el precio.",
          );
      })
      .finally(() => {
        if (active) setPricingLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedUrl, loading, selectionReady]);
  const finalPrice = quote?.pricing.totalFinal || 0;
  const title = product?.title || fallbackTitle;
  const rating = number(product?.rating || first(params.rating));
  const reviews = number(
    product?.reviewsCount ||
      product?.reviews_count ||
      first(params.reviewsCount),
  );
  const brand =
    product?.brand ||
    first(params.brand) ||
    (source === "amazon" ? "Amazon" : "eBay");
  const description =
    product?.description ||
    product?.raw?.description ||
    "Producto seleccionado para comprar en Estados Unidos y recibir en Argentina mediante ShopX.";

  async function addToCart() {
    if (
      !quote ||
      !selectionReady ||
      pricingLoading ||
      adding ||
      quote.errors?.length ||
      quote.pricing.checkoutEnabled === false
    )
      return;
    setAdding(true);
    try {
      if (quote.expiresAt && new Date(quote.expiresAt).getTime() <= Date.now())
        throw new Error(
          "La cotización venció. Volvé a abrir el producto para actualizarla.",
        );
      await addProductsToCart(
        basketCartProducts(quote).map((item) => ({
          ...item,
          product: {
            ...item.product,
            selectedOptions: selected,
            images: gallery,
            imageUrl: activeImage,
          },
        })),
      );
      setAdded(true);
    } catch (error) {
      setPricingError(
        error instanceof Error
          ? error.message
          : "No pudimos agregar el producto.",
      );
    } finally {
      setAdding(false);
    }
  }

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={navy} />
        <Text style={styles.loading}>
          Cargando opciones, imágenes y precio...
        </Text>
      </View>
    );

  return (
    <View style={styles.app}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>‹ Volver</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/cart")}>
            <Text style={styles.cart}>🛒</Text>
          </TouchableOpacity>
        </View>
        {added && (
          <TouchableOpacity
            style={styles.toast}
            onPress={() => router.push("/cart")}
          >
            <Text style={styles.toastText}>
              Agregado al carrito · Ver carrito
            </Text>
          </TouchableOpacity>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {!!pricingError && (
          <Text style={{ color: "#B42318", padding: 18 }}>{pricingError}</Text>
        )}
        {!selectionReady && (
          <Text style={{ color: "#617590", padding: 18 }}>
            Elegí una combinación disponible para confirmar el precio.
          </Text>
        )}
        <View style={styles.imageCard}>
          {activeImage ? (
            <TouchableOpacity
              accessibilityLabel="Ampliar foto del producto"
              style={{ width: "100%", height: "100%" }}
              onPress={() =>
                setViewerIndex(Math.max(0, gallery.indexOf(activeImage)))
              }
            >
              <Image source={{ uri: activeImage }} style={styles.mainImage} />
            </TouchableOpacity>
          ) : (
            <Text style={{ fontSize: 50 }}>📦</Text>
          )}
        </View>
        {gallery.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.thumbs}
          >
            {gallery.map((image) => (
              <TouchableOpacity
                key={image}
                onPress={() => setActiveImage(image)}
                style={[
                  styles.thumb,
                  activeImage === image && styles.thumbActive,
                ]}
              >
                <Image source={{ uri: image }} style={styles.thumbImage} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.priceCard}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>{brand.toUpperCase()}</Text>
            <Text style={styles.allIn}>PUESTO EN ARGENTINA</Text>
          </View>
          <Text style={styles.price}>
            {finalPrice
              ? `USD ${formatUSD(finalPrice)}`
              : pricingLoading
                ? "Calculando precio..."
                : "Precio pendiente"}
          </Text>
          <Text style={styles.included}>
            FLETE INTERNACIONAL, ADUANA Y GESTIÓN INCLUIDOS
          </Text>
        </View>

        {Object.entries(amazon.groups).map(([attribute, values]) => (
          <View key={attribute} style={styles.optionGroup}>
            <Text style={styles.optionLabel}>{attribute.toUpperCase()}</Text>
            {values.length <= 4 ? (
              <View style={styles.optionButtons}>
                {values.map((value) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() =>
                      setSelected((current) => ({
                        ...current,
                        [attribute]: value,
                      }))
                    }
                    style={[
                      styles.optionButton,
                      selected[attribute] === value &&
                        styles.optionButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selected[attribute] === value &&
                          styles.optionTextActive,
                      ]}
                    >
                      {value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setSelector(attribute)}
              >
                <Text style={styles.selectText}>
                  {selected[attribute] || `Seleccionar ${attribute}`}
                </Text>
                <Text>⌄</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {!!rating && (
          <Text style={styles.rating}>
            {rating.toFixed(1)} ★{" "}
            {reviews ? `(${reviews.toLocaleString("es-AR")} reseñas)` : ""}
          </Text>
        )}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {!!sourceUrl && (
          <TouchableOpacity
            style={styles.original}
            onPress={() => Linking.openURL(sourceUrl)}
          >
            <Text style={styles.originalText}>Ver publicación original</Text>
          </TouchableOpacity>
        )}
        {!!quote && (
          <View style={{ padding: 18, gap: 14 }}>
            <Text style={{ color: "#062B4F", fontSize: 18, fontWeight: "800" }}>
              Qué incluye el precio
            </Text>
            <PriceSummary rows={quote.pricing.breakdown} />
          </View>
        )}
        <View style={{ height: 130 }} />
      </ScrollView>
      <ImageViewer
        images={gallery}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerIndex(null)}
      />

      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={addToCart}
          disabled={
            !quote ||
            pricingLoading ||
            adding ||
            !selectionReady ||
            !!quote.errors?.length ||
            quote.pricing.checkoutEnabled === false
          }
        >
          <Text style={styles.addText}>Agregar al carrito</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={!!selector}
        transparent
        animationType="slide"
        onRequestClose={() => setSelector(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelector(null)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Seleccionar {selector}</Text>
            <ScrollView>
              {selector &&
                (amazon.groups[selector] || []).map((value) => (
                  <TouchableOpacity
                    key={value}
                    style={styles.modalOption}
                    onPress={() => {
                      setSelected((current) => ({
                        ...current,
                        [selector]: value,
                      }));
                      setSelector(null);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{value}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#FFF" },
  content: { paddingTop: 58, paddingHorizontal: 18 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    backgroundColor: "#FFF",
  },
  loading: {
    color: muted,
    marginTop: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  back: { color: navy, fontSize: 17, fontWeight: "900" },
  cart: { fontSize: 22 },
  toast: {
    backgroundColor: navy,
    padding: 12,
    borderRadius: 999,
    marginBottom: 12,
  },
  toastText: { color: "#FFF", textAlign: "center", fontWeight: "900" },
  error: {
    color: "#C62828",
    backgroundColor: "#FFF1F1",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  imageCard: {
    height: 360,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: soft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  mainImage: { width: "100%", height: "100%", resizeMode: "contain" },
  thumbs: { marginVertical: 12 },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: soft,
    marginRight: 9,
    padding: 5,
  },
  thumbActive: { borderColor: navy },
  thumbImage: { width: "100%", height: "100%", resizeMode: "contain" },
  priceCard: {
    backgroundColor: "#E9FBF3",
    borderWidth: 1,
    borderColor: "#C8F1DE",
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brand: {
    color: navy,
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
  },
  allIn: {
    color: "#087354",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  price: { color: green, fontSize: 38, fontWeight: "900", marginTop: 10 },
  included: {
    color: "#3C9C7F",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 5,
  },
  optionGroup: { marginBottom: 16 },
  optionLabel: {
    color: "#8EA1BB",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
  },
  optionButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: {
    borderWidth: 1,
    borderColor: border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  optionButtonActive: { backgroundColor: navy, borderColor: navy },
  optionText: { color: navy, fontSize: 12, fontWeight: "800" },
  optionTextActive: { color: "#FFF" },
  selectButton: {
    minHeight: 52,
    borderWidth: 2,
    borderColor: "#2587F0",
    borderRadius: 14,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: { color: navy, fontWeight: "900", flex: 1 },
  rating: { color: "#F59E0B", fontSize: 14, fontWeight: "900", marginTop: 6 },
  title: {
    color: navy,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
    marginTop: 13,
  },
  description: { color: muted, fontSize: 14, lineHeight: 22, marginTop: 12 },
  original: {
    alignSelf: "flex-start",
    marginTop: 18,
    borderWidth: 1,
    borderColor: navy,
    borderRadius: 999,
    paddingHorizontal: 17,
    paddingVertical: 11,
  },
  originalText: { color: navy, fontWeight: "900" },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: border,
  },
  addButton: {
    backgroundColor: "#E02020",
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: "center",
  },
  addText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "72%",
    padding: 20,
  },
  modalTitle: {
    color: navy,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
  },
  modalOption: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  modalOptionText: { color: navy, fontSize: 15, fontWeight: "800" },
});
