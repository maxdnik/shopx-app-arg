import { OrderShipments } from "../../components/OrderShipments";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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

type OrderStatus =
  | "pending_payment"
  | "purchased"
  | "miami"
  | "traveling"
  | "argentina"
  | "delivered"
  | "cancelled";

const steps: { key: OrderStatus; label: string; icon: string }[] = [
  { key: "purchased", label: "Comprado", icon: "check" },
  { key: "miami", label: "Miami", icon: "home" },
  { key: "traveling", label: "En viaje", icon: "navigation" },
  { key: "argentina", label: "Argentina", icon: "map-pin" },
  { key: "delivered", label: "Entregado", icon: "package" },
];

function normalizeStep(step?: string): OrderStatus | null {
  const clean = String(step || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

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

  if (clean === "traveling" || clean === "in_transit") {
    return "traveling";
  }

  if (
    clean === "shipped" ||
    clean === "argentina" ||
    clean === "customs" ||
    clean === "local_delivery" ||
    clean === "despachado" ||
    clean === "enviado" ||
    clean === "enviado correo local"
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

function getVisualStatus(order: AppOrder): OrderStatus {
  const status = String(order.status || "").toLowerCase();
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();

  if (status === "delivered") return "delivered";

  if (status === "shipped") {
    return "argentina";
  }

  const trackingStep = normalizeStep(order.tracking?.currentStep);

  if (
    trackingStep &&
    trackingStep !== "pending_payment" &&
    trackingStep !== "cancelled"
  ) {
    return trackingStep;
  }

  if (
    status === "argentina" ||
    status === "customs" ||
    status === "local_delivery"
  ) {
    return "argentina";
  }

  if (status === "in_transit" || status === "traveling") {
    return "traveling";
  }

  if (
    status === "miami" ||
    status === "warehouse" ||
    status === "in_miami_warehouse"
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

function getStatusLabel(order: AppOrder) {
  const status = String(order.status || "").toLowerCase();
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();

  if (status === "shipped") {
    return "En Argentina";
  }

  if (order.tracking?.currentLabel) {
    return order.tracking.currentLabel;
  }

  if (isCancelled(order)) return "Cancelado";
  if (isDelivered(order)) return "Entregado";

  if (paymentStatus === "approved" || status === "paid") {
    return "Compra confirmada";
  }

  if (status === "processing") return "Compra en proceso";

  if (
    status === "in_miami_warehouse" ||
    status === "miami" ||
    status === "warehouse"
  ) {
    return "Recibido en Miami";
  }

  if (status === "in_transit" || status === "traveling") {
    return "En viaje a Argentina";
  }

  if (status === "argentina" || status === "customs") {
    return "En Argentina";
  }

  if (isPendingPayment(order)) return "Pago pendiente";

  return "Pedido creado";
}

function getStatusDescription(order: AppOrder) {
  const status = String(order.status || "").toLowerCase();

  if (status === "shipped") {
    return "El pedido ya está en Argentina y se encuentra en proceso de distribución. Próximamente será entregado.";
  }

  if (order.tracking?.currentDescription) {
    return order.tracking.currentDescription;
  }

  if (isCancelled(order)) return "Este pedido fue cancelado.";
  if (isDelivered(order)) return "Pedido entregado correctamente.";

  if (isPendingPayment(order)) {
    return "Tu pedido está pendiente de pago con Mercado Pago.";
  }

  if (
    status === "in_miami_warehouse" ||
    status === "miami" ||
    status === "warehouse"
  ) {
    return "El producto fue recibido en Miami y está siendo preparado para consolidación.";
  }

  if (status === "in_transit" || status === "traveling") {
    return "Tu compra está viajando hacia Argentina.";
  }

  if (status === "argentina" || status === "customs") {
    return "Tu pedido está en proceso de ingreso y distribución local.";
  }

  return "ShopX está gestionando tu pedido y actualizando el seguimiento.";
}

function getStatusStyle(order: AppOrder) {
  if (isDelivered(order)) {
    return {
      bg: greenSoft,
      color: green,
      label: "ENTREGADO",
    };
  }

  if (isCancelled(order)) {
    return {
      bg: redSoft,
      color: red,
      label: "CANCELADO",
    };
  }

  if (isPendingPayment(order)) {
    return {
      bg: orangeSoft,
      color: orange,
      label: "PENDIENTE",
    };
  }

  return {
    bg: greenSoft,
    color: green,
    label: "ACTIVO",
  };
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

function getNextStepContent(order: AppOrder) {
  const visualStatus = getVisualStatus(order);

  if (isCancelled(order)) {
    return {
      icon: "alert-circle-outline",
      title: "Pedido cancelado",
      text: "Este pedido figura cancelado. Si creés que es un error, podés consultar con soporte.",
    };
  }

  if (isPendingPayment(order)) {
    return {
      icon: "credit-card-outline",
      title: "Próximo paso: completar el pago",
      text: "Apenas se confirme el pago, ShopX avanza con la gestión de compra y seguimiento.",
    };
  }

  if (visualStatus === "purchased") {
    return {
      icon: "shopping-outline",
      title: "Próximo paso: recepción en Miami",
      text: "Estamos gestionando la compra en USA. Te avisamos cuando llegue a nuestro depósito en Miami.",
    };
  }

  if (visualStatus === "miami") {
    return {
      icon: "warehouse",
      title: "Próximo paso: salida a Argentina",
      text: "Tu producto está en Miami. Estamos preparando la consolidación y el envío internacional.",
    };
  }

  if (visualStatus === "traveling") {
    return {
      icon: "airplane",
      title: "Próximo paso: ingreso a Argentina",
      text: "Tu pedido está viajando. Te vamos a avisar cuando entre al circuito local.",
    };
  }

  if (visualStatus === "argentina") {
    return {
      icon: "truck-delivery-outline",
      title: "Próximo paso: entrega local",
      text: "Tu pedido ya está en Argentina y avanza hacia la entrega puerta a puerta.",
    };
  }

  if (visualStatus === "delivered") {
    return {
      icon: "check-decagram-outline",
      title: "Pedido entregado",
      text: "Tu compra fue entregada. Gracias por confiar en ShopX.",
    };
  }

  return {
    icon: "progress-clock",
    title: "Seguimiento activo",
    text: "ShopX está actualizando el estado del pedido hasta la entrega.",
  };
}

function getPrimaryAction(order: AppOrder) {
  if (isPendingPayment(order)) {
    return "Pagar ahora";
  }

  if (isDelivered(order)) {
    return "Ver productos";
  }

  return "Actualizar pedido";
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
                style={[styles.stepCircle, completed && styles.stepCircleDone]}
              >
                <Feather
                  name={completed ? "check" : (step.icon as any)}
                  size={completed ? 16 : 15}
                  color={completed ? white : "#AAB6C8"}
                />
              </View>

              {!isLast ? (
                <View style={styles.stepLineWrap}>
                  <View
                    style={[
                      styles.stepLine,
                      index < currentIndex && styles.stepLineDone,
                    ]}
                  />
                </View>
              ) : null}
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

export default function OrderDetailScreen() {
  const { id, payment } = useLocalSearchParams<{
    id: string;
    payment?: string;
  }>();

  const [user, setUser] = useState<ShopXUser | null>(null);
  const [order, setOrder] = useState<AppOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingAfterPayment, setRefreshingAfterPayment] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const paymentBanner = getPaymentReturnBanner(payment);

  async function loadOrder(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setLoading(true);
    }

    const orderId = String(id || "");

    if (!orderId) {
      setLoading(false);
      return;
    }

    const storedUser = await getStoredUser();
    const freshUser = storedUser || (await fetchCurrentUser());

    if (!freshUser) {
      setUser(null);
      setOrder(null);
      setLoading(false);
      setRefreshingAfterPayment(false);
      return;
    }

    setUser(freshUser);

    try {
      const data = await getAppOrderById({
        orderId,
        email: freshUser.email,
        phone: freshUser.phone,
      });

      setOrder(data);
    } catch (error: any) {
      console.log("ERROR ORDER DETAIL:", error);

      if (!options?.silent) {
        Alert.alert(
          "No pudimos cargar el pedido",
          error?.message || "Intentá nuevamente.",
        );
      }
    } finally {
      setLoading(false);
      setRefreshingAfterPayment(false);
    }
  }

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
      loadOrder();
    }, [id]),
  );

  useEffect(() => {
    if (!payment) return;

    setRefreshingAfterPayment(true);

    const timerOne = setTimeout(() => {
      loadOrder({ silent: true });
    }, 1800);

    const timerTwo = setTimeout(() => {
      loadOrder({ silent: true });
    }, 4500);

    return () => {
      clearTimeout(timerOne);
      clearTimeout(timerTwo);
    };
  }, [payment, id]);

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
              No pudimos encontrar este pedido o no está asociado a tu cuenta.
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
  const visualStatus = getVisualStatus(order);
  const trackingHistory = Array.isArray(order.tracking?.history)
    ? order.tracking.history
    : [];
  const totalARS = getOrderTotalARS(order);
  const nextStep = getNextStepContent(order);

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

        <View style={styles.progressCard}>
          <Text style={styles.sectionTitle}>Seguimiento</Text>
          <Text style={styles.sectionSubtitle}>
            Estado actualizado por ShopX desde compra hasta entrega.
          </Text>

          <OrderProgress status={visualStatus} />
        </View>

        <View style={styles.nextStepCard}>
          <View style={styles.nextStepIcon}>
            <MaterialCommunityIcons
              name={nextStep.icon as any}
              size={27}
              color={navy}
            />
          </View>

          <View style={styles.nextStepContent}>
            <Text style={styles.nextStepTitle}>{nextStep.title}</Text>
            <Text style={styles.nextStepText}>{nextStep.text}</Text>
          </View>

          <TouchableOpacity
            style={styles.nextStepButton}
            activeOpacity={0.88}
            onPress={() => {
              if (isPendingPayment(order)) {
                handlePayPendingOrder();
                return;
              }

              if (isDelivered(order)) {
                router.push("/");
                return;
              }

              loadOrder({ silent: true });
            }}
            disabled={checkoutLoading}
          >
            <Text style={styles.nextStepButtonText}>
              {getPrimaryAction(order)}
            </Text>
          </TouchableOpacity>
        </View>

        {trackingHistory.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Historial de tracking</Text>

            <View style={styles.timelineList}>
              {trackingHistory
                .slice()
                .reverse()
                .map((event: any, index: number) => (
                  <View
                    key={`${event.step}-${event.date}-${index}`}
                    style={styles.timelineItem}
                  >
                    <View style={styles.timelineDot} />

                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineLabel}>
                        {event.label || "Actualización ShopX"}
                      </Text>
                      <Text style={styles.timelineDescription}>
                        {event.description || "Seguimiento actualizado."}
                      </Text>
                      <Text style={styles.timelineDate}>
                        {formatDate(event.date)}
                      </Text>
                    </View>
                  </View>
                ))}
            </View>
          </View>
        ) : null}

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
                {totalARS > 0
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
              {order.buyer?.city || "A confirmar"}
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
        <OrderShipments order={order} />
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
    height: 32,
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
  heroMetaSubValue: {
    marginTop: 2,
    color: "rgba(255,255,255,0.62)",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
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

  nextStepCard: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 28,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  nextStepIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
  },
  nextStepContent: {
    flex: 1,
  },
  nextStepTitle: {
    color: text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
  },
  nextStepText: {
    marginTop: 3,
    color: muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  nextStepButton: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: navy,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  nextStepButtonText: {
    color: white,
    fontSize: 12,
    fontWeight: "900",
  },

  progressCard: {
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
  sectionTitle: {
    color: text,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    marginTop: 4,
    color: muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
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

  timelineList: {
    marginTop: 16,
    gap: 14,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
  },
  timelineDot: {
    marginTop: 5,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: accent,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    color: text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
  },
  timelineDescription: {
    marginTop: 3,
    color: muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  timelineDate: {
    marginTop: 4,
    color: "#9AA6B8",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 0.6,
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
  breakdownAmountBlock: {
    flex: 1.05,
    alignItems: "flex-end",
  },
  breakdownAmount: {
    color: text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    textAlign: "right",
  },
  breakdownAmountUSD: {
    marginTop: 2,
    color: "#9AA6B8",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
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
