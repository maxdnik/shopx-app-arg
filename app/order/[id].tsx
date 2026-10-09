import { listStatus, orderGroup, storedARS } from "../../lib/order-tracking/list-model";
import { dateLabel, variantLabels } from "../../lib/order-tracking/view-model";
import { OrderShipments } from "../../components/OrderShipments";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  AppState,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { formatUSD } from "../../lib/api";
import { buildApiUrl } from "../../lib/config";
import { AppBottomNav } from "../../components/AppBottomNav";
import { fetchCurrentUser, getStoredUser, ShopXUser } from "../../lib/auth";
import {
  AppOrder,
  createMercadoPagoCheckout,
  getAppOrderById,
} from "../../lib/orders";

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
const red = "#DC2626";

function isCancelled(order: AppOrder) { return orderGroup(order) === "cancelled"; }
function isPendingPayment(order: AppOrder) { return order.status === "pending_payment" && !isCancelled(order); }
function getStatusLabel(order: AppOrder) { return listStatus(order).label; }
function getStatusDescription(order: AppOrder) { return listStatus(order).description; }
function getStatusStyle(order: AppOrder) {
  const { tone, label } = listStatus(order);
  const colors = {
    blue: { bg: softCard, color: navy },
    green: { bg: greenSoft, color: green },
    amber: { bg: orangeSoft, color: "#92400E" },
    muted: { bg: softCard, color: muted },
  };
  return { ...colors[tone], label };
}

function getPaymentReturnBanner(payment?: string | string[]) {
  const value = Array.isArray(payment) ? payment[0] : payment;
  const clean = String(value || "").toLowerCase();

  if (clean === "success") {
    return {
      type: "success",
      icon: "check-circle-outline",
      title: "Volviste de Mercado Pago",
      text: "Estamos verificando la confirmación del pago. El estado puede tardar unos segundos en actualizarse.",
    };
  }

  if (clean === "pending") {
    return {
      type: "pending",
      icon: "clock-outline",
      title: "Pago pendiente",
      text: "Mercado Pago informó que el pago quedó pendiente o en proceso. Te avisaremos cuando se confirme.",
    };
  }

  if (clean === "failure") {
    return {
      type: "failure",
      icon: "alert-circle-outline",
      title: "Pago no completado",
      text: "El pago no se completó. Podés intentar nuevamente desde este pedido.",
    };
  }

  return null;
}

function formatDate(value?: string) { return dateLabel(value) || "Sin fecha"; }

function formatARS(value?: number) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || value === undefined) {
    return "ARS pendiente";
  }

  return `ARS ${Math.round(amount).toLocaleString("es-AR")}`;
}

function getOrderTotalARS(order: AppOrder) { return storedARS(order); }

function getItemUnitPriceUSD(item: any) {
  const value =
    item?.priceUSD ??
    item?.finalPriceUSD ??
    item?.estimatedUSD ??
    item?.unitPriceUSD ??
    0;

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getItemsCount(order: AppOrder) {
  return order.itemsCount || order.items?.length || 0;
}

function getBuyerName(order: AppOrder, user: ShopXUser | null) {
  return (
    order.buyer?.fullName ||
    user?.fullName ||
    user?.name ||
    order.buyer?.email ||
    user?.email ||
    "Cliente ShopX"
  );
}

function toAbsoluteImageUrl(url?: string | null) {
  const clean = String(url || "").trim();

  if (!clean) return null;

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }

  return buildApiUrl(clean);
}

function getOrderItemImage(item: any) {
  const raw =
    item?.imageUrl ||
    item?.image ||
    item?.thumbnail ||
    item?.product?.imageUrl ||
    item?.product?.image ||
    item?.product?.images?.[0] ||
    item?.product?.imageUrls?.[0] ||
    item?.images?.[0] ||
    item?.imageUrls?.[0] ||
    null;

  return toAbsoluteImageUrl(raw);
}

function getItemBrand(item: any) {
  return String(item?.brand || item?.store || item?.product?.brand || "ShopX")
    .trim()
    .toUpperCase();
}

export default function OrderDetailScreen() {
  const { id, payment } = useLocalSearchParams<{
    id: string;
    payment?: string;
  }>();

  const [user, setUser] = useState<ShopXUser | null>(null);
  const [order, setOrder] = useState<AppOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingAfterPayment, setRefreshingAfterPayment] = useState(Boolean(payment));
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const requestVersion = useRef(0);

  const paymentBanner = getPaymentReturnBanner(payment);

  const loadOrder = useCallback(async (options?: { silent?: boolean }) => {
    const version = ++requestVersion.current;
    if (!options?.silent) { setLoading(true); setOrder(null); }
    setRefreshError("");
    try {
      const orderId = String(id || "");
      if (!orderId) return;
      const storedUser = await getStoredUser();
      const freshUser = storedUser || (await fetchCurrentUser());
      if (version !== requestVersion.current) return;
      setUser(freshUser);
      if (!freshUser) { setOrder(null); return; }
      const data = await getAppOrderById({ orderId, email: freshUser.email, phone: freshUser.phone });
      if (version === requestVersion.current) setOrder(data);
    } catch (error: any) {
      if (version === requestVersion.current) setRefreshError(error?.message || "No pudimos actualizar el pedido. Intentá nuevamente.");
    } finally {
      if (version === requestVersion.current) {
        setLoading(false); setRefreshingAfterPayment(false); setRefreshing(false);
      }
    }
  }, [id]);

  async function handlePayPendingOrder() {
    if (!order || !user || checkoutLoading) return;

    try {
      setCheckoutLoading(true);

      const checkoutResponse = await createMercadoPagoCheckout({
        orderId: order.orderNumber || order._id,
        email: user.email,
        phone: user.phone || "",
        exchangeRate: order.exchangeRateUsed,
      });

      const checkoutUrl =
        checkoutResponse.init_point || checkoutResponse.sandbox_init_point;

      if (!checkoutUrl) {
        throw new Error("Mercado Pago no devolvió un link de pago.");
      }

      await Linking.openURL(checkoutUrl);
    } catch (error: any) {
      console.log("ERROR PAY PENDING ORDER:", error);

      Alert.alert(
        "No pudimos abrir Mercado Pago",
        error?.message || "Intentá nuevamente en unos segundos.",
      );
    } finally {
      setCheckoutLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      void loadOrder();
      const refresh = () => {
        if (AppState.currentState === "active") void loadOrder({ silent: true });
      };
      const interval = setInterval(refresh, 60000);
      const subscription = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
      return () => { clearInterval(interval); subscription.remove(); requestVersion.current += 1; };
    }, [loadOrder]),
  );

  useEffect(() => {
    if (!payment) return;

    const timerOne = setTimeout(() => {
      setRefreshingAfterPayment(true);
      loadOrder({ silent: true });
    }, 1800);

    const timerTwo = setTimeout(() => {
      loadOrder({ silent: true });
    }, 4500);

    return () => {
      clearTimeout(timerOne);
      clearTimeout(timerTwo);
    };
  }, [payment, loadOrder]);

  if (loading) {
    return (
      <View style={styles.app}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={navy} />
          <Text style={styles.loadingText}>Cargando pedido...</Text>
        </View>
      </View>
    );
  }

  if (!user) {
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

            <Text style={styles.topTitle}>Pedido</Text>

            <View style={styles.topIconPlaceholder} />
          </View>

          <View style={styles.loginCard}>
            <View style={styles.loginIcon}>
              <Feather name="lock" size={25} color={navy} />
            </View>

            <Text style={styles.loginTitle}>Iniciá sesión</Text>
            <Text style={styles.loginText}>
              Necesitás iniciar sesión para ver el detalle del pedido.
            </Text>

            <TouchableOpacity
              style={styles.primaryButtonFull}
              activeOpacity={0.9}
              onPress={() => router.push("/profile")}
            >
              <Text style={styles.primaryButtonText}>Ir a mi cuenta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!order) {
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

            <Text style={styles.topTitle}>Pedido</Text>

            <View style={styles.topIconPlaceholder} />
          </View>

          <View style={styles.loginCard}>
            <View style={styles.loginIcon}>
              <MaterialCommunityIcons
                name="package-variant-closed"
                size={31}
                color={navy}
              />
            </View>

            <Text style={styles.loginTitle}>Pedido no encontrado</Text>
            <Text style={styles.loginText}>
              {refreshError || "No pudimos encontrar este pedido o no está asociado a tu cuenta."}
            </Text>

            <TouchableOpacity
              style={styles.primaryButtonFull}
              activeOpacity={0.9}
              onPress={() => router.push("/orders")}
            >
              <Text style={styles.primaryButtonText}>Volver a pedidos</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  const statusStyle = getStatusStyle(order);
  const totalARS = getOrderTotalARS(order);

  return (
    <View style={styles.app}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadOrder({ silent: true }); }} tintColor={navy} />}
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

          <Text style={styles.topTitle}>Pedido</Text>

          <TouchableOpacity
            style={styles.topIconButton}
            activeOpacity={0.85}
            onPress={() => Linking.openURL("https://wa.me/5491150000000")}
          >
            <MaterialCommunityIcons name="whatsapp" size={21} color={navy} />
          </TouchableOpacity>
        </View>

        {paymentBanner ? (
          <View
            style={[
              styles.paymentReturnCard,
              paymentBanner.type === "success" && styles.paymentReturnSuccess,
              paymentBanner.type === "pending" && styles.paymentReturnPending,
              paymentBanner.type === "failure" && styles.paymentReturnFailure,
            ]}
          >
            <View style={styles.paymentReturnIcon}>
              <MaterialCommunityIcons
                name={paymentBanner.icon as any}
                size={24}
                color={
                  paymentBanner.type === "failure"
                    ? red
                    : paymentBanner.type === "pending"
                      ? orange
                      : green
                }
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.paymentReturnTitle}>
                {paymentBanner.title}
              </Text>

              <Text style={styles.paymentReturnText}>{paymentBanner.text}</Text>

              {refreshingAfterPayment ? (
                <View style={styles.refreshingRow}>
                  <ActivityIndicator size="small" color={navy} />
                  <Text style={styles.refreshingText}>
                    Actualizando estado del pedido...
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.orderEyebrow}>ORDEN SHOPX</Text>
              <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            </View>

            <View
              style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}
            >
              <Text
                style={[styles.statusPillText, { color: statusStyle.color }]}
              >
                {statusStyle.label}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{getStatusLabel(order)}</Text>
          <Text style={styles.heroText}>{getStatusDescription(order)}</Text>

          <View style={styles.heroDivider} />

          <View style={styles.heroMetaRow}>
            <View>
              <Text style={styles.heroMetaLabel}>Fecha</Text>
              <Text style={styles.heroMetaValue}>
                {formatDate(order.createdAt)}
              </Text>
            </View>

            <View>
              <Text style={styles.heroMetaLabel}>Productos</Text>
              <Text style={styles.heroMetaValue}>{getItemsCount(order)}</Text>
            </View>

            <View style={styles.heroMetaTotalBlock}>
              <Text style={styles.heroMetaLabel}>Total</Text>
              <Text style={styles.heroMetaValue}>
                USD {formatUSD(order.totalUSD)}
              </Text>
            </View>
          </View>
        </View>

        {isPendingPayment(order) ? (
          <View style={styles.pendingPaymentCard}>
            <View style={styles.pendingPaymentIcon}>
              <MaterialCommunityIcons
                name="credit-card-outline"
                size={24}
                color={navy}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.pendingPaymentTitle}>Pago pendiente</Text>
              <Text style={styles.pendingPaymentText}>
                Este pedido todavía no fue pagado. Podés continuar el pago con
                Mercado Pago.
              </Text>

              <TouchableOpacity
                style={[
                  styles.pendingPaymentButton,
                  checkoutLoading && styles.pendingPaymentButtonDisabled,
                ]}
                activeOpacity={0.9}
                onPress={handlePayPendingOrder}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? (
                  <ActivityIndicator color={white} />
                ) : (
                  <Text style={styles.pendingPaymentButtonText}>
                    Pagar con Mercado Pago
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {refreshError ? <Text accessibilityRole="alert" style={{ color: red, margin: 18 }}>{refreshError}</Text> : null}
        <OrderShipments
          key={order._id}
          order={order}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); void loadOrder({ silent: true }); }}
        />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Productos</Text>

          <View style={styles.itemsList}>
            {(order.items || []).map((item: any, index: number) => {
              const quantity = Number(item.qty || item.quantity || 1);
              const unitPriceUSD = getItemUnitPriceUSD(item);
              const lineTotalUSD = unitPriceUSD * quantity;
              const imageUrl = getOrderItemImage(item);

              return (
                <View
                  key={`${item.productId || item.slug || item.title}-${index}`}
                  style={styles.itemRow}
                >
                  <View style={styles.itemImageBox}>
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.itemImage}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="package-variant-closed"
                        size={26}
                        color={navy}
                      />
                    )}
                  </View>

                  <View style={styles.itemInfo}>
                    <Text style={styles.itemBrand}>{getItemBrand(item)}</Text>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {item.title || "Producto ShopX"}
                    </Text>

                    {variantLabels(item.selections).map(label => <Text key={label} style={styles.itemMeta}>{label}</Text>)}
                    <View style={styles.itemMetaRow}>
                      <Text style={styles.itemMeta}>Cantidad: {quantity}</Text>
                      <Text style={styles.itemMeta}>Importe del producto</Text>
                    </View>
                  </View>

                  <View style={styles.itemPriceBlock}>
                    <Text style={styles.itemPrice}>
                      {lineTotalUSD > 0
                        ? `USD ${formatUSD(lineTotalUSD)}`
                        : "Consultar"}
                    </Text>
                    {quantity > 1 && unitPriceUSD > 0 ? (
                      <Text style={styles.itemPriceUSD}>
                        USD {formatUSD(unitPriceUSD)} c/u
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Resumen de pago</Text>

          <View style={styles.breakdownList}>
            {(order.pricingBreakdown || []).length > 0 ? (
              (order.pricingBreakdown || []).map((row, index) => (
                <View key={`${row.label}-${index}`} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{row.label}</Text>

                  <Text style={styles.breakdownAmount}>
                    USD {formatUSD(row.amount)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Total final</Text>

                <Text style={styles.breakdownAmount}>
                  USD {formatUSD(order.totalUSD)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.totalDivider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total final</Text>

            <View style={styles.totalAmountBlock}>
              <Text style={styles.totalAmount}>
                {totalARS !== null
                  ? formatARS(totalARS)
                  : `USD ${formatUSD(order.totalUSD)}`}
              </Text>
              <Text style={styles.totalAmountUSD}>
                USD {formatUSD(order.totalUSD)}
              </Text>
            </View>
          </View>

          {order.exchangeRateUsed ? (
            <Text style={styles.exchangeText}>
              Dólar tarjeta usado al comprar: ARS{" "}
              {Number(order.exchangeRateUsed).toLocaleString("es-AR")}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Entrega</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cliente</Text>
            <Text style={styles.infoValue}>{getBuyerName(order, user)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>
              {order.buyer?.email || user.email}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Destino</Text>
            <Text style={styles.infoValue}>
              {[order.buyer?.address, order.buyer?.city, order.buyer?.province, order.buyer?.postalCode].filter(Boolean).join(" · ") || "A confirmar"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Modalidad</Text>
            <Text style={styles.infoValue}>Puerta a puerta</Text>
          </View>

          {order.localTrackingNumber ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tracking</Text>
              <Text style={styles.infoValue}>{order.localTrackingNumber}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.helpBanner}>
          <View style={styles.helpIcon}>
            <Feather name="message-circle" size={25} color={white} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.helpTitle}>¿Tenés una duda?</Text>
            <Text style={styles.helpText}>
              Hablá con una persona real de ShopX sobre este pedido.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => Linking.openURL("https://wa.me/5491150000000")}
          >
            <Text style={styles.helpButtonText}>Abrir</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 132 }} />
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

  topBar: {
    paddingTop: 42,
    paddingHorizontal: 18,
    paddingBottom: 12,
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
  topIconPlaceholder: {
    width: 42,
    height: 42,
  },
  topTitle: {
    color: text,
    fontSize: 17,
    fontWeight: "900",
  },

  paymentReturnCard: {
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 26,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  paymentReturnSuccess: {
    borderColor: "#BBF7D0",
  },
  paymentReturnPending: {
    borderColor: "#FED7AA",
  },
  paymentReturnFailure: {
    borderColor: "#FECACA",
  },
  paymentReturnIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentReturnTitle: {
    color: text,
    fontSize: 16,
    fontWeight: "900",
  },
  paymentReturnText: {
    marginTop: 4,
    color: muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  refreshingRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshingText: {
    color: navy,
    fontSize: 12,
    fontWeight: "800",
  },

  heroCard: {
    marginHorizontal: 18,
    borderRadius: 30,
    backgroundColor: navy,
    padding: 20,
    shadowColor: navy,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  orderEyebrow: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  orderNumber: {
    marginTop: 4,
    color: white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  statusPill: {
    minHeight: 32,
    maxWidth: "100%",
    paddingVertical: 7,
    borderRadius: 999,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  heroTitle: {
    marginTop: 22,
    color: white,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  heroText: {
    marginTop: 6,
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  heroDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginVertical: 18,
  },
  heroMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  heroMetaLabel: {
    color: "rgba(255,255,255,0.52)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  heroMetaValue: {
    marginTop: 4,
    color: white,
    fontSize: 15,
    fontWeight: "900",
  },
  heroMetaTotalBlock: {
    flex: 1,
    alignItems: "flex-end",
  },

  pendingPaymentCard: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 28,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    flexDirection: "row",
    gap: 13,
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  pendingPaymentIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingPaymentTitle: {
    color: text,
    fontSize: 17,
    fontWeight: "900",
  },
  pendingPaymentText: {
    marginTop: 4,
    color: muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  pendingPaymentButton: {
    marginTop: 14,
    height: 48,
    borderRadius: 999,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingPaymentButtonDisabled: {
    opacity: 0.72,
  },
  pendingPaymentButtonText: {
    color: white,
    fontSize: 14,
    fontWeight: "900",
  },
  sectionTitle: {
    color: text,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
    letterSpacing: -0.4,
  },

  card: {
    marginHorizontal: 18,
    marginTop: 14,
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

  itemsList: {
    marginTop: 14,
    gap: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    backgroundColor: softCard,
    borderWidth: 1,
    borderColor: border,
    padding: 12,
  },
  itemImageBox: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  itemImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  itemBrand: {
    color: "#9AA6B8",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  itemMetaRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    color: text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },
  itemMeta: {
    marginTop: 3,
    color: muted,
    fontSize: 12,
    fontWeight: "700",
  },
  itemPriceBlock: {
    maxWidth: 118,
    alignItems: "flex-end",
  },
  itemPrice: {
    color: navy,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    textAlign: "right",
  },
  itemPriceUSD: {
    marginTop: 2,
    color: "#7B8CA6",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    textAlign: "right",
  },

  breakdownList: {
    marginTop: 16,
    gap: 12,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  breakdownLabel: {
    flex: 1,
    color: muted,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  breakdownAmount: {
    color: text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    textAlign: "right",
  },
  totalDivider: {
    height: 1,
    backgroundColor: border,
    marginTop: 18,
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  totalLabel: {
    flex: 1,
    color: text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  totalAmountBlock: {
    flex: 1.15,
    alignItems: "flex-end",
  },
  totalAmount: {
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
  exchangeText: {
    marginTop: 8,
    color: muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  infoRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  infoLabel: {
    color: muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  infoValue: {
    flex: 1,
    color: text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
    textAlign: "right",
  },

  helpBanner: {
    marginHorizontal: 18,
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: navyDark,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  helpIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  helpTitle: {
    color: white,
    fontSize: 16,
    fontWeight: "900",
  },
  helpText: {
    marginTop: 3,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "600",
  },
  helpButton: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: white,
    alignItems: "center",
    justifyContent: "center",
  },
  helpButtonText: {
    color: text,
    fontSize: 13,
    fontWeight: "900",
  },

  loginCard: {
    marginHorizontal: 18,
    marginTop: 12,
    borderRadius: 30,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 24,
    alignItems: "center",
    shadowColor: navy,
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  loginIcon: {
    width: 68,
    height: 68,
    borderRadius: 26,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  loginTitle: {
    color: text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  loginText: {
    marginTop: 8,
    color: muted,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  primaryButtonFull: {
    marginTop: 20,
    width: "100%",
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: navy,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: white,
    fontSize: 15,
    fontWeight: "900",
  },
});
