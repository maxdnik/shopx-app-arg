import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBottomNav } from "../../components/AppBottomNav";
import { ProductCard } from "../../components/ProductCard";
import { useCartCount } from "../../hooks/useCartCount";
import { getStoredUser } from "../../lib/auth";
import { ShopXProduct } from "../../lib/api";
import { getHomeContent, HomeContent } from "../../lib/catalog";
import { buildApiUrl } from "../../lib/config";
import { saveProductToCache } from "../../lib/product-cache";

const labels: Record<string, string> = {
  clothing: "Ropa",
  technology: "Tecnología",
  toys: "Juguetes",
  outdoor: "Outdoor",
};
const guides = [
  {
    title: "LEGO: construí tu colección",
    text: "Fórmula 1, fútbol y modelos para coleccionar.",
    path: "/lego-formula-1-argentina",
  },
  {
    title: "GAP: encontrá tu calce",
    text: "Jeans, talles y cortes para elegir mejor.",
    path: "/jeans-gap-90s",
  },
  {
    title: "Tenis: elegí tu equipo",
    text: "Raquetas y guías para tu próximo partido.",
    path: "/raquetas-tenis-principiantes",
  },
];
function openProduct(product: ShopXProduct) {
  saveProductToCache(product);
  router.push({
    pathname: "/product/[id]",
    params: { id: product.slug || product._id || product.id || "" },
  });
}
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const cartCount = useCartCount();
  const [content, setContent] = useState<HomeContent>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [location, setLocation] = useState("Configurar ubicación");
  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      setContent(await getHomeContent(force));
    } catch {
      setError("No pudimos cargar los productos. Tocá para volver a intentar.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getStoredUser().then((user) => {
        if (active)
          setLocation(
            [user?.address?.city, user?.address?.province]
              .filter(Boolean)
              .join(", ") || "Configurar ubicación",
          );
      });
      return () => {
        active = false;
      };
    }, []),
  );
  const search = () =>
    router.push({ pathname: "/search", params: { q: query.trim() } });
  const sections = [
    ...(content?.weeklyProducts?.length
      ? [
          {
            key: "weekly",
            title: "Lo más pedido de esta semana",
            products: content.weeklyProducts,
          },
        ]
      : []),
    ...Object.entries(labels).map(([key, title]) => ({
      key,
      title,
      products: content?.sections[key] || [],
    })),
  ];
  return (
    <View style={s.app}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 120,
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading && !!content}
            onRefresh={() => load(true)}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <Image
            source={require("../../assets/images/shopx-logo-horizontal.png")}
            resizeMode="contain"
            style={{ width: 124, height: 42 }}
          />
          <View style={s.icons}>
            <TouchableOpacity
              accessibilityLabel="Notificaciones"
              onPress={() => router.push("/notifications")}
            >
              <Feather name="bell" size={23} color="#062B4F" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Favoritos"
              onPress={() => router.push("/favorites")}
            >
              <Feather name="heart" size={23} color="#062B4F" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={`Carrito, ${cartCount} productos`}
              onPress={() => router.push("/cart")}
            >
              <Feather name="shopping-cart" size={23} color="#062B4F" />
              {cartCount > 0 && <Text style={s.badge}>{cartCount}</Text>}
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={s.location}
          onPress={() => router.push("/profile")}
        >
          <Feather name="map-pin" size={14} color="#617590" />
          <Text style={s.small}>Enviar a {location}</Text>
        </TouchableOpacity>
        <View style={s.search}>
          <Feather name="search" size={20} color="#617590" />
          <TextInput
            accessibilityLabel="Buscar productos"
            value={query}
            onChangeText={setQuery}
            placeholder="Amazon, eBay y marcas de USA"
            style={s.input}
            returnKeyType="search"
            onSubmitEditing={search}
          />
          <TouchableOpacity accessibilityLabel="Buscar" onPress={search}>
            <Feather name="arrow-right" size={22} color="#062B4F" />
          </TouchableOpacity>
        </View>
        <View style={s.hero}>
          <Text style={s.kicker}>SHOPX ARGENTINA</Text>
          <Text style={s.heroTitle}>
            Comprá en USA.{"\n"}Recibí en Argentina.
          </Text>
          <Text style={s.heroText}>Sin trámites, sin sorpresas.</Text>
          <TouchableOpacity style={s.primary} onPress={search}>
            <Text style={s.primaryText}>Explorar productos</Text>
            <Feather name="arrow-right" size={18} color="#062B4F" />
          </TouchableOpacity>
        </View>
        <View style={s.section}>
          <Text style={s.heading}>Elegí cómo querés comprar</Text>
          <View style={s.paths}>
            <TouchableOpacity style={s.path} onPress={search}>
              <Feather name="search" size={24} color="#062B4F" />
              <Text style={s.pathTitle}>Quiero descubrir</Text>
              <Text style={s.small}>
                Buscá productos de Amazon, eBay y marcas de USA.
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.path}
              onPress={() => router.push("/quote")}
            >
              <Feather name="link" size={24} color="#062B4F" />
              <Text style={s.pathTitle}>Ya sé qué quiero</Text>
              <Text style={s.small}>
                Pegá el link y conocé el precio puesto en Argentina.
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.quote}>
          <Text style={s.heading}>Pegá un link y cotizá</Text>
          <TextInput
            accessibilityLabel="Link para cotizar"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="Link de una tienda de USA"
            style={s.linkInput}
          />
          <TouchableOpacity
            style={s.primary}
            onPress={() =>
              router.push({ pathname: "/quote", params: { url: url.trim() } })
            }
          >
            <Text style={s.primaryText}>Cotizar mi producto</Text>
            <Feather name="arrow-right" size={18} color="#062B4F" />
          </TouchableOpacity>
          <Text style={s.small}>
            Hasta cinco links de dos tiendas. Producto, impuestos y envío antes
            de pagar.
          </Text>
        </View>
        {loading && !content && (
          <ActivityIndicator style={{ margin: 24 }} color="#062B4F" />
        )}
        {!!error && (
          <TouchableOpacity style={s.section} onPress={() => load(true)}>
            <Text style={s.small}>{error}</Text>
          </TouchableOpacity>
        )}
        {sections.map((section) => (
          <View key={section.key} style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.heading}>{section.title}</Text>
              {section.key !== "weekly" && (
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/categories",
                      params: { category: section.key },
                    })
                  }
                >
                  <Text style={s.more}>Ver todos</Text>
                </TouchableOpacity>
              )}
            </View>
            {section.products.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
              >
                {section.products.map((product) => (
                  <View
                    key={product._id || product.slug}
                    style={{ width: 190 }}
                  >
                    <ProductCard
                      product={product}
                      onPress={() => openProduct(product)}
                      showFooter
                    />
                  </View>
                ))}
              </ScrollView>
            ) : (
              !loading && (
                <Text style={s.small}>
                  Explorá más productos en esta categoría.
                </Text>
              )
            )}
          </View>
        ))}
        <TouchableOpacity
          style={[s.guide, { marginHorizontal: 18, marginTop: 26 }]}
          onPress={() => router.push("/stores")}
        >
          <Text style={s.heading}>Tiendas oficiales</Text>
          <Text style={s.small}>
            Explorá las marcas de USA y encontrá tu próximo producto.
          </Text>
          <Text style={s.more}>Ver tiendas →</Text>
        </TouchableOpacity>
        <View style={s.section}>
          <Text style={s.heading}>Cómo funciona ShopX</Text>
          {[
            "Elegí o cotizá tu producto",
            "Conocé el precio final antes de pagar",
            "Recibilo en tu casa y seguí cada etapa",
          ].map((step, i) => (
            <View key={step} style={s.step}>
              <Text style={s.stepNumber}>0{i + 1}</Text>
              <Text style={s.pathTitle}>{step}</Text>
            </View>
          ))}
        </View>
        <View style={s.section}>
          <Text style={s.heading}>Selecciones ShopX</Text>
          {guides.map((guide) => (
            <TouchableOpacity
              key={guide.path}
              style={s.guide}
              onPress={() => Linking.openURL(buildApiUrl(guide.path))}
            >
              <Text style={s.pathTitle}>{guide.title}</Text>
              <Text style={s.small}>{guide.text}</Text>
              <Text style={s.more}>Explorar →</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.section}>
          <Text style={s.heading}>Comprá con tranquilidad</Text>
          <Text style={s.small}>
            Pagá con Mercado Pago. Las cuotas y su costo se muestran al pagar.
            Seguí tus pedidos desde la compra hasta la entrega.
          </Text>
          <TouchableOpacity onPress={() => router.push("/orders")}>
            <Text style={s.more}>Ver mis pedidos →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL(buildApiUrl("/ayuda"))}
          >
            <Text style={s.more}>Ayuda y políticas →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <AppBottomNav />
    </View>
  );
}
const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#F7FAFC" },
  header: {
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  icons: { flexDirection: "row", gap: 20 },
  badge: {
    position: "absolute",
    right: -8,
    top: -10,
    backgroundColor: "#18C7D8",
    color: "#062B4F",
    borderRadius: 10,
    paddingHorizontal: 5,
    fontSize: 11,
    fontWeight: "800",
  },
  location: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  search: {
    marginHorizontal: 18,
    marginBottom: 18,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: { flex: 1, height: 50, color: "#062B4F" },
  hero: {
    marginHorizontal: 18,
    padding: 24,
    borderRadius: 26,
    backgroundColor: "#062B4F",
    gap: 14,
  },
  kicker: {
    color: "#18C7D8",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "800",
  },
  heroTitle: {
    color: "#FFF",
    fontSize: 35,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -1.4,
  },
  heroText: { color: "#D1E0EE", fontSize: 17 },
  primary: {
    backgroundColor: "#22D3EE",
    padding: 16,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  primaryText: { color: "#062B4F", fontWeight: "800", fontSize: 15 },
  section: { marginTop: 26, paddingHorizontal: 18, gap: 14 },
  heading: { fontSize: 22, fontWeight: "800", color: "#071E35", flexShrink: 1 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  small: { color: "#617590", fontSize: 13, lineHeight: 20 },
  paths: { flexDirection: "row", gap: 12 },
  path: {
    flex: 1,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  pathTitle: {
    color: "#062B4F",
    fontSize: 16,
    fontWeight: "800",
    flexShrink: 1,
  },
  quote: {
    margin: 18,
    marginBottom: 0,
    padding: 18,
    backgroundColor: "#EAFBFD",
    borderRadius: 22,
    gap: 14,
  },
  linkInput: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FFF",
    color: "#062B4F",
  },
  more: {
    color: "#087F91",
    fontWeight: "700",
    fontSize: 13,
    paddingVertical: 6,
  },
  step: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepNumber: { color: "#087F91", fontSize: 24, fontWeight: "800" },
  guide: {
    padding: 18,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    gap: 8,
  },
});
