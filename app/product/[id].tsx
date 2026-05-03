import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { addProductToCart } from "../../lib/cart-store";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { AppBottomNav } from "../../components/AppBottomNav";
import {
  formatUSD,
  getDisplayFinalPriceUSD,
  getProductImage,
  getProducts,
  ShopXProduct,
} from "../../lib/api";

const navy = "#062B4F";
const navyDark = "#031A33";
const text = "#071E35";
const muted = "#718096";
const accent = "#18C7D8";
const soft = "#F7FAFC";
const softCard = "#F1F5F9";
const border = "#E2E8F0";
const white = "#FFFFFF";
const green = "#0EA371";
const greenSoft = "#E7FFF4";
const orange = "#F59E0B";
const orangeSoft = "#FFF7E6";

function getProductSlug(product: ShopXProduct) {
  return product.slug || product._id || product.id || product.externalId || "";
}

function getBrand(product: ShopXProduct) {
  return (
    product.brand ||
    product.store ||
    product.source ||
    "SHOPX"
  ).toUpperCase();
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
  if (product.source === "amazon") return "AMAZON USA";
  if (product.source === "ebay") return "EBAY USA";
  if (product.source === "manual" || product.source === "shopx") return "SHOPX";

  return getBrand(product);
}

function getBasePrice(product: ShopXProduct) {
  const anyProduct = product as any;

  return (
    Number(anyProduct.priceUSD) ||
    Number(anyProduct.price) ||
    Number(anyProduct.originalPriceUSD) ||
    0
  );
}

function buildBreakdown(product: ShopXProduct) {
  const finalPrice = getDisplayFinalPriceUSD(product) || 0;
  const basePrice = getBasePrice(product);

  const productUSD = basePrice || Math.round(finalPrice * 0.62);
  const serviceUSD = Math.max(Math.round(productUSD * 0.1), 10);
  const shippingUSD = Math.max(Math.round(finalPrice * 0.12), 18);
  const taxesUSD = Math.max(finalPrice - productUSD - serviceUSD - shippingUSD, 0);

  return {
    productUSD,
    serviceUSD,
    shippingUSD,
    taxesUSD,
    totalUSD: finalPrice,
  };
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
        <MaterialCommunityIcons name={icon as any} size={22} color={navy} />
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
      <Text style={[styles.breakdownLabel, strong && styles.breakdownLabelStrong]}>
        {label}
      </Text>
      <Text style={[styles.breakdownValue, strong && styles.breakdownValueStrong]}>
        {value}
      </Text>
    </View>
  );
}

export default function ProductDetailScreen() {
  const params = useLocalSearchParams();
  const routeSlug = String(params.slug || params.id || "");

  const [products, setProducts] = useState<ShopXProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadProduct() {
    setLoading(true);
    setErrorMessage("");

    try {
      const result = await getProducts(150);
      setProducts(result);
    } catch (error) {
      console.log("ERROR PRODUCT DETAIL:", error);
      setErrorMessage("No pudimos cargar el producto.");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadProduct();
  }, []);

  const product = useMemo(() => {
    return products.find((item) => getProductSlug(item) === routeSlug);
  }, [products, routeSlug]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];

    const currentCategory = getCategoryLabel(product);

    return products
      .filter((item) => getProductSlug(item) !== getProductSlug(product))
      .filter((item) => getCategoryLabel(item) === currentCategory)
      .slice(0, 6);
  }, [products, product]);

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

  const imageUrl = getProductImage(product);
  const finalPrice = getDisplayFinalPriceUSD(product);
  const breakdown = buildBreakdown(product);

  return (
    <View style={styles.app}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topIconButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={25} color={text} />
          </TouchableOpacity>

          <Text style={styles.topTitle}>Detalle</Text>

          <TouchableOpacity style={styles.topIconButton}>
            <Feather name="heart" size={22} color={text} />
          </TouchableOpacity>
        </View>

        <View style={styles.imageCard}>
          <View style={styles.sourcePill}>
            <Text style={styles.sourcePillText}>{getSourceLabel(product)}</Text>
          </View>

          {imageUrl ? (
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
          <Text style={styles.brand}>{getBrand(product)}</Text>

          <Text style={styles.productTitle}>{product.title}</Text>

          <Text style={styles.category}>{getCategoryLabel(product)}</Text>

          <View style={styles.priceBlock}>
            <Text style={styles.priceEyebrow}>FINAL ARGENTINA</Text>

            <Text style={styles.price}>
              {finalPrice ? `USD ${formatUSD(finalPrice)}` : "Consultar"}
            </Text>

            <Text style={styles.priceNote}>
              Precio final estimado con impuestos, aduana, gestión ShopX y logística.
            </Text>
          </View>
        </View>

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
        <View style={styles.deliveryCard}>
          <View style={styles.deliveryIcon}>
            <MaterialCommunityIcons
              name="airplane-takeoff"
              size={27}
              color={navy}
            />
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
    style={styles.addToCartButton}
    onPress={async () => {
      try {
        await addProductToCart(product);

        Alert.alert(
          "Producto agregado",
          "El producto fue agregado al carrito de ShopX.",
          [
            {
              text: "Seguir viendo",
              style: "cancel",
            },
            {
              text: "Ir al carrito",
              onPress: () => router.push("/cart"),
            },
          ]
        );
      } catch (error) {
        console.log("ERROR ADD TO CART:", error);

        Alert.alert(
          "No pudimos agregarlo",
          "Probá nuevamente en unos segundos."
        );
      }
    }}
  >
    <Feather name="shopping-cart" size={20} color={white} />
    <Text style={styles.addToCartText}>Agregar al carrito</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.whatsappButton}
    onPress={() => Linking.openURL("https://wa.me/5491150000000")}
  >
    <MaterialCommunityIcons name="whatsapp" size={22} color={navy} />
    <Text style={styles.whatsappText}>Consultar por WhatsApp</Text>
  </TouchableOpacity>
</View>

        {relatedProducts.length > 0 ? (
          <>
            <View style={styles.relatedHeader}>
              <Text style={styles.relatedTitle}>Productos relacionados</Text>
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
                    key={key}
                    style={styles.relatedCard}
                    onPress={() => router.push(`/product/${key}`)}
                  >
                    <View style={styles.relatedImageBox}>
                      {relatedImage ? (
                        <Image
                          source={{ uri: relatedImage }}
                          style={styles.relatedImage}
                        />
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

  topBar: {
    paddingTop: 42,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topIconButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: text,
    fontSize: 17,
    fontWeight: "900",
  },

  imageCard: {
    marginHorizontal: 18,
    height: 310,
    borderRadius: 32,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    shadowColor: navy,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
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
  productImage: {
    width: "86%",
    height: "82%",
    resizeMode: "contain",
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
  brand: {
    color: "#9AA6B8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  productTitle: {
    marginTop: 8,
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
  priceBlock: {
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: softCard,
    padding: 16,
  },
  priceEyebrow: {
    color: "#9AA6B8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  price: {
    marginTop: 4,
    color: navy,
    fontSize: 31,
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
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
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
    fontWeight: "600",
  },
  breakdownRow: {
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  addToCartText: {
    color: white,
    fontSize: 16,
    fontWeight: "900",
  },
  whatsappButton: {
    height: 56,
    borderRadius: 999,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  whatsappText: {
    color: navy,
    fontSize: 15,
    fontWeight: "900",
  },

  relatedHeader: {
    paddingHorizontal: 18,
    marginTop: 28,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  relatedTitle: {
    color: text,
    fontSize: 22,
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
    minHeight: 210,
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