import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  formatUSD,
  getDisplayFinalPriceUSD,
  getProductBySlug,
  getProductImage,
  ShopXProduct,
} from "../../lib/api";
import {
  addProductToCart,
  getCartItems,
} from "../../lib/cart-store";
import { getProductFromCache } from "../../lib/product-cache";

function getProductPrice(product: ShopXProduct) {
  return getDisplayFinalPriceUSD(product) || 0;
}

function getCategory(product: ShopXProduct) {
  if (typeof product.category === "string") {
    return product.category;
  }

  return (
    product.category?.leaf ||
    product.category?.sub ||
    product.category?.main ||
    "Producto USA"
  );
}

function getBrand(product: ShopXProduct) {
  return (
    product.brand ||
    product.store ||
    product.source ||
    "SHOPX"
  ).toUpperCase();
}

function isEbayProduct(product: ShopXProduct) {
  return (
    product.source === "ebay" ||
    product.store?.toLowerCase().includes("ebay")
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [product, setProduct] = useState<ShopXProduct | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [added, setAdded] = useState(false);

  async function refreshCartCount() {
    const cartItems = await getCartItems();

    const count = cartItems.reduce((total, item) => {
      return total + Number(item.quantity || 0);
    }, 0);

    setTotalItems(count);
  }

  useFocusEffect(
    useCallback(() => {
      refreshCartCount();
    }, [])
  );

  useEffect(() => {
    async function loadProduct() {
      const productId = id || "";

      setLoading(true);
      setErrorMessage("");

      const cachedProduct = getProductFromCache(productId);

      if (cachedProduct) {
        setProduct(cachedProduct);
        setLoading(false);
        return;
      }

      try {
        const result = await getProductBySlug(productId);

        if (!result) {
          setErrorMessage("No encontramos este producto.");
          setLoading(false);
          return;
        }

        setProduct(result);
      } catch (error) {
        console.log("ERROR PRODUCT DETAIL:", error);
        setErrorMessage("No pudimos cargar el producto.");
      }

      setLoading(false);
    }

    loadProduct();
  }, [id]);

  async function handleAddToCart() {
    if (!product) return;

    await addProductToCart(product);
    await refreshCartCount();

    setAdded(true);

    setTimeout(() => {
      setAdded(false);
    }, 1400);
  }

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color={navy} size="large" />
        <Text style={styles.loadingText}>Cargando producto...</Text>
      </View>
    );
  }

  if (errorMessage || !product) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.errorTitle}>Producto no disponible</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>

        <TouchableOpacity
          style={styles.errorButton}
          onPress={() => router.back()}
        >
          <Text style={styles.errorButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const imageUrl = getProductImage(product);
  const price = getProductPrice(product);
  const category = getCategory(product);
  const brand = getBrand(product);
  const ebay = isEbayProduct(product);

  return (
    <View style={styles.app}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹ Volver</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cartTopButton}
            onPress={() => router.push("/cart")}
          >
            <Text style={styles.cartTopText}>🛒</Text>

            {totalItems > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalItems}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {added ? (
          <TouchableOpacity
            style={styles.addedToast}
            onPress={() => router.push("/cart")}
          >
            <Text style={styles.addedToastText}>
              Agregado al carrito · Ver carrito
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.imageCard}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>{brand}</Text>
          </View>

          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.productImage} />
          ) : (
            <Text style={styles.productIcon}>📦</Text>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.category}>{category}</Text>

          <Text style={styles.title}>{product.title}</Text>

          <Text style={styles.finalArgentina}>FINAL ARGENTINA</Text>

          <Text style={styles.price}>
            {price ? (
              <>
                <Text style={styles.usd}>USD </Text>
                {formatUSD(price)}
              </>
            ) : (
              "Consultar"
            )}
          </Text>

          <Text style={styles.finalText}>
            Precio final estimado en Argentina
          </Text>

          {ebay ? (
            <View style={styles.ebayBox}>
              <Text style={styles.ebayTitle}>
                Producto encontrado en eBay USA
              </Text>
              <Text style={styles.ebayText}>
                ShopX puede comprarlo por vos, traerlo a Argentina y coordinar
                la entrega puerta a puerta.
              </Text>

              {!!product.sourceUrl ? (
                <TouchableOpacity
                  style={styles.ebayButton}
                  onPress={() => Linking.openURL(product.sourceUrl!)}
                >
                  <Text style={styles.ebayButtonText}>
                    Ver publicación original
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {!!product.description && !product.description.startsWith("http") ? (
            <Text style={styles.description} numberOfLines={10}>
              {product.description}
            </Text>
          ) : null}

          <View style={styles.trustBox}>
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>✓</Text>
              <Text style={styles.trustText}>Precio final estimado</Text>
            </View>

            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🚚</Text>
              <Text style={styles.trustText}>
                Entrega estimada 5 a 10 días hábiles
              </Text>
            </View>

            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>📦</Text>
              <Text style={styles.trustText}>
                Seguimiento del pedido en tiempo real
              </Text>
            </View>

            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🛡</Text>
              <Text style={styles.trustText}>Compra protegida por ShopX</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push("/quote")}
        >
          <Text style={styles.secondaryButtonText}>Cotizar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryButton} onPress={handleAddToCart}>
          <Text style={styles.primaryButtonText}>Agregar al carrito</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const navy = "#082A4D";
const text = "#08294A";
const muted = "#617590";
const accent = "#16C5DF";
const border = "#E3EAF2";
const soft = "#F6F8FB";

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
  centerScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: muted,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 14,
  },
  errorTitle: {
    color: text,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },
  errorText: {
    color: muted,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 22,
  },
  errorButton: {
    backgroundColor: navy,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  errorButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    alignSelf: "flex-start",
  },
  backText: {
    color: navy,
    fontSize: 17,
    fontWeight: "900",
  },
  cartTopButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: soft,
    borderWidth: 1,
    borderColor: border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cartTopText: {
    fontSize: 20,
  },
  cartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: accent,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  addedToast: {
    backgroundColor: navy,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  addedToastText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  imageCard: {
    height: 330,
    borderRadius: 30,
    backgroundColor: soft,
    borderWidth: 1,
    borderColor: border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  brandBadge: {
    position: "absolute",
    top: 18,
    left: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: navy,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
    zIndex: 2,
  },
  brandBadgeText: {
    color: navy,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  productImage: {
    width: "90%",
    height: "90%",
    resizeMode: "contain",
  },
  productIcon: {
    fontSize: 120,
  },
  info: {
    paddingTop: 24,
  },
  category: {
    color: "#9AA6B8",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    color: text,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -1,
    marginBottom: 14,
  },
  finalArgentina: {
    color: "#9AA6B8",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  price: {
    color: text,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1,
  },
  usd: {
    fontSize: 18,
    fontWeight: "700",
  },
  finalText: {
    color: muted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
    marginBottom: 18,
  },
  description: {
    color: muted,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    marginBottom: 22,
  },
  ebayBox: {
    borderRadius: 22,
    backgroundColor: "#F3F8FC",
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    marginBottom: 20,
  },
  ebayTitle: {
    color: text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },
  ebayText: {
    color: muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  ebayButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ebayButtonText: {
    color: navy,
    fontSize: 13,
    fontWeight: "900",
  },
  trustBox: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    gap: 14,
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  trustIcon: {
    width: 28,
    fontSize: 20,
  },
  trustText: {
    flex: 1,
    color: text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: border,
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: border,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: text,
    fontSize: 15,
    fontWeight: "900",
  },
  primaryButton: {
    flex: 1.5,
    borderRadius: 999,
    backgroundColor: navy,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
});