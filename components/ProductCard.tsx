import { productCategoryLabel } from "../lib/store-catalog";
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
  getSelectableOptionGroups,
} from "../lib/api";
import { addProductToCart } from "../lib/cart-store";
import { useFavoriteProduct } from "../hooks/useFavorites";

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
  return (
    product.brand ||
    product.store ||
    product.source ||
    "SHOPX"
  ).toUpperCase();
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

  const { isFavorite, updatingFavorite, toggleFavorite } =
    useFavoriteProduct(product);

  const isGrid = variant === "grid";
  const isCompact = variant === "compact";

  async function handleAddToCart() {
    try {
      if (getSelectableOptionGroups(product).length > 0 || !product._id) {
        onPress();
        return;
      }
      await addProductToCart(product);

      Alert.alert(
        "Agregado al carrito",
        `${product.title || "Producto"} fue agregado correctamente.`,
      );
    } catch (error) {
      console.log("ERROR ADD PRODUCT FROM CARD:", error);

      Alert.alert(
        "No pudimos agregarlo",
        error instanceof Error
          ? error.message
          : "Hubo un problema al agregar el producto al carrito. Probá de nuevo.",
      );
    }
  }

  async function handleToggleFavorite() {
    try {
      await toggleFavorite();
    } catch (error) {
      console.log("ERROR FAVORITE FROM CARD:", error);

      Alert.alert(
        "No pudimos guardar el favorito",
        "Hubo un problema al actualizar tus favoritos. Probá de nuevo.",
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
      <TouchableOpacity
        style={[
          styles.favoriteButton,
          isFavorite && styles.favoriteButtonActive,
        ]}
        activeOpacity={0.85}
        disabled={updatingFavorite}
        onPress={(event) => {
          event.stopPropagation();
          handleToggleFavorite();
        }}
      >
        <Feather
          name="heart"
          size={isCompact ? 17 : 19}
          color={isFavorite ? white : muted}
        />
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
        {getBrand(product)}
      </Text>

      <Text
        style={[
          styles.title,
          isGrid && styles.titleGrid,
          isCompact && styles.titleCompact,
        ]}
        numberOfLines={3}
      >
        {product.title}
      </Text>

      <Text style={styles.category} numberOfLines={1}>
        {productCategoryLabel(product)}{product.store ? ` · ${product.store}` : ""}
      </Text>

      <Text style={styles.eyebrow}>Precio final Argentina</Text>

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

      <Text style={{ color: muted, fontSize: 11, marginTop: 6 }}>
        Entrega estimada: 10–14 días
      </Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Comprar ${product.title}`} onPress={(event) => { event.stopPropagation(); onPress(); }} style={styles.buyButton}>
        <Text style={styles.buyText}>Comprar</Text>
      </TouchableOpacity>
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
  buyButton: { marginTop: 14, minHeight: 42, borderRadius: 24, backgroundColor: navy, alignItems: "center", justifyContent: "center" },
  buyText: { color: white, fontSize: 13, fontWeight: "900" },
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

  favoriteButtonActive: {
    backgroundColor: accent,
    shadowColor: accent,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  imageWrap: {
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: softCard,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    overflow: "hidden",
  },

  imageWrapGrid: {
    aspectRatio: 1,
  },

  imageWrapCompact: {
    aspectRatio: 1,
    borderRadius: 16,
    marginBottom: 10,
  },

  productImage: {
    width: "94%",
    height: "94%",
    resizeMode: "contain",
  },

  brand: {
    color: "#167B8C",
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
    minHeight: 51,
  },

  titleGrid: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    minHeight: 51,
  },

  titleCompact: {
    fontSize: 13,
    lineHeight: 17,
    minHeight: 51,
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
    paddingRight: 0,
  },

  cartButton: {
    position: "absolute",
    right: 44,
    top: 8,
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
