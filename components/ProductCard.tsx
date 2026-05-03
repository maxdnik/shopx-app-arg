import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  formatUSD,
  getDisplayFinalPriceUSD,
  getProductImage,
  ShopXProduct,
} from "../lib/api";
import { addProductToCart } from "../lib/cart-store";

const navy = "#062B4F";
const text = "#071E35";
const muted = "#718096";
const accent = "#18C7D8";
const softCard = "#F1F5F9";
const border = "#E2E8F0";
const white = "#FFFFFF";

type ProductCardVariant = "deal" | "grid" | "compact";

type ProductCardProps = {
  product: ShopXProduct;
  variant?: ProductCardVariant;
  onPress: () => void;
  showFooter?: boolean;
  showCartButton?: boolean;
};

function getBrand(product: ShopXProduct) {
  return (product.brand || product.store || product.source || "SHOPX").toUpperCase();
}

function getCategoryLabel(product: ShopXProduct) {
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

function getProductSourceLabel(product: ShopXProduct) {
  if (product.source === "amazon") return "AMAZON USA";
  if (product.source === "ebay") return "EBAY USA";
  if (product.source === "manual" || product.source === "shopx") return "SHOPX";

  return getBrand(product);
}

export function ProductCard({
  product,
  variant = "deal",
  onPress,
  showFooter = false,
  showCartButton = true,
}: ProductCardProps) {
  const imageUrl = getProductImage(product);
  const price = getDisplayFinalPriceUSD(product);

  const isGrid = variant === "grid";
  const isCompact = variant === "compact";

  async function handleAddToCart() {
    try {
      await addProductToCart(product);

      Alert.alert(
        "Agregado al carrito",
        `${product.title || "Producto"} fue agregado correctamente.`
      );
    } catch (error) {
      console.log("ERROR ADD PRODUCT FROM CARD:", error);

      Alert.alert(
        "No pudimos agregarlo",
        "Hubo un problema al agregar el producto al carrito. Probá de nuevo."
      );
    }
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isGrid && styles.cardGrid,
        isCompact && styles.cardCompact,
      ]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <TouchableOpacity style={styles.favoriteButton} activeOpacity={0.85}>
        <Feather name="heart" size={isCompact ? 17 : 19} color={muted} />
      </TouchableOpacity>

      <View
        style={[
          styles.imageWrap,
          isGrid && styles.imageWrapGrid,
          isCompact && styles.imageWrapCompact,
        ]}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.productImage} />
        ) : (
          <MaterialCommunityIcons
            name="package-variant-closed"
            size={isCompact ? 38 : 46}
            color={muted}
          />
        )}
      </View>

      <Text style={styles.brand} numberOfLines={1}>
        {getProductSourceLabel(product)}
      </Text>

      <Text
        style={[
          styles.title,
          isGrid && styles.titleGrid,
          isCompact && styles.titleCompact,
        ]}
        numberOfLines={2}
      >
        {product.title}
      </Text>

      <Text style={styles.category} numberOfLines={1}>
        {getCategoryLabel(product)}
      </Text>

      <Text style={styles.eyebrow}>FINAL ARGENTINA</Text>

      <Text
        style={[
          styles.price,
          isCompact && styles.priceCompact,
          showCartButton && !showFooter && styles.priceWithCart,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {price ? `USD ${formatUSD(price)}` : "Consultar"}
      </Text>

      {showFooter ? (
        <View style={styles.footer}>
          <Text style={styles.footerText}>Ver detalle</Text>
          <Feather name="arrow-right" size={18} color={accent} />
        </View>
      ) : null}

      {showCartButton && !showFooter ? (
        <TouchableOpacity
          style={styles.cartButton}
          activeOpacity={0.85}
          onPress={(event) => {
            event.stopPropagation();
            handleAddToCart();
          }}
        >
          <Feather name="shopping-cart" size={17} color={white} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    minHeight: 286,
    backgroundColor: white,
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: border,
    position: "relative",
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  cardGrid: {
    width: "100%",
    minHeight: 286,
    borderRadius: 20,
  },

  cardCompact: {
    width: "100%",
    minHeight: 286,
    borderRadius: 20,
    padding: 10,
  },

  favoriteButton: {
    position: "absolute",
    right: 8,
    top: 8,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: white,
    alignItems: "center",
    justifyContent: "center",
  },

  imageWrap: {
    height: 120,
    borderRadius: 16,
    backgroundColor: softCard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    overflow: "hidden",
  },

  imageWrapGrid: {
    height: 120,
  },

  imageWrapCompact: {
    height: 120,
    borderRadius: 16,
    marginBottom: 10,
  },

  productImage: {
    width: "94%",
    height: "94%",
    resizeMode: "contain",
  },

  brand: {
    color: "#9AA6B8",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 5,
  },

  title: {
    color: text,
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
    minHeight: 34,
  },

  titleGrid: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    minHeight: 34,
  },

  titleCompact: {
    fontSize: 13,
    lineHeight: 17,
    minHeight: 34,
  },

  category: {
    color: muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 7,
  },

  eyebrow: {
    color: "#9AA6B8",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: 10,
    marginBottom: 3,
  },

  price: {
    color: text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 1,
  },

  priceCompact: {
    color: navy,
    fontSize: 18,
  },

  priceWithCart: {
    paddingRight: 38,
  },

  cartButton: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
  },

  footer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  footerText: {
    color: text,
    fontSize: 14,
    fontWeight: "900",
  },
});