import { useFocusEffect, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { AppBottomNav } from "../../components/AppBottomNav";
import { ScreenHeader } from "../../components/ScreenHeader";
import { formatUSD } from "../../lib/api";
import { fetchCurrentUser, getStoredUser, ShopXUser } from "../../lib/auth";
import { AppOrder, getAppOrders } from "../../lib/orders";

const navy = "#062B4F";
const navyDark = "#031A33";
const text = "#071E35";
const muted = "#718096";
const accent = "#18C7D8";
const soft = "#F7FAFC";
const softCard = "#F1F5F9";
const border = "#E2E8F0";
const white = "#FFFFFF";

type OrderStatus =
  | "pending_payment"
  | "purchased"
  | "miami"
  | "traveling"
  | "argentina"
  | "delivered"
  | "cancelled";

type TabFilter = "active" | "delivered" | "all";

const steps: { key: OrderStatus; label: string; icon: string }[] = [
  { key: "purchased", label: "Comprado", icon: "check" },
  { key: "miami", label: "Miami", icon: "home" },
  { key: "traveling", label: "En viaje", icon: "navigation" },
  { key: "argentina", label: "Argentina", icon: "map-pin" },
  { key: "delivered", label: "Entregado", icon: "package" },
];

function normalizeStep(step?: string): OrderStatus | null {
  const clean = String(step || "").toLowerCase();

  if (clean === "pending_payment") return "pending_payment";
  if (clean === "purchased" || clean === "paid") return "purchased";

  if (
    clean === "miami" ||
    clean === "warehouse" ||
    clean === "in_miami_warehouse" ||
    clean === "received_miami"
  ) {
    return "miami";
  }

  if (
    clean === "traveling" ||
    clean === "in_transit" ||
    clean === "shipped"
  ) {
    return "traveling";
  }

  if (
    clean === "argentina" ||
    clean === "customs" ||
    clean === "local_delivery"
  ) {
    return "argentina";
  }

  if (clean === "delivered") return "delivered";
  if (clean === "cancelled" || clean === "canceled") return "cancelled";

  return null;
}

function getStepIndex(status: OrderStatus) {
  if (status === "pending_payment" || status === "cancelled") return -1;

  return steps.findIndex((step) => step.key === status);
}

function getOrderVisualStatus(order: AppOrder): OrderStatus {
  const trackingStep = normalizeStep(order.tracking?.currentStep);

  if (
    trackingStep &&
    trackingStep !== "pending_payment" &&
    trackingStep !== "cancelled"
  ) {
    return trackingStep;
  }

  const status = String(order.status || "").toLowerCase();
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();

  if (status === "delivered") return "delivered";

  if (
    status === "argentina" ||
    status === "customs" ||
    status === "local_delivery"
  ) {
    return "argentina";
  }

  if (
    status === "in_transit" ||
    status === "traveling" ||
    status === "shipped"
  ) {
    return "traveling";
  }

  if (
    status === "miami" ||
    status === "warehouse" ||
    status === "in_miami_warehouse" ||
    status === "received_miami"
  ) {
    return "miami";
  }

  if (
    paymentStatus === "approved" ||
    status === "paid" ||
    status === "processing"
  ) {
    return "purchased";
  }

  return "purchased";
}

function isDelivered(order: AppOrder) {
  const trackingStep = normalizeStep(order.tracking?.currentStep);
  const status = String(order.status || "").toLowerCase();

  return trackingStep === "delivered" || status === "delivered";
}

function isCancelled(order: AppOrder) {
  const trackingStep = normalizeStep(order.tracking?.currentStep);
  const status = String(order.status || "").toLowerCase();
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();

  return (
    trackingStep === "cancelled" ||
    status === "cancelled" ||
    status === "canceled" ||
    paymentStatus === "rejected" ||
    paymentStatus === "cancelled"
  );
}

function isPendingPayment(order: AppOrder) {
  const trackingStep = normalizeStep(order.tracking?.currentStep);
  const status = String(order.status || "").toLowerCase();
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();

  return (
    trackingStep === "pending_payment" ||
    status === "pending_payment" ||
    paymentStatus === "pending"
  );
}

function getOrderStatusLabel(order: AppOrder) {
  if (order.tracking?.currentLabel) {
    return order.tracking.currentLabel;
  }

  const status = String(order.status || "").toLowerCase();
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();

  if (isCancelled(order)) return "Cancelado";
  if (isDelivered(order)) return "Entregado";

  if (paymentStatus === "approved" || status === "paid") {
    return "Compra confirmada";
  }

  if (status === "processing") return "Compra en proceso";

  if (
    status === "in_miami_warehouse" ||
    status === "miami" ||
    status === "warehouse" ||
    status === "received_miami"
  ) {
    return "Recibido en Miami";
  }

  if (
    status === "in_transit" ||
    status === "traveling" ||
    status === "shipped"
  ) {
    return "En viaje a Argentina";
  }

  if (status === "argentina" || status === "customs") {
    return "En Argentina";
  }

  if (isPendingPayment(order)) return "Pago pendiente";

  return "Pedido creado";
}

function getOrderEta(order: AppOrder) {
  if (order.tracking?.currentDescription) {
    return order.tracking.currentDescription;
  }

  if (isCancelled(order)) return "El pedido fue cancelado.";
  if (isDelivered(order)) return "Pedido entregado correctamente.";
  if (isPendingPayment(order)) return "Pendiente de pago con Mercado Pago.";

  const status = String(order.status || "").toLowerCase();

  if (
    status === "in_miami_warehouse" ||
    status === "miami" ||
    status === "warehouse" ||
    status === "received_miami"
  ) {
    return "Preparando consolidación y despacho.";
  }

  if (
    status === "in_transit" ||
    status === "traveling" ||
    status === "shipped"
  ) {
    return "Llega estimado: 5 a 7 días hábiles.";
  }

  if (status === "argentina" || status === "customs") {
    return "En proceso de ingreso y distribución local.";
  }

  return "Seguimiento actualizado por ShopX.";
}

function getLastUpdate(order: AppOrder) {
  const trackingUpdated = order.tracking?.lastUpdatedAt;

  if (trackingUpdated) {
    return formatDate(trackingUpdated);
  }

  if (order.updatedAt && order.updatedAt !== order.createdAt) {
    return formatDate(order.updatedAt);
  }

  return formatDate(order.createdAt);
}

function formatDate(value?: string) {
  if (!value) return "Sin fecha";

  try {
    const date = new Date(value);

    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return "Sin fecha";
  }
}

function formatARS(value?: number) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "ARS pendiente";
  }

  return `ARS ${Math.round(amount).toLocaleString("es-AR")}`;
}

function getOrderTotalARS(order: AppOrder) {
  const totalARS = Number((order as any).totalARS || 0);

  if (Number.isFinite(totalARS) && totalARS > 0) {
    return totalARS;
  }

  const totalUSD = Number(order.totalUSD || 0);
  const exchangeRateUsed = Number(order.exchangeRateUsed || 0);

  if (
    Number.isFinite(totalUSD) &&
    totalUSD > 0 &&
    Number.isFinite(exchangeRateUsed) &&
    exchangeRateUsed > 0
  ) {
    return totalUSD * exchangeRateUsed;
  }

  return 0;
}

function getExchangeRateLabel(order: AppOrder) {
  const rate = Number(order.exchangeRateUsed || 0);

  if (!Number.isFinite(rate) || rate <= 0) {
    return null;
  }


}

function getItemsSummary(order: AppOrder) {
  const items = Array.isArray(order.items) ? order.items : [];

  if (!items.length) return "Producto ShopX";

  const firstItem = items[0]?.title || "Producto ShopX";

  if (items.length === 1) return firstItem;

  return `${firstItem} + ${items.length - 1} producto${
    items.length - 1 === 1 ? "" : "s"
  }`;
}

function getBrandSummary(order: AppOrder) {
  const items = Array.isArray(order.items) ? order.items : [];
  const firstItem = items[0] as any;

  const brand =
    firstItem?.specs?.brand ||
    firstItem?.brand ||
    firstItem?.specs?.store ||
    firstItem?.store ||
    "SHOPX";

  return String(brand).toUpperCase();
}

function OrderProgress({ status }: { status: OrderStatus }) {
  const currentIndex = getStepIndex(status);

  return (
    <View style={styles.progressWrap}>
      {steps.map((step, index) => {
        const completed = currentIndex >= 0 && index <= currentIndex;
        const isLast = index === steps.length - 1;

        return (
          <View key={step.key} style={styles.stepBlock}>
            <View style={styles.stepTop}>
              <View
                style={[
                  styles.stepCircle,
                  completed && styles.stepCircleDone,
                ]}
              >
                <Feather
                  name={completed ? "check" : (step.icon as any)}
                  size={completed ? 16 : 15}
                  color={completed ? white : "#AAB6C8"}
                />
              </View>

              {!isLast && (
                <View style={styles.stepLineWrap}>
                  <View
                    style={[
                      styles.stepLine,
                      index < currentIndex && styles.stepLineDone,
                    ]}
                  />
                </View>
              )}
            </View>

            <Text
              style={[styles.stepLabel, completed && styles.stepLabelDone]}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function OrderCard({ order }: { order: AppOrder }) {
  const visualStatus = getOrderVisualStatus(order);
  const totalARS = getOrderTotalARS(order);
  const exchangeRateLabel = getExchangeRateLabel(order);

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderTopRow}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderId}>{order.orderNumber}</Text>

          <Text style={styles.orderTitle} numberOfLines={2}>
            {getItemsSummary(order)}
          </Text>

          <Text style={styles.orderBrand}>{getBrandSummary(order)}</Text>
        </View>
      </View>

      <View style={styles.statusBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>{getOrderStatusLabel(order)}</Text>
          <Text style={styles.statusText}>{getOrderEta(order)}</Text>
        </View>

        <View style={styles.priceBlock}>
          <Text style={styles.priceARS}>{formatARS(totalARS)}</Text>
          <Text style={styles.priceUSD}>USD {formatUSD(order.totalUSD)}</Text>

          {exchangeRateLabel ? (
            <Text style={styles.exchangeLabel}>{exchangeRateLabel}</Text>
          ) : null}
        </View>
      </View>

      <OrderProgress status={visualStatus} />

      <View style={styles.divider} />

      <View>
        <Text style={styles.updateLabel}>ÚLTIMA ACTUALIZACIÓN</Text>
        <Text style={styles.updateText}>{getLastUpdate(order)}</Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButtonFull}
        onPress={() => router.push(`/order/${order.orderNumber || order._id}`)}
      >
        <Text style={styles.primaryButtonText}>Ver detalle</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function OrdersScreen() {
  const [user, setUser] = useState<ShopXUser | null>(null);
  const [orders, setOrders] = useState<AppOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabFilter>("active");

  async function loadOrders(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setLoading(true);
    }

    const storedUser = await getStoredUser();

    if (!storedUser) {
      const freshUser = await fetchCurrentUser();

      if (!freshUser) {
        setUser(null);
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setUser(freshUser);

      try {
        const data = await getAppOrders({
          email: freshUser.email,
          phone: freshUser.phone,
          limit: 50,
        });

        setOrders(data);
      } catch (error: any) {
        console.log("ERROR LOAD ORDERS:", error);
      }

      setLoading(false);
      setRefreshing(false);
      return;
    }

    setUser(storedUser);

    fetchCurrentUser().then((freshUser) => {
      if (freshUser) setUser(freshUser);
    });

    try {
      const data = await getAppOrders({
        email: storedUser.email,
        phone: storedUser.phone,
        limit: 50,
      });

      setOrders(data);
    } catch (error: any) {
      console.log("ERROR LOAD ORDERS:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadOrders({ silent: true });
  }

  const activeOrders = useMemo(() => {
    return orders.filter((order) => !isDelivered(order) && !isCancelled(order))
      .length;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (tab === "all") return orders;

    if (tab === "delivered") {
      return orders.filter((order) => isDelivered(order));
    }

    return orders.filter((order) => !isDelivered(order) && !isCancelled(order));
  }, [orders, tab]);

  if (loading) {
    return (
      <View style={styles.app}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={navy} />
          <Text style={styles.loadingText}>Cargando pedidos...</Text>
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <ScreenHeader
          title="Mis pedidos"
          subtitle="Seguimiento claro de tus compras desde USA hasta tu casa."
        />

        {!user ? (
          <>
            <View style={styles.loginCard}>
              <View style={styles.loginIcon}>
                <Feather name="lock" size={25} color={navy} />
              </View>

              <Text style={styles.loginTitle}>
                Iniciá sesión para ver tus pedidos
              </Text>

              <Text style={styles.loginText}>
                Tus compras quedan asociadas a tu cuenta ShopX y se sincronizan
                entre la app, la web y el panel administrativo.
              </Text>

              <TouchableOpacity
                style={styles.loginButton}
                activeOpacity={0.9}
                onPress={() => router.push("/profile")}
              >
                <Text style={styles.loginButtonText}>Ir a mi cuenta</Text>
                <Feather name="arrow-right" size={18} color={white} />
              </TouchableOpacity>
            </View>

            <View style={styles.helpBanner}>
              <View style={styles.helpIcon}>
                <Feather name="message-circle" size={25} color={white} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.helpTitle}>¿Tenés una duda?</Text>
                <Text style={styles.helpText}>
                  Hablá con una persona real de ShopX.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.helpButton}
                onPress={() => Linking.openURL("https://wa.me/5491150000000")}
              >
                <Text style={styles.helpButtonText}>Abrir</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.headerContent}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{activeOrders}</Text>
                  <Text style={styles.summaryLabel}>Activos</Text>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>5–10</Text>
                  <Text style={styles.summaryLabel}>Días hábiles</Text>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>100%</Text>
                  <Text style={styles.summaryLabel}>Tracking</Text>
                </View>
              </View>

              <View style={styles.trustCard}>
                <View style={styles.trustIcon}>
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={23}
                    color={navy}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.trustTitle}>Compra protegida ShopX</Text>
                  <Text style={styles.trustText}>
                    Si necesitás ayuda con un pedido, te acompañamos por
                    WhatsApp.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[
                  styles.tabPill,
                  tab === "active" && styles.tabPillActive,
                ]}
                onPress={() => setTab("active")}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "active" && styles.tabTextActive,
                  ]}
                >
                  En curso
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabPill,
                  tab === "delivered" && styles.tabPillActive,
                ]}
                onPress={() => setTab("delivered")}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "delivered" && styles.tabTextActive,
                  ]}
                >
                  Entregados
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabPill,
                  tab === "all" && styles.tabPillActive,
                ]}
                onPress={() => setTab("all")}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "all" && styles.tabTextActive,
                  ]}
                >
                  Todos
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  {tab === "active"
                    ? "Pedidos en curso"
                    : tab === "delivered"
                    ? "Pedidos entregados"
                    : "Todos tus pedidos"}
                </Text>

                <Text style={styles.sectionSubtitle}>
                  {filteredOrders.length} pedido
                  {filteredOrders.length === 1 ? "" : "s"} con seguimiento real
                </Text>
              </View>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={handleRefresh}
              >
                <Feather name="refresh-cw" size={16} color={text} />
              </TouchableOpacity>
            </View>

            {filteredOrders.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <MaterialCommunityIcons
                    name="package-variant-closed"
                    size={34}
                    color={navy}
                  />
                </View>

                <Text style={styles.emptyTitle}>
                  {orders.length === 0
                    ? "Todavía no tenés pedidos"
                    : "No hay pedidos en esta sección"}
                </Text>

                <Text style={styles.emptyText}>
                  {orders.length === 0
                    ? "Cuando compres desde la app o la web, tus pedidos van a aparecer acá automáticamente."
                    : "Probá cambiando de pestaña para ver otros estados."}
                </Text>

                <TouchableOpacity
                  style={styles.loginButton}
                  activeOpacity={0.9}
                  onPress={() => router.push("/")}
                >
                  <Text style={styles.loginButtonText}>Ver productos</Text>
                  <Feather name="arrow-right" size={18} color={white} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.ordersList}>
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order._id || order.orderNumber}
                    order={order}
                  />
                ))}
              </View>
            )}

            <View style={styles.helpBanner}>
              <View style={styles.helpIcon}>
                <Feather name="message-circle" size={25} color={white} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.helpTitle}>¿Tenés una duda?</Text>
                <Text style={styles.helpText}>
                  Hablá con una persona real de ShopX.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.helpButton}
                onPress={() => Linking.openURL("https://wa.me/5491150000000")}
              >
                <Text style={styles.helpButtonText}>Abrir</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

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

  headerContent: {
    paddingHorizontal: 18,
    paddingBottom: 8,
  },

  summaryCard: {
    marginTop: 6,
    height: 86,
    borderRadius: 28,
    backgroundColor: navy,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    shadowColor: navy,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryNumber: {
    color: white,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  summaryLabel: {
    marginTop: 4,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "800",
  },
  summaryDivider: {
    width: 1,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  trustCard: {
    marginTop: 14,
    borderRadius: 22,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: navy,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  trustIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  trustTitle: {
    color: text,
    fontSize: 14,
    fontWeight: "900",
  },
  trustText: {
    marginTop: 3,
    color: muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },

  tabsRow: {
    paddingHorizontal: 18,
    marginTop: 8,
    flexDirection: "row",
    gap: 10,
  },
  tabPill: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    alignItems: "center",
    justifyContent: "center",
  },
  tabPillActive: {
    backgroundColor: navy,
    borderColor: navy,
  },
  tabText: {
    color: muted,
    fontSize: 13,
    fontWeight: "800",
  },
  tabTextActive: {
    color: white,
  },

  sectionHeader: {
    paddingHorizontal: 18,
    marginTop: 24,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: text,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  sectionSubtitle: {
    marginTop: 3,
    color: muted,
    fontSize: 13,
    fontWeight: "700",
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    alignItems: "center",
    justifyContent: "center",
  },

  ordersList: {
    paddingHorizontal: 18,
    gap: 14,
  },
  orderCard: {
    borderRadius: 28,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    shadowColor: navy,
    shadowOpacity: 0.055,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  orderTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  orderInfo: {
    flex: 1,
    paddingRight: 0,
  },
  orderId: {
    color: "#9AA6B8",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
  },
  orderTitle: {
    marginTop: 5,
    color: text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  orderBrand: {
    marginTop: 5,
    color: "#667995",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
  },

  statusBox: {
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: softCard,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusTitle: {
    color: text,
    fontSize: 17,
    fontWeight: "900",
  },
  statusText: {
    marginTop: 5,
    color: muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },

  priceBlock: {
    flex: 0.9,
    alignItems: "flex-end",
  },
  priceARS: {
    color: navy,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900",
    textAlign: "right",
  },
  priceUSD: {
    marginTop: 3,
    color: "#667995",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    textAlign: "right",
  },
  exchangeLabel: {
    marginTop: 3,
    color: "#9AA6B8",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    textAlign: "right",
  },

  progressWrap: {
    marginTop: 22,
    flexDirection: "row",
  },
  stepBlock: {
    flex: 1,
  },
  stepTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: white,
    borderWidth: 2,
    borderColor: border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleDone: {
    backgroundColor: accent,
    borderColor: accent,
  },
  stepLineWrap: {
    flex: 1,
    height: 3,
    backgroundColor: border,
  },
  stepLine: {
    height: 3,
    backgroundColor: border,
  },
  stepLineDone: {
    backgroundColor: accent,
  },
  stepLabel: {
    marginTop: 7,
    color: "#A0ABBC",
    fontSize: 10,
    fontWeight: "900",
  },
  stepLabelDone: {
    color: text,
  },

  divider: {
    height: 1,
    backgroundColor: border,
    marginTop: 14,
    marginBottom: 10,
  },
  updateLabel: {
    color: "#9AA6B8",
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  updateText: {
    marginTop: 2,
    color: muted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },

  primaryButtonFull: {
    marginTop: 18,
    height: 48,
    borderRadius: 999,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: white,
    fontSize: 14,
    fontWeight: "900",
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
  loginButton: {
    marginTop: 20,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: navy,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  loginButtonText: {
    color: white,
    fontSize: 15,
    fontWeight: "900",
  },
  emptyCard: {
    marginHorizontal: 18,
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
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 28,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    color: text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    color: muted,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "center",
  },
});