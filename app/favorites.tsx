import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "../components/ProductCard";
import { useFavorites } from "../hooks/useFavorites";
import { clearFavorites } from "../lib/favorites-store";
import { ShopXProduct } from "../lib/api";
import { openShopXProduct } from "../lib/product-navigation";

const navy = "#062B4F";
const navyDark = "#031A33";
const text = "#071E35";
const muted = "#718096";
const accent = "#18C7D8";
const soft = "#F7FAFC";
const border = "#E2E8F0";
const white = "#FFFFFF";

function getProductSlug(product: ShopXProduct) {
  return product.slug || product._id || product.id || product.externalId || "";
}

function openProduct(product: ShopXProduct) {
  openShopXProduct(product);
}

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();

  const {
    favorites,
    favoritesCount,
    loadingFavorites,
    refreshFavorites,
  } = useFavorites();

  useFocusEffect(
    useCallback(() => {
      refreshFavorites();
    }, [refreshFavorites])
  );

  async function handleClearFavorites() {
    if (favoritesCount === 0) return;

    Alert.alert(
      "Vaciar favoritos",
      "¿Querés eliminar todos los productos guardados?",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Vaciar",
          style: "destructive",
          onPress: async () => {
            await clearFavorites();
            await refreshFavorites();
          },
        },
      ]
    );
  }

  return (
    <View style={styles.app}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.85}
            onPress={() => router.back()}
          >
            <Feather name="chevron-left" size={25} color={text} />
          </TouchableOpacity>

          <View style={styles.headerTextBox}>
            <Text style={styles.headerTitle}>Favoritos</Text>
            <Text style={styles.headerSubtitle}>
              Productos guardados para comprar después
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.clearButton,
              favoritesCount === 0 && styles.clearButtonDisabled,
            ]}
            activeOpacity={0.85}
            disabled={favoritesCount === 0}
            onPress={handleClearFavorites}
          >
            <Feather
              name="trash-2"
              size={18}
              color={favoritesCount === 0 ? "#AAB7C6" : text}
            />
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={[navyDark, navy]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryCard}
        >
          <View style={styles.summaryIcon}>
            <Feather name="heart" size={24} color={navy} />
          </View>

          <View style={styles.summaryTextBox}>
            <Text style={styles.summaryTitle}>
              {favoritesCount === 1
                ? "1 producto guardado"
                : `${favoritesCount} productos guardados`}
            </Text>

            <Text style={styles.summaryText}>
              Guardá productos que te interesan y volvé cuando quieras.
            </Text>
          </View>
        </LinearGradient>

        {loadingFavorites ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={navy} />
            <Text style={styles.loadingText}>Cargando favoritos...</Text>
          </View>
        ) : favorites.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons
                name="heart-outline"
                size={52}
                color={accent}
              />
            </View>

            <Text style={styles.emptyTitle}>Todavía no guardaste favoritos</Text>

            <Text style={styles.emptyText}>
              Tocá el corazón en cualquier producto para guardarlo acá.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.9}
              onPress={() => router.push("/categories")}
            >
              <Text style={styles.primaryButtonText}>Explorar productos</Text>
              <Feather name="arrow-right" size={18} color={white} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tus productos</Text>

              <Text style={styles.sectionCount}>
                {favoritesCount} {favoritesCount === 1 ? "item" : "items"}
              </Text>
            </View>

            <View style={styles.productsGrid}>
              {favorites.map((product, index) => {
                const key =
                  product._id ||
                  product.id ||
                  product.slug ||
                  product.externalId ||
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
          </>
        )}

        <View style={{ height: 45 }} />
      </ScrollView>
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
    paddingHorizontal: 18,
    paddingBottom: 0,
  },

  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: "#DDE7F0",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: navy,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  headerTextBox: {
    flex: 1,
    minWidth: 0,
  },

  headerTitle: {
    color: text,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.7,
  },

  headerSubtitle: {
    marginTop: 2,
    color: muted,
    fontSize: 13,
    fontWeight: "700",
  },

  clearButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: "#DDE7F0",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: navy,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  clearButtonDisabled: {
    opacity: 0.55,
  },

  summaryCard: {
    marginTop: 18,
    borderRadius: 26,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",

    shadowColor: navy,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 5,
  },

  summaryIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  summaryTextBox: {
    flex: 1,
  },

  summaryTitle: {
    color: white,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 4,
  },

  summaryText: {
    color: "#D7E2EF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },

  loadingBox: {
    marginTop: 22,
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

  emptyBox: {
    marginTop: 22,
    borderRadius: 28,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 28,
    alignItems: "center",

    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },

  emptyIcon: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  emptyTitle: {
    color: text,
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.4,
  },

  emptyText: {
    color: muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 20,
  },

  primaryButton: {
    height: 48,
    borderRadius: 999,
    backgroundColor: navy,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  primaryButtonText: {
    color: white,
    fontSize: 14,
    fontWeight: "900",
  },

  sectionHeader: {
    marginTop: 26,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: {
    color: text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  sectionCount: {
    color: accent,
    fontSize: 14,
    fontWeight: "900",
  },

  productsGrid: {
    marginHorizontal: -12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 0.2,
  },

  productGridItem: {
    width: "50%",
    paddingHorizontal: 0.2,
    marginBottom: 0.2,
  },
});
