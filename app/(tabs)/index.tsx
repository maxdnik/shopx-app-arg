import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { openBrowserAsync } from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBottomNav } from "../../components/AppBottomNav";
import { StorefrontProductCard } from "../../components/StorefrontProductCard";
import { useCartCount } from "../../hooks/useCartCount";
import { getStoredUser } from "../../lib/auth";
import type { ShopXProduct } from "../../lib/api";
import { getCatalogNavigation, getHomeContent, type CatalogCategory, type HomeContent } from "../../lib/catalog";
import { getStorefrontExchangeRate, getWantItProducts, visibleStorefrontProducts } from "../../lib/storefront";

import { getOfficialStores, type ShopXStore } from "../../lib/stores";
import { canUseRemoteStoreLogo, getStoreLogoSource, getStoreLogoWordmark } from "../../lib/store-logos";
import { buildApiUrl } from "../../lib/config";

// Same campaign artwork and collection destinations as the ShopX website.
const campaigns = [
  { slug: "regalos-para-mama", title: "Regalos para mamá", image: "/campaigns/mama-2026-no-logo.webp" },
  { slug: "marcas-que-queres", title: "Marcas que querés", image: "/campaigns/marcas-2026-no-logo.webp" },
  { slug: "tu-proximo-upgrade", title: "Tu próximo upgrade", image: "/campaigns/upgrade-2026-no-logo.webp" },
];

const shortcuts = [
  { label: "Ropa", image: require("../../assets/images/home/gap.jpg"), category: "clothing" },
  { label: "Zapatillas", image: require("../../assets/images/home/category-sneakers.jpeg"), category: "clothing", subcategory: "Zapatillas" },
  { label: "Tecnología", image: require("../../assets/images/home/category-technology.jpeg"), category: "technology" },
  { label: "LEGO", image: require("../../assets/store-logos/lego.png"), store: "lego" },
];
const sectionLabels: Record<string, string> = { clothing: "Ropa y accesorios", technology: "Tecnología", toys: "Juguetes y juegos", outdoor: "Outdoor" };
const brands = [
  { slug: "gap", title: "GAP", image: require("../../assets/images/home/gap.jpg") },
  { slug: "polo-ralph-lauren", title: "Polo Ralph Lauren", image: require("../../assets/images/home/polo.jpg") },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const shellWidth = Math.min(width, 640);
  const cardWidth = (shellWidth - 44) / 2;
  const cartCount = useCartCount();
  const [stores, setStores] = useState<ShopXStore[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [content, setContent] = useState<HomeContent>();
  const [products, setProducts] = useState<ShopXProduct[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("Ingresá tu código postal");
  const generation = useRef(0);

  const load = useCallback(async (force = false) => {
    const id = ++generation.current;
    setLoading(true);
    setRefreshing(force);
    setError("");
    // Store discovery should not hold up product loading or pull-to-refresh.
    void getOfficialStores().then((value) => {
      if (id === generation.current) setStores([...value].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)));
    });
    await Promise.allSettled([
      getWantItProducts(force).then((items) => { if (id === generation.current) setProducts(items); }).catch(() => {
        if (id === generation.current) setError("No pudimos cargar estos productos. Tocá para reintentar.");
      }),
      getCatalogNavigation().then((value) => { if (id === generation.current) setCategories(value); }),
      getHomeContent(force).then((value) => { if (id === generation.current) setContent(value); }),
      getStorefrontExchangeRate().then((rate) => { if (id === generation.current) setExchangeRate(rate); }).catch(() => {
        // Keep the exact server USD price if the current FX rate is unavailable.
        if (id === generation.current) setExchangeRate(undefined);
      }),
    ]);
    if (id === generation.current) { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load]);
  useFocusEffect(useCallback(() => {
    let active = true;
    getStoredUser().then((user) => {
      if (active) setLocation([user?.address?.postalCode, user?.address?.city].filter(Boolean).join(" · ") || "Ingresá tu código postal");
    }).catch(() => undefined);
    return () => { active = false; };
  }, []));
  const search = () => router.push({ pathname: "/search", params: { q: query.trim() } });
  const weeklyProducts = visibleStorefrontProducts(content?.weeklyProducts || []).slice(0, 6);

  return (
    <View style={s.app}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 86 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor="#087C91" />}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[s.shell, { width: shellWidth }]}>
          <View style={s.header}>
            <Image source={require("../../assets/images/shopx-logo-horizontal.png")} contentFit="contain" style={s.logo} accessibilityLabel="ShopX" />
            <View style={s.headerActions}>
              <TouchableOpacity style={s.iconButton} accessibilityRole="button" accessibilityLabel="Favoritos" onPress={() => router.push("/favorites")}><Feather name="heart" size={28} color="#082A49" /></TouchableOpacity>
              <TouchableOpacity style={s.iconButton} accessibilityRole="button" accessibilityLabel={`Carrito, ${cartCount} productos`} onPress={() => router.push("/cart")}>
                <Feather name="shopping-cart" size={28} color="#082A49" />
                {cartCount > 0 ? <Text style={s.badge}>{cartCount}</Text> : null}
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.search}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Buscar productos" style={s.searchButton} onPress={search}><Feather name="search" size={24} color="#082A49" /></TouchableOpacity>
            <TextInput accessibilityLabel="Buscar Amazon, eBay, Walmart, Target" value={query} onChangeText={setQuery} placeholder="Buscar Amazon, eBay, Walmart, Target" placeholderTextColor="#718096"
              style={[s.input, !query && { fontSize: shellWidth < 360 ? 11.5 : 13 }]} returnKeyType="search" onSubmitEditing={search} autoCorrect={false} clearButtonMode="while-editing" />
          </View>
          <TouchableOpacity style={s.location} accessibilityRole="button" accessibilityLabel={`Dirección de entrega. ${location}`} onPress={() => router.push("/profile")}>
            <Feather name="map-pin" size={17} color="#667992" /><Text style={s.locationText} numberOfLines={1}>Enviar a · {location}</Text><Feather name="chevron-right" size={16} color="#667992" />
          </TouchableOpacity>
          <TouchableOpacity style={s.hero} accessibilityRole="button" accessibilityLabel="De USA a tu puerta. Descubrí productos" activeOpacity={0.95} onPress={() => router.push("/categories")}>
            <Image source={require("../../assets/images/home/usa-hero.jpg")} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={s.heroCopy}>
              <Text style={[s.heroTitle, shellWidth < 370 && { fontSize: 25, lineHeight: 26 }]}>De USA{"\n"}a tu puerta.</Text>
              <View style={s.heroButton}><Text style={s.heroButtonText}>Descubrí más</Text><Feather name="arrow-right" size={16} color="#082A49" /></View>
            </View>
          </TouchableOpacity>
          <View style={s.shortcuts}>
            {shortcuts.map((item) => (
              <TouchableOpacity key={item.label} style={s.shortcut} accessibilityRole="button" accessibilityLabel={`Ver ${item.label}`} onPress={() => item.store
                ? router.push({ pathname: "/store/[slug]", params: { slug: item.store } })
                : router.push({ pathname: "/categories", params: { category: item.category, subcategory: item.subcategory || "" } })}>
                <View style={[s.categoryImageWrap, { width: Math.min(82, (shellWidth - 68) / 4), height: Math.min(82, (shellWidth - 68) / 4) }]}>
                  <Image source={item.image} style={s.categoryImage} contentFit={item.label === "Ropa" ? "cover" : "contain"} />
                </View>
                <Text style={s.categoryLabel} numberOfLines={1} adjustsFontSizeToFit>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.sectionHeader}>
            <Text accessibilityRole="header" style={s.wantTitle}>No lo necesito,{"\n"}pero lo quiero</Text>
            <TouchableOpacity style={s.moreButton} accessibilityRole="button" accessibilityLabel="Ver todos los productos de No lo necesito, pero lo quiero" onPress={() => router.push("/want-it")}><Text style={s.more}>Ver todo</Text><Feather name="arrow-right" size={16} color="#087C91" /></TouchableOpacity>
          </View>
          {!!error ? <TouchableOpacity accessibilityRole="button" style={s.notice} onPress={() => { void load(true); }}><Text style={s.noticeText}>{error}</Text></TouchableOpacity> : null}
          {loading && !products.length ? <View style={s.loading}><ActivityIndicator color="#087C91" /><Text style={s.noticeText}>Cargando productos…</Text></View> : null}
          {!loading && !error && !products.length ? <View style={s.notice}><Text style={s.noticeText}>Pronto vas a encontrar nuevos productos acá.</Text></View> : null}
          {products.length > 0 ? <ScrollView horizontal style={s.rail} showsHorizontalScrollIndicator={false} contentContainerStyle={s.productRail} snapToInterval={cardWidth + 12} decelerationRate="fast">
            {products.slice(0, 8).map((product) => <View key={product.slug} style={{ width: cardWidth }}><StorefrontProductCard product={product} exchangeRate={exchangeRate} /></View>)}
          </ScrollView> : null}
          <View style={[s.sectionHeader, s.brandHeader]}>
            <Text accessibilityRole="header" style={s.sectionTitle}>Tus marcas favoritas</Text>
            <TouchableOpacity style={s.moreButton} accessibilityRole="button" accessibilityLabel="Ver todas las marcas" onPress={() => router.push("/stores")}><Text style={s.more}>Ver todo</Text><Feather name="arrow-right" size={16} color="#087C91" /></TouchableOpacity>
          </View>
          <View style={s.brands}>
            {brands.map((brand) => <TouchableOpacity key={brand.slug} style={s.brandCard} accessibilityRole="button" accessibilityLabel={`Ver productos de ${brand.title}`} activeOpacity={0.9} onPress={() => router.push({ pathname: "/store/[slug]", params: { slug: brand.slug } })}>
              <Image source={brand.image} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient colors={["transparent", "rgba(5,24,42,0.82)"]} locations={[0.2, 1]} style={s.brandOverlay}>
                <Text style={[s.brandName, brand.slug !== "gap" && s.poloName]}>{brand.title}</Text>
                <View style={s.brandLink}><Text style={s.brandLinkText}>Ver productos</Text><Feather name="arrow-right" size={16} color="white" /></View>
              </LinearGradient>
            </TouchableOpacity>)}
          </View>
          <View style={s.weekly}>
            <View style={s.sectionHeader}>
              <Text accessibilityRole="header" style={s.sectionTitle}>Comprá por tienda</Text>
              <TouchableOpacity style={s.moreButton} accessibilityRole="button" accessibilityLabel="Ver todas las tiendas" onPress={() => router.push("/stores")}><Text style={s.more}>Ver todas</Text><Feather name="arrow-right" size={16} color="#087C91" /></TouchableOpacity>
            </View>
            <ScrollView horizontal style={s.rail} showsHorizontalScrollIndicator={false} contentContainerStyle={s.storeRail}>
              {stores.map((store) => {
                const localLogo = getStoreLogoSource(store.slug);
                const source = localLogo || (canUseRemoteStoreLogo(store.logo) ? { uri: store.logo } : null);
                return <TouchableOpacity key={store.slug} style={s.storeTile} accessibilityRole="button" accessibilityLabel={`Ver tienda ${store.name}`} onPress={() => router.push({ pathname: "/store/[slug]", params: { slug: store.slug } })}>
                  <View style={s.storeLogoWrap}>{source ? <Image source={source} style={s.storeLogo} contentFit="contain" cachePolicy="memory-disk" /> : <Text style={s.storeWordmark} numberOfLines={2}>{getStoreLogoWordmark(store)}</Text>}</View>
                  <Text style={s.storeName} numberOfLines={2}>{store.name}</Text>
                </TouchableOpacity>;
              })}
            </ScrollView>
          </View>
          {weeklyProducts.length > 0 ? <View style={s.weekly}>
            <View style={s.sectionHeader}><Text accessibilityRole="header" style={s.sectionTitle}>Lo más pedido</Text></View>
            <ScrollView horizontal style={s.rail} showsHorizontalScrollIndicator={false} contentContainerStyle={s.productRail}>
              {weeklyProducts.map((product) => <View key={product.slug} style={{ width: cardWidth }}><StorefrontProductCard product={product} exchangeRate={exchangeRate} /></View>)}
            </ScrollView>
          </View> : null}
          <View style={s.weekly}>
            <View style={s.sectionHeader}><Text accessibilityRole="header" style={s.sectionTitle}>Colecciones destacadas</Text></View>
            <ScrollView horizontal style={s.rail} showsHorizontalScrollIndicator={false} contentContainerStyle={s.campaignRail} snapToInterval={Math.min(280, shellWidth - 64) + 12} decelerationRate="fast">
              {campaigns.map((campaign) => <TouchableOpacity key={campaign.slug} style={[s.campaignCard, { width: Math.min(280, shellWidth - 64) }]} accessibilityRole="button" accessibilityLabel={`Explorar ${campaign.title}`} activeOpacity={0.9} onPress={() => {
                void openBrowserAsync(buildApiUrl(`/colecciones/${campaign.slug}`)).catch(() => Alert.alert("No pudimos abrir la colección", "Volvé a intentar en unos segundos."));
              }}>
                <Image source={{ uri: buildApiUrl(campaign.image) }} style={s.campaignImage} contentFit="contain" cachePolicy="memory-disk" accessibilityLabel={campaign.title} />
              </TouchableOpacity>)}
            </ScrollView>
          </View>
          {Object.entries(sectionLabels).map(([key, label]) => {
            const items = visibleStorefrontProducts(content?.sections?.[key] || []);
            if (!items.length) return null;
            return <View key={key} style={s.weekly}>
              <View style={s.sectionHeader}>
                <Text accessibilityRole="header" style={s.sectionTitle}>{label}</Text>
                <TouchableOpacity style={s.moreButton} accessibilityRole="button" accessibilityLabel={`Ver todo en ${label}`} onPress={() => router.push({ pathname: "/categories", params: { category: key, subcategory: "" } })}><Text style={s.more}>Ver todo</Text><Feather name="arrow-right" size={16} color="#087C91" /></TouchableOpacity>
              </View>
              <ScrollView horizontal style={s.rail} showsHorizontalScrollIndicator={false} contentContainerStyle={s.productRail}>
                {items.map((product) => <View key={product.slug} style={{ width: cardWidth }}><StorefrontProductCard product={product} exchangeRate={exchangeRate} /></View>)}
              </ScrollView>
            </View>;
          })}
          {categories.length > 0 ? <View style={s.weekly}>
            <View style={s.sectionHeader}><Text accessibilityRole="header" style={s.sectionTitle}>Explorá por categoría</Text></View>
            <View style={s.categoryGrid}>
              {categories.map((category) => <TouchableOpacity key={category.key} style={[s.catalogCategory, { width: (shellWidth - 56) / 4 }]} accessibilityRole="button" accessibilityLabel={`Ver ${category.label}`} onPress={() => router.push({ pathname: "/categories", params: { category: category.key, subcategory: "" } })}>
                <View style={s.catalogImageWrap}><Image source={{ uri: category.image }} style={s.catalogImage} contentFit="contain" cachePolicy="memory-disk" /></View>
                <Text style={s.catalogLabel} numberOfLines={2}>{category.label}</Text>
              </TouchableOpacity>)}
            </View>
          </View> : null}
        </View>
      </ScrollView>
      <AppBottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#F8FAFC" },
  shell: { alignSelf: "center" },
  header: { paddingHorizontal: 20, height: 56, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { width: 114, height: 38 },
  headerActions: { flexDirection: "row", gap: 8 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", right: 0, top: 0, backgroundColor: "#16C7DE", color: "#082A49", borderRadius: 10, minWidth: 18, padding: 2, textAlign: "center", fontSize: 10, fontWeight: "800" },
  search: { marginHorizontal: 18, marginTop: 8, backgroundColor: "white", borderWidth: 1, borderColor: "#DFE6EF", borderRadius: 17, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, shadowColor: "#082A49", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  searchButton: { width: 42, height: 48, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, minHeight: 50, color: "#082A49", fontSize: 15, paddingRight: 12, paddingVertical: 12 },
  location: { paddingHorizontal: 20, minHeight: 38, flexDirection: "row", alignItems: "center", gap: 6 },
  locationText: { flexShrink: 1, fontSize: 12, color: "#667992" },
  hero: { marginHorizontal: 14, borderRadius: 18, overflow: "hidden", backgroundColor: "#082A49", minHeight: 126, justifyContent: "center" },
  heroCopy: { padding: 15, alignItems: "flex-start" },
  heroTitle: { color: "white", fontSize: 29, lineHeight: 29, fontWeight: "900", letterSpacing: -1 },
  heroButton: { marginTop: 10, minHeight: 32, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#16C7DE", flexDirection: "row", gap: 8, alignItems: "center" },
  heroButtonText: { fontSize: 12, fontWeight: "600", color: "#082A49" },
  shortcuts: { flexDirection: "row", paddingHorizontal: 14, marginTop: 16, marginBottom: 22, justifyContent: "space-between" },
  shortcut: { flex: 1, alignItems: "center", gap: 6 },
  categoryImageWrap: { backgroundColor: "#ECEEF0", borderRadius: 50, overflow: "hidden" },
  categoryImage: { width: "100%", height: "100%" },
  categoryLabel: { fontSize: 12, color: "#082A49", fontWeight: "600" },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  wantTitle: { fontSize: 24, lineHeight: 25, fontWeight: "900", letterSpacing: -0.8, color: "#082A49", flex: 1 },
  moreButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 },
  more: { color: "#087C91", fontSize: 12, fontWeight: "600" },
  rail: { flexGrow: 0, flexShrink: 0 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, columnGap: 8, rowGap: 14 },
  catalogCategory: { alignItems: "center", gap: 6 },
  catalogImageWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: "#E4EAF0", padding: 6 },
  catalogImage: { width: "100%", height: "100%" },
  catalogLabel: { color: "#082A49", fontSize: 10, lineHeight: 13, fontWeight: "600", textAlign: "center", minHeight: 26 },
  productRail: { paddingHorizontal: 16, gap: 12, paddingBottom: 2, alignItems: "flex-start" },
  storeRail: { paddingHorizontal: 16, gap: 10, alignItems: "flex-start" },
  storeTile: { width: 84, alignItems: "center", gap: 6 },
  storeLogoWrap: { width: 76, height: 64, padding: 10, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: "#E4EAF0", alignItems: "center", justifyContent: "center" },
  storeLogo: { width: "100%", height: "100%" },
  storeWordmark: { color: "#082A49", fontSize: 14, fontWeight: "800", textAlign: "center" },
  storeName: { color: "#082A49", fontSize: 11, lineHeight: 14, textAlign: "center" },
  campaignRail: { paddingHorizontal: 16, gap: 12, alignItems: "flex-start" },
  campaignCard: { aspectRatio: 1, borderRadius: 20, overflow: "hidden", backgroundColor: "#EEF4F7" },
  campaignImage: { width: "100%", height: "100%" },
  brandHeader: { marginTop: 18 },
  sectionTitle: { fontSize: 21, fontWeight: "800", letterSpacing: -0.6, color: "#082A49", flex: 1 },
  brands: { flexDirection: "row", gap: 10, paddingHorizontal: 16 },
  brandCard: { flex: 1, aspectRatio: 1.04, borderRadius: 16, overflow: "hidden", backgroundColor: "#082A49", justifyContent: "flex-end" },
  brandOverlay: { padding: 12, paddingTop: 55 },
  brandName: { fontSize: 20, fontWeight: "800", color: "white", letterSpacing: -0.5 },
  poloName: { fontSize: 16 },
  brandLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  brandLinkText: { fontSize: 12, color: "white" },
  weekly: { marginTop: 26 },
  notice: { marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 14, backgroundColor: "#EEF4F7" },
  noticeText: { color: "#667992", fontSize: 13, lineHeight: 19 },
  loading: { height: 170, alignItems: "center", justifyContent: "center", gap: 10 },
});
