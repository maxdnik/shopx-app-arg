import { useFocusEffect, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
import { AppBottomNav } from "../components/AppBottomNav";
import {
  CartItem,
  clearCart,
  getCartItems,
  getProductKey,
  updateCartItemQuantity,
} from "../lib/cart-store";
import {
  DomesticPricingDestination,
  formatUSD,
  getDisplayFinalPriceUSD,
  getProductBySlug,
  getProductImage,
  getSelectedOptionsSummary,
  resolveProductsBySlugs,
  resolveProductsForCartItems,
  ShopXProduct,
} from "../lib/api";
import {
  createMercadoPagoCheckout,
  getExchangeRate,
  PricingBreakdownRow,
} from "../lib/orders";
import {
  fetchCurrentUser,
  getAppAccount,
  getStoredUser,
  ShopXUser,
} from "../lib/auth";

const navy = "#062B4F";
const navyDark = "#031A33";
const text = "#071E35";
const muted = "#718096";
const soft = "#F7FAFC";
const softCard = "#F1F5F9";
const border = "#E2E8F0";
const white = "#FFFFFF";
const green = "#0EA371";
const greenSoft = "#E7FFF4";
const orange = "#F59E0B";
const orangeSoft = "#FFF7E6";

type BreakdownRow = {
  label: string;
  amount: number;
};

function normalizeText(value?: string | number | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function formatARS(value?: number) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "ARS pendiente";
  }

  return `ARS ${Math.round(amount).toLocaleString("es-AR")}`;
}

function getProductTitle(item: CartItem) {
  return item.product.title || "Producto ShopX";
}

function getBrand(item: CartItem) {
  return (
    item.product.brand ||
    item.product.store ||
    item.product.source ||
    "SHOPX"
  ).toUpperCase();
}

function getItemFinalPriceUSD(item: CartItem) {
  return getDisplayFinalPriceUSD(item.product) || 0;
}

function getUserDisplayName(user: ShopXUser | null) {
  if (!user) return "";
  return user.fullName || user.name || user.email || "Usuario ShopX";
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

function getBreakdownLabel(row: any) {
  return String(row?.label ?? row?.name ?? row?.concept ?? row?.title ?? "");
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

function getProductBreakdown(product: ShopXProduct): BreakdownRow[] {
  const rawProduct = product as any;

  const breakdown =
    rawProduct?.pricing?.breakdown ||
    rawProduct?.pricingBreakdown ||
    rawProduct?.breakdown ||
    rawProduct?.priceBreakdown ||
    [];

  if (!Array.isArray(breakdown)) return [];

  return breakdown
    .map((row: any) => ({
      label: normalizeBreakdownLabel(getBreakdownLabel(row)),
      amount: getBreakdownAmount(row),
    }))
    .filter((row) => row.label && Number.isFinite(row.amount) && row.amount >= 0);
}

const REQUIRED_BREAKDOWN_ROWS = [
  "Precio Productos USA",
  "IVA importación (21%)",
  "Flete Internacional",
  "Aduana y Tasas",
  "Gestión y Seguro ShopX",
  "Logística Nacional",
];

function getCartBreakdown(items: CartItem[]) {
  // Inicializamos todas las filas en cero para que la app muestre
  // exactamente los mismos conceptos que la web, incluso cuando un concepto vale USD 0.
  const totals: Record<string, number> = REQUIRED_BREAKDOWN_ROWS.reduce(
    (acc, label) => {
      acc[label] = 0;
      return acc;
    },
    {} as Record<string, number>
  );

  items.forEach((item) => {
    const quantity = Number(item.quantity || 1);
    const breakdown = getProductBreakdown(item.product);

    breakdown.forEach((row) => {
      const label = normalizeBreakdownLabel(row.label);
      totals[label] = (totals[label] || 0) + Number(row.amount || 0) * quantity;
    });
  });

  return REQUIRED_BREAKDOWN_ROWS.map((label) => ({
    label,
    amount: Number((totals[label] || 0).toFixed(2)),
  }));
}

function getProductResolveKeys(product: ShopXProduct) {
  const rawProduct = product as any;

  return [
    product.slug,
    product._id,
    product.id,
    product.externalId,
    rawProduct.sourceId,
    rawProduct.sourceHandle,
    product.sourceUrl,
    product.title,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function indexProductsByKeys(products: ShopXProduct[]) {
  const index = new Map<string, ShopXProduct>();

  products.forEach((product) => {
    getProductResolveKeys(product).forEach((key) => {
      index.set(normalizeText(key), product);
    });
  });

  return index;
}

function mergeFreshProduct(item: CartItem, freshProduct: ShopXProduct): CartItem {
  const itemProduct = item.product as any;
  const fresh = freshProduct as any;

  return {
    ...item,
    product: {
      ...item.product,
      ...freshProduct,
      selectedOptions: fresh.selectedOptions || itemProduct.selectedOptions,
      selectedVariant: fresh.selectedVariant || itemProduct.selectedVariant,
      selectedVariantId: fresh.selectedVariantId || itemProduct.selectedVariantId,
      pricing: fresh?.pricing || itemProduct?.pricing,
    },
  };
}

async function hydrateCartWithFreshPricing(
  cartItems: CartItem[],
  destination?: DomesticPricingDestination
) {
  if (!cartItems.length) return [];

  const resolveKeys = Array.from(
    new Set(
      cartItems
        .flatMap((item) => getProductResolveKeys(item.product))
        .map((key) => key.trim())
        .filter(Boolean)
    )
  );

  let resolvedProducts: ShopXProduct[] = [];

  try {
    const selectedItemRequests = cartItems.map((item) => {
      const rawProduct = item.product as any;
      const key = getProductResolveKeys(item.product)[0];

      return {
        key,
        selectedOptions: rawProduct.selectedOptions,
        selectedVariantId: rawProduct.selectedVariantId || rawProduct.selectedVariant?.id,
        quantity: Number(item.quantity || 1),
      };
    });

    resolvedProducts = await resolveProductsForCartItems(
      selectedItemRequests,
      destination
    );

    if (resolvedProducts.length === cartItems.length) {
      return cartItems.map((item, index) => mergeFreshProduct(item, resolvedProducts[index]));
    }
  } catch (error) {
    console.log("ERROR RESOLVE SELECTED PRODUCTS FOR CART:", error);
  }

  try {
    resolvedProducts = await resolveProductsBySlugs(resolveKeys, destination);
  } catch (error) {
    console.log("ERROR RESOLVE PRODUCTS FOR CART:", error);
  }

  const resolvedIndex = indexProductsByKeys(resolvedProducts);

  const hydratedItems = await Promise.all(
    cartItems.map(async (item) => {
      const matchedProduct = getProductResolveKeys(item.product)
        .map((key) => resolvedIndex.get(normalizeText(key)))
        .find(Boolean);

      if (matchedProduct) {
        return mergeFreshProduct(item, matchedProduct);
      }

      if (item.product.slug) {
        try {
          const productBySlug = await getProductBySlug(item.product.slug, destination);

          if (productBySlug) {
            return mergeFreshProduct(item, productBySlug);
          }
        } catch (error) {
          console.log("ERROR GET PRODUCT BY SLUG FOR CART:", error);
        }
      }

      return item;
    })
  );

  return hydratedItems;
}

function buildOrderItems(items: CartItem[]) {
  return items.map((item) => {
    const product = item.product as any;
    const finalPriceUSD = getItemFinalPriceUSD(item);

    return {
      productId: getProductKey(item.product),
      _id: product._id,
      id: product.id,
      slug: product.slug,
      externalId: product.externalId,
      title: product.title,
      image: getProductImage(item.product),
      quantity: Number(item.quantity || 1),
      priceUSD: finalPriceUSD,
      finalPriceUSD,
      estimatedUSD: finalPriceUSD,
      sourceUrl: product.sourceUrl,
      url: product.sourceUrl,
      brand: product.brand,
      store: product.store,
      source: product.source,
      category: product.category,
      pricing: product.pricing,
      selectedOptions: product.selectedOptions,
      selectedVariant: product.selectedVariant,
      selectedVariantId: product.selectedVariantId || product.selectedVariant?.id,
    };
  });
}

function buildAddressText(user: ShopXUser) {
  const street =
    user.address?.street ||
    [user.address?.streetName, user.address?.streetNumber]
      .filter(Boolean)
      .join(" ");

  return street || "A confirmar";
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

export default function CartScreen() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [user, setUser] = useState<ShopXUser | null>(null);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [exchangeLoading, setExchangeLoading] = useState(false);

  async function loadCartAndSession() {
    setLoading(true);
    setExchangeLoading(true);

    try {
      const rate = await getExchangeRate();
      setExchangeRate(rate);
    } catch (error) {
      console.log("ERROR EXCHANGE RATE:", error);
      setExchangeRate(0);
    } finally {
      setExchangeLoading(false);
    }

    const [cartItems, storedUser] = await Promise.all([
      getCartItems(),
      getStoredUser(),
    ]);

    let nextUser = storedUser;

    if (storedUser) {
      try {
        const account = await getAppAccount();
        nextUser = account.user;
        setProfileComplete(account.checkoutProfile.complete);
        setMissingFields(account.checkoutProfile.missingFields || []);
      } catch {
        const freshUser = await fetchCurrentUser();
        nextUser = freshUser;
        setProfileComplete(null);
        setMissingFields([]);
      }
    } else {
      setProfileComplete(false);
      setMissingFields([]);
    }

    setUser(nextUser);

    const hydratedItems = await hydrateCartWithFreshPricing(
      cartItems,
      buildDomesticPricingDestination(nextUser)
    );

    setItems(hydratedItems);
    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadCartAndSession();
    }, [])
  );

  const totalUSD = useMemo(() => {
    return items.reduce((total, item) => {
      return total + getItemFinalPriceUSD(item) * Number(item.quantity || 1);
    }, 0);
  }, [items]);

  const totalARS = useMemo(() => {
    if (!exchangeRate || exchangeRate <= 0) return 0;
    return Math.round(totalUSD * exchangeRate);
  }, [totalUSD, exchangeRate]);

  const paymentBreakdown = useMemo(() => {
    return getCartBreakdown(items);
  }, [items]);

  async function handleQuantityChange(item: CartItem, nextQuantity: number) {
    await updateCartItemQuantity(item.product, nextQuantity);
    await loadCartAndSession();
  }

  async function handleClearCart() {
    Alert.alert("Vaciar carrito", "¿Querés eliminar todos los productos?", [
      {
        text: "Cancelar",
        style: "cancel",
      },
      {
        text: "Vaciar",
        style: "destructive",
        onPress: async () => {
          await clearCart();
          setItems([]);
        },
      },
    ]);
  }

  async function handleCheckout() {
    if (checkoutLoading) return;

    if (!items.length) {
      Alert.alert("Carrito vacío", "Agregá productos antes de pagar.");
      return;
    }

    if (!exchangeRate || exchangeRate <= 0) {
      Alert.alert(
        "Cotización no disponible",
        "No pudimos obtener el dólar tarjeta. Volvé a intentar en unos segundos."
      );
      return;
    }

    if (!user) {
      Alert.alert(
        "Iniciá sesión para comprar",
        "Necesitás una cuenta ShopX para pagar y seguir tu pedido.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Ir a mi cuenta", onPress: () => router.push("/profile") },
        ]
      );
      return;
    }

    try {
      setCheckoutLoading(true);

      const account = await getAppAccount();

      setUser(account.user);
      setProfileComplete(account.checkoutProfile.complete);
      setMissingFields(account.checkoutProfile.missingFields || []);

      if (!account.checkoutProfile.complete) {
        setCheckoutLoading(false);

        Alert.alert(
          "Completá tus datos",
          "Para comprar necesitamos tu teléfono, DNI/CUIT y dirección de entrega.",
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Completar perfil", onPress: () => router.push("/profile") },
          ]
        );

        return;
      }

      const checkoutUser = account.user;
      const buyer = {
        fullName: getUserDisplayName(checkoutUser),
        email: checkoutUser.email,
        phone: checkoutUser.phone || "",
        dni: checkoutUser.dni || checkoutUser.billing?.dni || "",
        province:
          checkoutUser.address?.province || checkoutUser.billing?.province || "",
        city: checkoutUser.address?.city || checkoutUser.billing?.city || "",
        address:
          buildAddressText(checkoutUser) || checkoutUser.billing?.address || "",
        postalCode:
          checkoutUser.address?.postalCode ||
          checkoutUser.billing?.postalCode ||
          "",
      };

      const destination = {
        province:
          checkoutUser.address?.province || checkoutUser.billing?.province || "",
        city: checkoutUser.address?.city || checkoutUser.billing?.city || "",
        address:
          buildAddressText(checkoutUser) || checkoutUser.billing?.address || "",
        postalCode:
          checkoutUser.address?.postalCode ||
          checkoutUser.billing?.postalCode ||
          "",
      };

      const shippingUSD = paymentBreakdown
        .filter((row) => {
          const label = normalizeText(row.label);
          return (
            label.includes("logística") ||
            label.includes("logistica") ||
            label.includes("nacional")
          );
        })
        .reduce((total, row) => total + Number(row.amount || 0), 0);

      /**
       * CRÍTICO:
       * Antes la app creaba una orden en /api/app/orders ANTES de pagar y después
       * iniciaba Mercado Pago usando esa orden. Eso generaba órdenes pendientes
       * duplicadas y, además, el backend volvía a recalcular con otro pricing.
       *
       * Ahora la app envía un snapshot exacto del carrito al endpoint de Mercado Pago.
       * El backend crea una CheckoutSession temporal, cobra ese mismo monto y recién
       * crea la Order real cuando el webhook confirma payment.status === "approved".
       */
      const checkoutResponse = await createMercadoPagoCheckout({
        buyer,
        destination,
        items: buildOrderItems(items),
        totalUSD,
        totalARS,
        exchangeRateUsed: exchangeRate,
        pricingBreakdown: paymentBreakdown as PricingBreakdownRow[],
        shippingUSD,
        otherFeesUSD: 0,
        email: checkoutUser.email,
        phone: checkoutUser.phone || "",
      });

      const checkoutUrl =
        checkoutResponse.init_point || checkoutResponse.sandbox_init_point;

      if (!checkoutUrl) {
        throw new Error("Mercado Pago no devolvió un link de pago.");
      }

      console.log("SHOPX MP CHECKOUT:", {
        checkoutSessionId: checkoutResponse.checkoutSessionId,
        totalUSD,
        totalARS,
        exchangeRateUsed: exchangeRate,
        mpTotalARS: checkoutResponse.totalARS,
      });

      await Linking.openURL(checkoutUrl);
    } catch (error: any) {
      console.log("ERROR CHECKOUT CART:", error);

      Alert.alert(
        "No pudimos iniciar el pago",
        error?.message ||
          "Hubo un problema conectando con Mercado Pago."
      );
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.app}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={navy} />
          <Text style={styles.loadingText}>Cargando carrito...</Text>
        </View>

        <AppBottomNav />
      </View>
    );
  }

  return (
    <View style={styles.app}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topIconButton}
            activeOpacity={0.85}
            onPress={() => router.back()}
          >
            <Feather name="chevron-left" size={25} color={text} />
          </TouchableOpacity>

          <Text style={styles.topTitle}>Carrito</Text>

          <TouchableOpacity
            style={styles.topIconButton}
            activeOpacity={0.85}
            onPress={handleClearCart}
          >
            <Feather name="trash-2" size={20} color={text} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Tu carrito ShopX</Text>
          <Text style={styles.subtitle}>
            Revisá tus productos antes de avanzar con la compra.
          </Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Feather name="shopping-cart" size={34} color={navy} />
            </View>

            <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>

            <Text style={styles.emptyText}>
              Agregá productos desde la Home o desde Categorías para ver el
              precio final.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.9}
              onPress={() => router.push("/")}
            >
              <Text style={styles.primaryButtonText}>Ver productos</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.protectedCard}>
              <View style={styles.protectedIcon}>
                <MaterialCommunityIcons
                  name="shield-check-outline"
                  size={25}
                  color={white}
                />
              </View>

              <View style={styles.protectedCopy}>
                <Text style={styles.protectedTitle}>
                  Compra protegida ShopX
                </Text>
                <Text style={styles.protectedText}>
                  Precio final Argentina, seguimiento real y soporte por
                  WhatsApp.
                </Text>
              </View>
            </View>

            <View style={styles.itemsList}>
              {items.map((item) => {
                const imageUrl = getProductImage(item.product);
                const price = getItemFinalPriceUSD(item);
                const lineTotal = price * Number(item.quantity || 1);

                return (
                  <View
                    key={getProductKey(item.product)}
                    style={styles.cartItem}
                  >
                    <View style={styles.productImageBox}>
                      {imageUrl ? (
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.productImage}
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name="package-variant-closed"
                          size={42}
                          color={muted}
                        />
                      )}
                    </View>

                    <View style={styles.itemInfo}>
                      <Text style={styles.brand}>{getBrand(item)}</Text>

                      <Text style={styles.productTitle} numberOfLines={2}>
                        {getProductTitle(item)}
                      </Text>

                      {getSelectedOptionsSummary(item.product).length > 0 ? (
                        <View style={styles.selectedOptionsWrap}>
                          {getSelectedOptionsSummary(item.product).map((option) => (
                            <Text key={option} style={styles.selectedOptionText} numberOfLines={1}>
                              {option}
                            </Text>
                          ))}
                        </View>
                      ) : null}

                      <Text style={styles.priceLabel}>FINAL ARGENTINA</Text>

                      <Text style={styles.price}>
                        {price ? `USD ${formatUSD(lineTotal)}` : "Consultar"}
                      </Text>

                      <View style={styles.quantityRow}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          activeOpacity={0.85}
                          onPress={() =>
                            handleQuantityChange(item, item.quantity - 1)
                          }
                        >
                          <Feather name="minus" size={16} color={navy} />
                        </TouchableOpacity>

                        <Text style={styles.quantityText}>
                          {item.quantity}
                        </Text>

                        <TouchableOpacity
                          style={styles.quantityButton}
                          activeOpacity={0.85}
                          onPress={() =>
                            handleQuantityChange(item, item.quantity + 1)
                          }
                        >
                          <Feather name="plus" size={16} color={navy} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.destinationCard}>
              <View style={styles.destinationHeaderRow}>
                <Text style={styles.destinationTitle}>
                  Información de destino
                </Text>
                <Feather name="map-pin" size={17} color={navy} />
              </View>

              <View style={styles.destinationDivider} />

              <View style={styles.destinationRow}>
                <Text style={styles.destinationLabel}>Destino</Text>
                <Text style={styles.destinationValue}>
                  {user
                    ? user.address?.city ||
                      user.billing?.city ||
                      "A confirmar"
                    : "A confirmar"}
                </Text>
              </View>

              <View style={styles.destinationRow}>
                <Text style={styles.destinationLabel}>Entrega</Text>
                <Text style={styles.destinationValue}>5 a 10 días hábiles</Text>
              </View>

              <View style={[styles.destinationRow, styles.destinationRowLast]}>
                <Text style={styles.destinationLabel}>Modalidad</Text>
                <Text style={styles.destinationValue}>Puerta a puerta</Text>
              </View>
            </View>

            {user ? (
              <View style={styles.accountCard}>
                <View style={styles.accountIcon}>
                  <Feather name="user-check" size={20} color={navy} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.accountTitle}>Comprás como</Text>
                  <Text style={styles.accountName} numberOfLines={1}>
                    {getUserDisplayName(user)}
                  </Text>
                  <Text style={styles.accountEmail} numberOfLines={1}>
                    {user.email}
                  </Text>

                  {profileComplete === false ? (
                    <Text style={styles.accountWarning}>
                      Faltan datos para comprar
                    </Text>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.accountBadge,
                    profileComplete === false && styles.accountBadgePending,
                  ]}
                >
                  <Feather
                    name={profileComplete === false ? "alert-circle" : "check"}
                    size={13}
                    color={profileComplete === false ? orange : green}
                  />
                  <Text
                    style={[
                      styles.accountBadgeText,
                      profileComplete === false &&
                        styles.accountBadgeTextPending,
                    ]}
                  >
                    {profileComplete === false ? "PENDIENTE" : "ACTIVO"}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.loginRequiredCard}>
                <View style={styles.loginRequiredIcon}>
                  <Feather name="lock" size={22} color={navy} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.loginRequiredTitle}>
                    Iniciá sesión para comprar
                  </Text>
                  <Text style={styles.loginRequiredText}>
                    Necesitás una cuenta ShopX para pagar y seguir tu pedido.
                  </Text>

                  <TouchableOpacity
                    style={styles.loginRequiredButton}
                    activeOpacity={0.9}
                    onPress={() => router.push("/profile")}
                  >
                    <Text style={styles.loginRequiredButtonText}>
                      Ir a mi cuenta
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {user && profileComplete === false ? (
              <View style={styles.missingProfileCard}>
                <View style={styles.missingProfileIcon}>
                  <Feather name="alert-circle" size={22} color={orange} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.missingProfileTitle}>
                    Completá tus datos para pagar
                  </Text>

                  <Text style={styles.missingProfileText}>
                    Necesitamos teléfono, DNI/CUIT y dirección de entrega para
                    crear la orden.
                  </Text>

                  {missingFields.length > 0 ? (
                    <Text style={styles.missingProfileFields}>
                      Faltan: {missingFields.join(", ")}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    style={styles.missingProfileButton}
                    activeOpacity={0.9}
                    onPress={() => router.push("/profile")}
                  >
                    <Text style={styles.missingProfileButtonText}>
                      Completar perfil
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={styles.resumeCard}>
              <Text style={styles.resumeTitle}>Resumen</Text>

              <View style={styles.resumeRows}>
                {paymentBreakdown.length > 0 ? (
                  paymentBreakdown.map((row) => (
                    <View key={row.label} style={styles.resumeRow}>
                      <Text style={styles.resumeLabel} numberOfLines={2}>
                        {row.label}
                      </Text>

                      <Text style={styles.resumeAmount}>
                        USD {formatUSD(row.amount)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.resumeWarningBox}>
                    <Text style={styles.resumeWarningTitle}>
                      Desglose no disponible
                    </Text>
                    <Text style={styles.resumeWarningText}>
                      El producto tiene precio final, pero todavía no llegó el
                      detalle de pricing.breakdown desde la API.
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.resumeDivider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>

                <View style={styles.totalAmountBlock}>
                  {exchangeRate > 0 ? (
                    <Text style={styles.totalAmountARS}>
                      {formatARS(totalARS)}
                    </Text>
                  ) : (
                    <Text style={styles.totalAmountARS}>
                      {exchangeLoading ? "Cargando dólar..." : "ARS pendiente"}
                    </Text>
                  )}

                  <Text style={styles.totalAmountUSD}>
                    USD {formatUSD(totalUSD)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.payButton,
                  (!user ||
                    checkoutLoading ||
                    profileComplete === false ||
                    exchangeRate <= 0) &&
                    styles.payButtonDisabled,
                ]}
                activeOpacity={0.9}
                onPress={handleCheckout}
                disabled={checkoutLoading || exchangeRate <= 0}
              >
                {checkoutLoading ? (
                  <ActivityIndicator color={white} />
                ) : (
                  <Text style={styles.payButtonText}>
                    {!user
                      ? "Iniciar sesión para pagar"
                      : profileComplete === false
                      ? "Completar datos para pagar"
                      : exchangeRate <= 0
                      ? "Cargando cotización..."
                      : "Pagar con Mercado Pago"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.reviewButton}
                activeOpacity={0.9}
                onPress={() =>
                  Alert.alert(
                    "Revisión solicitada",
                    "ShopX puede revisar disponibilidad, peso real y categoría logística antes de avanzar."
                  )
                }
              >
                <Text style={styles.reviewButtonText}>
                  Solicitar revisión antes de pagar
                </Text>
              </TouchableOpacity>
                    {exchangeRate > 0 ? (
                <Text style={styles.resumeNote}>
                  Cotización dólar tarjeta: ARS{" "}
                  {exchangeRate.toLocaleString("es-AR")} · El pago se procesa
                  en pesos argentinos mediante Mercado Pago.
                </Text>
              ) : (
                <Text style={styles.resumeNote}>
                  No pudimos obtener la cotización del dólar tarjeta. Volvé a
                  intentar en unos segundos.
                </Text>
              )}
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
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
    paddingBottom: 10,
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

  header: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  title: {
    color: text,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  subtitle: {
    marginTop: 8,
    color: "#627896",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
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

  emptyCard: {
    marginHorizontal: 18,
    borderRadius: 30,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 26,
    alignItems: "center",
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 28,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    color: text,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
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

  protectedCard: {
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 24,
    backgroundColor: navyDark,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  protectedIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  protectedCopy: {
    flex: 1,
  },
  protectedTitle: {
    color: white,
    fontSize: 16,
    fontWeight: "900",
  },
  protectedText: {
    marginTop: 4,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  itemsList: {
    paddingHorizontal: 18,
    gap: 14,
  },
  cartItem: {
    borderRadius: 26,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 14,
    flexDirection: "row",
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  productImageBox: {
    width: 104,
    height: 104,
    borderRadius: 20,
    backgroundColor: softCard,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 14,
  },
  productImage: {
    width: "92%",
    height: "92%",
    resizeMode: "contain",
  },
  itemInfo: {
    flex: 1,
  },
  brand: {
    color: "#9AA6B8",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  productTitle: {
    marginTop: 5,
    color: text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  selectedOptionsWrap: {
    marginTop: 8,
    gap: 4,
  },
  selectedOptionText: {
    color: muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
  },
  priceLabel: {
    marginTop: 10,
    color: "#9AA6B8",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  price: {
    marginTop: 3,
    color: navy,
    fontSize: 18,
    fontWeight: "900",
  },
  quantityRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityText: {
    color: text,
    fontSize: 14,
    fontWeight: "900",
    minWidth: 18,
    textAlign: "center",
  },

  destinationCard: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 26,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 20,
    shadowColor: navy,
    shadowOpacity: 0.035,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  destinationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  destinationTitle: {
    color: text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  destinationDivider: {
    height: 1,
    backgroundColor: border,
    marginTop: 16,
    marginBottom: 16,
  },
  destinationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 13,
  },
  destinationRowLast: {
    marginBottom: 0,
  },
  destinationLabel: {
    flex: 1,
    color: "#7B8CA6",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  destinationValue: {
    flex: 1.15,
    color: text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
    textAlign: "right",
  },

  accountCard: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 26,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    shadowColor: navy,
    shadowOpacity: 0.035,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  accountIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
  },
  accountTitle: {
    color: muted,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 2,
  },
  accountName: {
    color: text,
    fontSize: 16,
    fontWeight: "900",
  },
  accountEmail: {
    color: muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  accountWarning: {
    marginTop: 5,
    color: orange,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  accountBadge: {
    height: 26,
    borderRadius: 999,
    paddingHorizontal: 9,
    backgroundColor: greenSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  accountBadgePending: {
    backgroundColor: orangeSoft,
  },
  accountBadgeText: {
    color: green,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  accountBadgeTextPending: {
    color: orange,
  },

  loginRequiredCard: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 26,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    flexDirection: "row",
    gap: 13,
    shadowColor: navy,
    shadowOpacity: 0.035,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  loginRequiredIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
  },
  loginRequiredTitle: {
    color: text,
    fontSize: 16,
    fontWeight: "900",
  },
  loginRequiredText: {
    marginTop: 4,
    color: muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  loginRequiredButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    height: 38,
    borderRadius: 999,
    paddingHorizontal: 15,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
  },
  loginRequiredButtonText: {
    color: white,
    fontSize: 13,
    fontWeight: "900",
  },

  missingProfileCard: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 26,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 18,
    flexDirection: "row",
    gap: 13,
    shadowColor: navy,
    shadowOpacity: 0.035,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  missingProfileIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: orangeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  missingProfileTitle: {
    color: text,
    fontSize: 16,
    fontWeight: "900",
  },
  missingProfileText: {
    marginTop: 4,
    color: muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  missingProfileFields: {
    marginTop: 6,
    color: orange,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
  },
  missingProfileButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    height: 38,
    borderRadius: 999,
    paddingHorizontal: 15,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
  },
  missingProfileButtonText: {
    color: white,
    fontSize: 13,
    fontWeight: "900",
  },

  resumeCard: {
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 28,
    borderRadius: 26,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 20,
    shadowColor: navy,
    shadowOpacity: 0.035,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  resumeTitle: {
    color: text,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "900",
    marginBottom: 18,
    letterSpacing: -0.6,
  },
  resumeRows: {
    gap: 13,
  },
  resumeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  resumeLabel: {
    flex: 1,
    color: "#7B8CA6",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  resumeAmount: {
    color: text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    textAlign: "right",
  },
  resumeWarningBox: {
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: border,
    padding: 14,
  },
  resumeWarningTitle: {
    color: text,
    fontSize: 14,
    fontWeight: "900",
  },
  resumeWarningText: {
    marginTop: 5,
    color: "#7B8CA6",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  resumeDivider: {
    height: 1,
    backgroundColor: border,
    marginTop: 20,
    marginBottom: 18,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  totalLabel: {
    flex: 1,
    color: text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  totalAmountBlock: {
    flex: 1.2,
    alignItems: "flex-end",
  },
  totalAmountARS: {
    color: navy,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "900",
    textAlign: "right",
  },
  totalAmountUSD: {
    marginTop: 3,
    color: "#7B8CA6",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "right",
  },
  resumeNote: {
    marginTop: 16,
    color: "#7B8CA6",
    fontSize: 10,
    lineHeight: 21,
    fontWeight: "600",
  },
  payButton: {
    marginTop: 20,
    backgroundColor: navy,
    borderRadius: 999,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  payButtonDisabled: {
    opacity: 0.72,
  },
  payButtonText: {
    color: white,
    fontSize: 16,
    fontWeight: "900",
  },
  reviewButton: {
    marginTop: 12,
    borderRadius: 999,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: border,
    backgroundColor: soft,
    paddingHorizontal: 16,
  },
  reviewButtonText: {
    color: navy,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
    textAlign: "center",
  },

  bottomSpacer: {
    height: 145,
  },
});