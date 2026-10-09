import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  AppState,
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
import { AppBottomNav } from "../../components/AppBottomNav";
import { ScreenHeader } from "../../components/ScreenHeader";
import { formatUSD } from "../../lib/api";
import { fetchCurrentUser, getStoredUser, ShopXUser } from "../../lib/auth";
import { listStatus, miniProgress, orderGroup, orderMilestone, storedARS } from "../../lib/order-tracking/list-model";
import { dateLabel } from "../../lib/order-tracking/view-model";
import { AppOrder, createMercadoPagoCheckout, getAppOrders } from "../../lib/orders";

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
const red = "#DC2626";
const redSoft = "#FEF2F2";

type FilterKey = "active" | "delivered" | "all";
function formatDate(value?: string) {
  return dateLabel(value) || "Sin fecha";
}

function getOrderId(order: AppOrder) {
  return order._id || order.orderNumber;
}

function getItemImage(item: any) {
  if (item?.image) return item.image;
  if (item?.imageUrl) return item.imageUrl;
  if (Array.isArray(item?.images) && item.images[0]) return item.images[0];
  if (Array.isArray(item?.imageUrls) && item.imageUrls[0]) return item.imageUrls[0];
  return null;
}

function getItemsCount(order: AppOrder) {
  if (Number(order.itemsCount || 0) > 0) return Number(order.itemsCount);

  return (order.items || []).reduce((sum: number, item: any) => {
    return sum + Number(item.quantity || item.qty || 1);
  }, 0);
}

function isDelivered(order: AppOrder) { return orderGroup(order) === "delivered"; }
function isCancelled(order: AppOrder) { return orderGroup(order) === "cancelled"; }
function isPendingPayment(order: AppOrder) { return order.status === "pending_payment" && !isCancelled(order); }
function isActive(order: AppOrder) { return orderGroup(order) === "active"; }

function getStatusMeta(order: AppOrder) {
  const status = listStatus(order);
  const colors = {
    blue: { color: navy, bg: softCard, icon: "package" },
    green: { color: green, bg: greenSoft, icon: "check-circle" },
    amber: { color: "#92400E", bg: orangeSoft, icon: "alert-circle" },
    muted: { color: muted, bg: softCard, icon: "info" },
  };
  return { ...status, ...colors[status.tone] };
}

function formatARS(value?: number) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function OrdersScreen() {
  const [user, setUser] = useState<ShopXUser | null>(null);
  const [orders, setOrders] = useState<AppOrder[]>([]);
  const [filter, setFilter] = useState<FilterKey>("active");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);

  const activeCount = useMemo(() => orders.filter(isActive).length, [orders]);
  const deliveredCount = useMemo(() => orders.filter(isDelivered).length, [orders]);

  const filteredOrders = useMemo(() => {
    const source = [...orders].sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      return bDate - aDate;
    });

    if (filter === "active") return source.filter(isActive);
    if (filter === "delivered") return source.filter(isDelivered);
    return source;
  }, [orders, filter]);

  const loadOrders = useCallback(async (options?: { silent?: boolean }) => {
    const version = ++requestVersion.current;
    if (!options?.silent) { setLoading(true); setOrders([]); }
    setError("");
    try {
      const storedUser = await getStoredUser();
      const nextUser = storedUser || (await fetchCurrentUser());
      if (version !== requestVersion.current) return;
      setUser(nextUser);
      if (!nextUser?.email) { setOrders([]); return; }
      const data = await getAppOrders({ email: nextUser.email, phone: nextUser.phone, limit: 80 });
      if (version === requestVersion.current) setOrders(data || []);
    } catch (err: any) {
      if (version === requestVersion.current) setError(err?.message || "No pudimos cargar tus pedidos.");
    } finally {
      if (version === requestVersion.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOrders();
      const refresh = () => {
        if (AppState.currentState === "active") void loadOrders({ silent: true });
      };
      const interval = setInterval(refresh, 60000);
      const subscription = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
      return () => { clearInterval(interval); subscription.remove(); requestVersion.current += 1; };
    }, [loadOrders]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadOrders({ silent: true });
  }

  async function handlePay(order: AppOrder) {
    const orderId = getOrderId(order);
    if (!orderId || payingOrderId) return;

    try {
      setPayingOrderId(orderId);
      const checkout = await createMercadoPagoCheckout({
        orderId,
        email: user?.email || order.buyer?.email,
        phone: user?.phone || order.buyer?.phone,
      });

      const url = checkout.init_point || checkout.sandbox_init_point;
      if (!url) throw new Error("Mercado Pago no devolvió un link de pago.");

      await Linking.openURL(url);
    } catch (err: any) {
      alert(err?.message || "No pudimos abrir el pago.");
    } finally {
      setPayingOrderId(null);
    }
  }

  function renderTimeline(order: AppOrder) {
    if (isPendingPayment(order) || isCancelled(order)) {
      return (
        <View style={styles.pendingTimeline}>
          <Feather name="info" size={17} color={navy} />
          <Text style={styles.pendingTimelineText}>{listStatus(order).description}</Text>
        </View>
      );
    }

    return (
      <View style={styles.timelineRow}>
        {miniProgress(order).map((step) => {
          const { done, current: active } = step;

          return (
            <View key={step.label} style={styles.timelineStep}>
              <View style={[styles.timelineDot, done && styles.timelineDotDone, active && styles.timelineDotActive]}>
                {done ? <Feather name="check" size={10} color={white} /> : null}
              </View>
              <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]} >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  function renderOrderCard(order: AppOrder) {
    const id = getOrderId(order);
    const meta = getStatusMeta(order);
    const items = Array.isArray(order.items) ? order.items : [];
    const firstItem = items[0];
    const image = getItemImage(firstItem);
    const totalARS = formatARS(storedARS(order) ?? undefined);
    const milestone = orderMilestone(order);
    const totalUSD = Number(order.totalUSD || 0);
    const count = getItemsCount(order);

    return (
      <TouchableOpacity
        key={id}
        style={styles.orderCard}
        activeOpacity={0.9}
        onPress={() => router.push({ pathname: "/order/[id]", params: { id } })}
      >
        <View style={styles.orderTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderEyebrow}>ORDEN SHOPX</Text>
            <Text style={styles.orderNumber}>#{order.orderNumber || id}</Text>
            <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
          </View>

          <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
            <Feather name={meta.icon as any} size={14} color={meta.color} />
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        <View style={styles.orderBodyRow}>
          <View style={styles.productPreview}>
            {image ? (
              <Image source={{ uri: image }} style={styles.productImage} resizeMode="contain" />
            ) : (
              <MaterialCommunityIcons name="package-variant-closed" size={36} color={navy} />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {firstItem?.title || `${count} producto${count === 1 ? "" : "s"}`}
            </Text>
            <Text style={styles.productSubtitle} numberOfLines={1}>
              {count} producto{count === 1 ? "" : "s"}
            </Text>

            <View style={styles.amountRow}>
              <Text style={styles.totalUSD}>{formatUSD(totalUSD)}</Text>
              {totalARS ? <Text style={styles.totalARS}>{totalARS}</Text> : null}
            </View>
          </View>
        </View>

        {renderTimeline(order)}

        <View style={styles.cardActionsRow}>
          {isPendingPayment(order) ? (
            <TouchableOpacity
              style={styles.payButton}
              activeOpacity={0.9}
              onPress={() => handlePay(order)}
              disabled={payingOrderId === id}
            >
              {payingOrderId === id ? (
                <ActivityIndicator color={white} />
              ) : (
                <>
                  <Feather name="credit-card" size={17} color={white} />
                  <Text style={styles.payButtonText}>Pagar ahora</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.nextStepBox}>
              <Feather name="info" size={15} color={navy} />
              <Text style={styles.nextStepText} >{milestone.label}: {milestone.value}{"\n"}{milestone.hint}</Text>
            </View>
          )}

          <View style={styles.openButton}>
            <Text style={styles.openButtonText}>{isActive(order) ? "Ver seguimiento" : "Ver detalles"}</Text>
            <Feather name="arrow-right" size={16} color={accent} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.app}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={navy} />
          <Text style={styles.loadingText}>Cargando tus pedidos...</Text>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={navy} />}
      >
        <ScreenHeader title="Mis pedidos" subtitle="De Estados Unidos hasta tu domicilio." />

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="package-variant-closed" size={28} color={white} />
          </View>
          <Text style={styles.heroEyebrow}>SHOPX TRACKING</Text>
          <Text style={styles.heroTitle}>Tus compras, claras de punta a punta.</Text>
          <Text style={styles.heroText}>
            Vemos el estado de cada pedido, el próximo paso y el historial de entrega.
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{activeCount}</Text>
              <Text style={styles.statLabel}>En curso</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{deliveredCount}</Text>
              <Text style={styles.statLabel}>Entregados</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{orders.length}</Text>
              <Text style={styles.statLabel}>Totales</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabsRow}>
          {[
            { key: "active", label: "En curso", count: activeCount },
            { key: "delivered", label: "Entregados", count: deliveredCount },
            { key: "all", label: "Todos", count: orders.length },
          ].map((tab) => {
            const active = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, active && styles.filterTabActive]}
                activeOpacity={0.9}
                onPress={() => setFilter(tab.key as FilterKey)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{tab.label}</Text>
                <View style={[styles.filterCount, active && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>{tab.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Feather name="alert-circle" size={22} color={red} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadOrders()}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!user ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="account-lock-outline" size={38} color={navy} />
            <Text style={styles.emptyTitle}>Ingresá a tu cuenta</Text>
            <Text style={styles.emptyText}>Necesitás iniciar sesión para ver tus pedidos asociados.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/profile")}>
              <Text style={styles.primaryButtonText}>Ir a mi cuenta</Text>
            </TouchableOpacity>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="package-variant" size={40} color={navy} />
            <Text style={styles.emptyTitle}>
              {filter === "active" ? "No tenés pedidos en curso" : filter === "delivered" ? "No tenés pedidos entregados" : "Todavía no tenés pedidos"}
            </Text>
            <Text style={styles.emptyText}>
              Cuando compres con ShopX, vas a ver acá el estado completo de tu orden.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/")}>
              <Text style={styles.primaryButtonText}>Ver productos</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ordersList}>{filteredOrders.map(renderOrderCard)}</View>
        )}

        <View style={{ height: 130 }} />
      </ScrollView>

      <AppBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: soft },
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 18 },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: muted, fontWeight: "800" },
  heroCard: {
    borderRadius: 32,
    backgroundColor: navy,
    padding: 24,
    marginTop: 12,
    shadowColor: navy,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  heroIcon: { width: 58, height: 58, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.13)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  heroEyebrow: { color: accent, fontSize: 12, fontWeight: "900", letterSpacing: 3 },
  heroTitle: { color: white, fontSize: 28, lineHeight: 32, fontWeight: "900", marginTop: 8 },
  heroText: { color: "rgba(255,255,255,0.78)", fontSize: 15, lineHeight: 22, fontWeight: "700", marginTop: 10 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  statCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.11)", borderRadius: 20, paddingVertical: 14, alignItems: "center" },
  statValue: { color: white, fontSize: 24, fontWeight: "900" },
  statLabel: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "800", marginTop: 2 },
  tabsRow: { flexDirection: "row", gap: 8, marginTop: 18, marginBottom: 12 },
  filterTab: { flex: 1, minHeight: 48, borderRadius: 18, borderWidth: 1, borderColor: border, backgroundColor: white, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  filterTabActive: { backgroundColor: navy, borderColor: navy },
  filterText: { color: muted, fontSize: 13, fontWeight: "900" },
  filterTextActive: { color: white },
  filterCount: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: softCard, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  filterCountActive: { backgroundColor: accent },
  filterCountText: { color: navy, fontSize: 11, fontWeight: "900" },
  filterCountTextActive: { color: navyDark },
  ordersList: { gap: 14 },
  orderCard: { backgroundColor: white, borderRadius: 30, padding: 18, borderWidth: 1, borderColor: border, shadowColor: navy, shadowOpacity: 0.055, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  orderTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  orderEyebrow: { color: "#A0AEC0", fontSize: 11, fontWeight: "900", letterSpacing: 3 },
  orderNumber: { color: text, fontSize: 22, fontWeight: "900", marginTop: 3 },
  orderDate: { color: muted, fontSize: 13, fontWeight: "700", marginTop: 2 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 170 },
  statusText: { fontSize: 12, fontWeight: "900" },
  orderBodyRow: { flexDirection: "row", gap: 14, marginTop: 18, alignItems: "center" },
  productPreview: { width: 82, height: 82, borderRadius: 22, backgroundColor: softCard, borderWidth: 1, borderColor: "#EDF2F7", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  productImage: { width: "92%", height: "92%" },
  productTitle: { color: text, fontSize: 16, lineHeight: 21, fontWeight: "900" },
  productSubtitle: { color: muted, fontSize: 12, lineHeight: 17, fontWeight: "700", marginTop: 4 },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: 9, marginTop: 9, flexWrap: "wrap" },
  totalUSD: { color: navy, fontSize: 19, fontWeight: "900" },
  totalARS: { color: muted, fontSize: 12, fontWeight: "800" },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: border },
  timelineStep: { alignItems: "center", flex: 1, gap: 5 },
  timelineDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#E6EDF5", alignItems: "center", justifyContent: "center" },
  timelineDotDone: { backgroundColor: navy },
  timelineDotActive: { borderWidth: 3, borderColor: "#BDEFF5" },
  timelineLabel: { color: muted, fontSize: 11, lineHeight: 15, textAlign: "center", fontWeight: "700" },
  timelineLabelDone: { color: navy },
  pendingTimeline: { marginTop: 16, borderTopWidth: 1, borderTopColor: border, paddingTop: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  pendingTimelineText: { color: orange, fontSize: 13, fontWeight: "800" },
  cardActionsRow: { gap: 10, marginTop: 17 },
  payButton: { minHeight: 48, borderRadius: 17, backgroundColor: navy, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  payButtonText: { color: white, fontSize: 14, fontWeight: "900" },
  nextStepBox: { paddingVertical: 12, minHeight: 48, borderRadius: 17, backgroundColor: softCard, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  nextStepText: { flex: 1, color: muted, fontSize: 12, lineHeight: 16, fontWeight: "800" },
  openButton: { minHeight: 48, borderRadius: 17, backgroundColor: "#EAFBFD", paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  openButtonText: { color: "#087F91", fontSize: 13, fontWeight: "900" },
  emptyCard: { backgroundColor: white, borderRadius: 30, padding: 26, alignItems: "center", borderWidth: 1, borderColor: border, marginTop: 8 },
  emptyTitle: { color: text, fontSize: 22, fontWeight: "900", marginTop: 14, textAlign: "center" },
  emptyText: { color: muted, fontSize: 14, lineHeight: 21, fontWeight: "700", textAlign: "center", marginTop: 8 },
  primaryButton: { marginTop: 18, minHeight: 52, borderRadius: 18, backgroundColor: navy, paddingHorizontal: 22, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: white, fontSize: 15, fontWeight: "900" },
  errorCard: { backgroundColor: redSoft, borderRadius: 22, padding: 16, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#FECACA", marginBottom: 12 },
  errorText: { flex: 1, color: red, fontSize: 13, fontWeight: "800" },
  retryButton: { borderRadius: 999, backgroundColor: white, paddingHorizontal: 12, paddingVertical: 8 },
  retryText: { color: red, fontSize: 12, fontWeight: "900" },
});
