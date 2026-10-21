import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFavoriteProduct } from "../hooks/useFavorites";
import { getProductImages, type ShopXProduct } from "../lib/api";
import { addProductToCart } from "../lib/cart-store";
import { saveProductToCache } from "../lib/product-cache";
import { finalPriceUSD, needsProductSelection, storefrontPrice } from "../lib/storefront";

export function openStorefrontProduct(product: ShopXProduct) {
  saveProductToCache(product);
  router.push({ pathname: "/product/[id]", params: { id: product.slug || product._id || product.id || "" } });
}

export function StorefrontProductCard({ product, exchangeRate }: { product: ShopXProduct; exchangeRate?: number }) {
  const images = getProductImages(product).filter((url) => !/placeholder/i.test(url));
  const [imageIndex, setImageIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const addingRef = useRef(false);
  const resetAdded = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { isFavorite, updatingFavorite, toggleFavorite } = useFavoriteProduct(product);
  const price = storefrontPrice(product, exchangeRate);
  useEffect(() => { setImageIndex(0); }, [product.slug, product.image, product.images]);
  useEffect(() => () => { clearTimeout(resetAdded.current); }, []);

  async function addToCart() {
    if (addingRef.current) return;
    if (needsProductSelection(product) || !product._id || !finalPriceUSD(product)) {
      openStorefrontProduct(product);
      return;
    }
    addingRef.current = true;
    setAdding(true);
    try {
      await addProductToCart(product);
      setAdded(true);
      clearTimeout(resetAdded.current);
      resetAdded.current = setTimeout(() => setAdded(false), 1800);
    } catch (error) {
      Alert.alert("No pudimos agregarlo", error instanceof Error ? error.message : "Volvé a intentar.");
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  }

  return (
    <View style={s.card}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Ver ${product.title}`} activeOpacity={0.9} onPress={() => openStorefrontProduct(product)}>
        <View style={s.imageWrap}>
          {images[imageIndex] ? (
            <Image source={{ uri: images[imageIndex] }} style={s.image} contentFit="contain" transition={150} cachePolicy="memory-disk"
              recyclingKey={`${product.slug}:${imageIndex}`} onError={() => setImageIndex((index) => index + 1)} accessibilityLabel={product.title} />
          ) : (
            <View style={s.imageError}><Feather name="image" size={24} color="#718096" /><Text style={s.caption}>Ver fotos en el detalle</Text></View>
          )}
        </View>
        <Text style={s.title} numberOfLines={2}>{product.title}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.favorite, isFavorite && s.favoriteActive]} accessibilityRole="button"
        accessibilityLabel={`${isFavorite ? "Quitar de" : "Agregar a"} favoritos: ${product.title}`} accessibilityState={{ selected: isFavorite, disabled: updatingFavorite }}
        disabled={updatingFavorite} onPress={() => { void toggleFavorite().catch(() => Alert.alert("No pudimos guardar el favorito", "Volvé a intentar.")); }}>
        <Feather name="heart" size={21} color={isFavorite ? "#FFFFFF" : "#082A49"} />
      </TouchableOpacity>
      <View style={s.priceRow}>
        <TouchableOpacity style={s.priceInfo} accessibilityRole="button" onPress={() => openStorefrontProduct(product)}>
          <Text style={s.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{price.text}</Text>
          <Text style={s.caption}>{price.caption}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.cart, added && s.cartAdded]} accessibilityRole="button" accessibilityLabel={added ? "Producto agregado" : needsProductSelection(product) ? `Elegir opciones de ${product.title}` : `Agregar ${product.title} al carrito`}
          accessibilityState={{ disabled: adding }} disabled={adding} onPress={() => { void addToCart(); }}>
          {adding ? <ActivityIndicator size="small" color="#082A49" /> : <Feather name={added ? "check" : "shopping-cart"} size={21} color={added ? "white" : "#082A49"} />}
        </TouchableOpacity>
      </View>
      {added ? <Text accessibilityLiveRegion="polite" style={s.added}>Agregado al carrito</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, borderColor: "#E4EAF0", borderWidth: 1, overflow: "hidden" },
  imageWrap: { aspectRatio: 1.16, backgroundColor: "#F1F3F5", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  imageError: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 10 },
  favorite: { position: "absolute", right: 7, top: 7, width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFFF2", alignItems: "center", justifyContent: "center" },
  favoriteActive: { backgroundColor: "#087C91" },
  title: { fontSize: 13, lineHeight: 17, fontWeight: "600", color: "#082A49", paddingHorizontal: 10, marginTop: 9, minHeight: 34 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 4, padding: 10, paddingTop: 6 },
  priceInfo: { flex: 1, gap: 3, minWidth: 0 },
  price: { color: "#082A49", fontWeight: "800", fontSize: 20, letterSpacing: -0.5 },
  caption: { fontSize: 10, color: "#667992" },
  cart: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#16C7DE", alignItems: "center", justifyContent: "center" },
  cartAdded: { backgroundColor: "#087C91" },
  added: { paddingHorizontal: 10, paddingBottom: 8, fontSize: 11, color: "#087C91" },
});
