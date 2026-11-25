import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { PriceSummary } from "../components/PriceSummary";
import { DomesticPricingDestination, formatUSD, getProductImage, getSelectedOptionsSummary } from "../lib/api";
import { getAppAccount, getStoredUser, ShopXUser } from "../lib/auth";
import { benefitAttemptKey, clearBenefitAttempt, clearPendingBenefitAttempt, getPendingBenefitAttempt, PendingBenefitAttempt, savePendingBenefitAttempt } from "../lib/benefit-attempt";
import { BenefitCheckout, CartBenefit, CartPreview, benefitCheckoutPayload, checkoutFingerprint, checkoutItems, completedBenefitCheckout, hasPricingDestination, previewCart, previewCartBenefit, submitBenefitCheckout } from "../lib/cart-pricing";
import { CartItem, clearCart, getCartItems, getProductKey, settlePurchasedItems, updateCartItemQuantity } from "../lib/cart-store";
import { buildApiUrl } from "../lib/config";
import { AppOrderBuyer, createMercadoPagoCheckout } from "../lib/orders";
import { mercadoPagoUrl, samePaymentAmount } from "../lib/payment-handoff";
import { PURCHASE_TERMS_ERROR, PURCHASE_TERMS_LABEL, PURCHASE_TERMS_URL, purchaseTermsInput } from "../lib/purchase-terms";
import { ApiError } from "../lib/request";

const navy = "#062B4F";
const border = "#E2E8F0";
const muted = "#64748B";

function moneyARS(amount: number) {
  return "AR$ " + amount.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function destinationFor(user: ShopXUser | null): DomesticPricingDestination {
  return {
    province: user?.address?.province || user?.billing?.province || "",
    city: user?.address?.city || user?.billing?.city || "",
    postalCode: user?.address?.postalCode || user?.billing?.postalCode || "",
  };
}

function buyerFor(user: ShopXUser): AppOrderBuyer {
  const address = user.address || {};
  return {
    fullName: user.fullName || user.name || "",
    email: user.email,
    phone: user.phone || "",
    dni: user.dni || user.billing?.dni || "",
    ...destinationFor(user),
    address: address.street || [address.streetName, address.streetNumber].filter(Boolean).join(" ") || user.billing?.address || "",
    streetName: address.streetName || address.street || "",
    streetNumber: address.streetNumber || "",
    floor: address.floor || "",
    apartment: address.apartment || "",
  };
}

function fieldLabel(field: string) {
  return ({ dni: "CUIT", phone: "teléfono", fullName: "nombre", streetName: "calle", streetNumber: "número", city: "localidad", province: "provincia", postalCode: "código postal" } as Record<string, string>)[field] || field;
}

function isDefinitiveBenefitRejection(error: unknown) {
  return error instanceof ApiError && [400, 409, 428].includes(error.status)
    && !["IDEMPOTENCY_CONFLICT", "ORDER_RECOVERY_PENDING"].includes(String(error.data?.code || ""));
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<CartItem[]>([]);
  const [user, setUser] = useState<ShopXUser | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [preview, setPreview] = useState<CartPreview | null>(null);
  const [benefit, setBenefit] = useState<CartBenefit | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [pricingError, setPricingError] = useState("");
  const [couponError, setCouponError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pendingBenefit, setPendingBenefit] = useState<PendingBenefitAttempt | null>(null);
  const [recoveredOrder, setRecoveredOrder] = useState("");
  const loadId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const activeCode = useRef("");
  const reviewedKey = useRef("");
  const checkoutBusy = useRef(false);
  const activeUser = useRef("");
  const mounted = useRef(true);

  async function checkoutContextIsCurrent(generation: number, email: string) {
    if (!mounted.current || generation !== loadId.current) return false;
    const currentUser = await getStoredUser();
    return mounted.current && generation === loadId.current
      && currentUser?.email.trim().toLowerCase() === email.trim().toLowerCase();
  }

  const loadCart = useCallback(async (requestedCode = activeCode.current) => {
    const id = ++loadId.current;
    controller.current?.abort();
    const aborter = new AbortController();
    controller.current = aborter;
    setLoading(true);
    setPreview(null);
    setBenefit(null);
    setPricingError("");
    setCouponError("");
    reviewedKey.current = "";
    try {
      const [storedItems, storedUser] = await Promise.all([getCartItems(), getStoredUser()]);
      if (id !== loadId.current) return;
      let cartItems = storedItems;
      setItems(cartItems);
      setUser(storedUser);
      const identity = storedUser?.email?.toLowerCase() || "";
      if (activeUser.current !== identity) {
        activeCode.current = "";
        requestedCode = "";
        setCouponInput("");
        setTermsAccepted(false);
        setPendingBenefit(null);
        setRecoveredOrder("");
        activeUser.current = identity;
      }
      if (!storedUser) {
        activeCode.current = "";
        setProfileComplete(false);
        setMissingFields([]);
        return;
      }
      const account = await getAppAccount();
      if (id !== loadId.current) return;
      const nextUser = account.user;
      setUser(nextUser);
      setProfileComplete(account.checkoutProfile.complete);
      setMissingFields(account.checkoutProfile.missingFields || []);
      const pending = await getPendingBenefitAttempt(nextUser.email);
      if (id !== loadId.current) return;
      setPendingBenefit(pending);
      if (pending) {
        // Only look up the result on focus. A new order still requires an explicit tap.
        const completed = await completedBenefitCheckout(pending.payload.idempotencyKey);
        if (id !== loadId.current) return;
        if (!completed) return;
        if (!(await checkoutContextIsCurrent(id, pending.payload.buyer.email))) return;
        cartItems = await settleBenefit(pending, completed);
        if (id !== loadId.current) return;
        setItems(cartItems);
        setPendingBenefit(null);
        setRecoveredOrder(completed.orderNumber);
        requestedCode = "";
        activeCode.current = "";
        setCouponInput("");
      }
      if (!cartItems.length) return;
      const destination = destinationFor(nextUser);
      if (!hasPricingDestination(destination)) {
        setPricingError("Completá tu provincia, localidad y código postal para calcular el envío.");
        return;
      }
      if (requestedCode) {
        try {
          const result = await previewCartBenefit(cartItems, destination, requestedCode, aborter.signal);
          if (id !== loadId.current) return;
          activeCode.current = result.benefit.code;
          setCouponInput(result.benefit.code);
          setBenefit(result);
          setPreview(result.price);
          reviewedKey.current = checkoutFingerprint(cartItems, destination, nextUser.email, result.benefit.code, buyerFor(nextUser));
          return;
        } catch (error) {
          if (id !== loadId.current) return;
          // Revalidate a code after every cart/destination change. Never retain its old discount.
          activeCode.current = "";
          setCouponError(error instanceof Error ? error.message : "No pudimos validar el cupón.");
        }
      }
      const price = await previewCart(cartItems, destination, aborter.signal);
      if (id !== loadId.current) return;
      setPreview(price);
      reviewedKey.current = checkoutFingerprint(cartItems, destination, nextUser.email, "", buyerFor(nextUser));
    } catch (error) {
      if (id !== loadId.current) return;
      setPricingError(error instanceof Error ? error.message : "No pudimos actualizar el carrito.");
    } finally {
      if (id === loadId.current) setLoading(false);
    }
  }, []);

  async function settleBenefit(attempt: PendingBenefitAttempt, result: BenefitCheckout) {
    const remaining = await settlePurchasedItems(attempt.settlementItems, result.mongoId);
    await clearPendingBenefitAttempt(attempt.payload.buyer.email, attempt.payload.idempotencyKey);
    await clearBenefitAttempt(attempt.payload.idempotencyKey);
    return remaining;
  }

  async function retryBenefit() {
    if (!pendingBenefit || checkoutBusy.current) return;
    const attempt = pendingBenefit;
    const generation = loadId.current;
    checkoutBusy.current = true;
    setCheckoutLoading(true);
    try {
      if (!(await checkoutContextIsCurrent(generation, attempt.payload.buyer.email))) return;
      const result = await submitBenefitCheckout(attempt.payload);
      if (!(await checkoutContextIsCurrent(generation, attempt.payload.buyer.email))) return;
      await settleBenefit(attempt, result);
      if (!(await checkoutContextIsCurrent(generation, attempt.payload.buyer.email))) return;
      setPendingBenefit(null);
      activeCode.current = "";
      router.replace({ pathname: "/order/[id]", params: { id: result.orderNumber } });
    } catch (error) {
      if (isDefinitiveBenefitRejection(error)) {
        await clearPendingBenefitAttempt(attempt.payload.buyer.email, attempt.payload.idempotencyKey);
        await clearBenefitAttempt(attempt.payload.idempotencyKey);
        if (await checkoutContextIsCurrent(generation, attempt.payload.buyer.email).catch(() => false)) { setPendingBenefit(null); await loadCart(attempt.payload.code); }
      }
      if (await checkoutContextIsCurrent(loadId.current, attempt.payload.buyer.email).catch(() => false)) Alert.alert("Canje", error instanceof Error ? error.message : "No pudimos confirmar el canje. Revisá tus pedidos antes de volver a intentar.");
    } finally {
      checkoutBusy.current = false;
      if (mounted.current) setCheckoutLoading(false);
    }
  }

  useFocusEffect(useCallback(() => {
    mounted.current = true;
    void loadCart();
    return () => {
      mounted.current = false;
      loadId.current += 1;
      controller.current?.abort();
    };
  }, [loadCart]));

  const changeQuantity = async (item: CartItem, quantity: number) => {
    if (loading || checkoutBusy.current || pendingBenefit) return;
    setPreview(null);
    reviewedKey.current = "";
    setLoading(true);
    try {
      await updateCartItemQuantity(item.product, quantity);
      await loadCart();
    } catch (error) {
      setLoading(false);
      Alert.alert("Cantidad", error instanceof Error ? error.message : "No pudimos actualizar la cantidad.");
      void loadCart();
    }
  };

  const emptyCart = () => {
    if (checkoutBusy.current || pendingBenefit) return;
    Alert.alert("Vaciar carrito", "¿Querés eliminar todos los productos?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Vaciar", style: "destructive", onPress: async () => {
        controller.current?.abort();
        loadId.current += 1;
        await clearCart();
        activeCode.current = "";
        setCouponInput("");
        await loadCart("");
      } },
    ]);
  };

  const applyCoupon = () => {
    if (!user) { router.push("/profile"); return; }
    const code = couponInput.trim().toUpperCase();
    if (!code) { setCouponError("Ingresá un cupón."); return; }
    void loadCart(code);
  };

  const removeCoupon = () => {
    activeCode.current = "";
    setCouponInput("");
    void loadCart("");
  };

  const checkout = async () => {
    if (checkoutBusy.current || loading || !items.length) return;
    if (!user || !profileComplete) { router.push("/profile"); return; }
    if (!preview?.checkoutEnabled || !reviewedKey.current) {
      Alert.alert("Total pendiente", pricingError || "Actualizá el total antes de pagar.");
      return;
    }
    const termsAcceptance = purchaseTermsInput(termsAccepted);
    if (!termsAcceptance) { Alert.alert("Términos de la compra", PURCHASE_TERMS_ERROR); return; }
    checkoutBusy.current = true;
    setCheckoutLoading(true);
    const generation = loadId.current;
    let createdOrder: { id: string; totalARS: number } | null = null;
    let submittedAttempt: PendingBenefitAttempt | null = null;
    try {
      const [account, currentItems] = await Promise.all([getAppAccount(), getCartItems()]);
      if (!mounted.current || generation !== loadId.current) return;
      if (!account.checkoutProfile.complete) {
        setProfileComplete(false);
        setMissingFields(account.checkoutProfile.missingFields || []);
        Alert.alert("Completá tus datos", "Revisá el CUIT y la dirección de entrega.", [
          { text: "Cerrar" }, { text: "Mi cuenta", onPress: () => router.push("/profile") },
        ]);
        return;
      }
      const currentUser = account.user;
      const destination = destinationFor(currentUser);
      const code = benefit?.benefit.code || "";
      const buyer = buyerFor(currentUser);
      const fingerprint = checkoutFingerprint(currentItems, destination, currentUser.email, code, buyer);
      if (fingerprint !== reviewedKey.current) {
        await loadCart();
        Alert.alert("Carrito actualizado", "Cambió el carrito o la dirección. Revisá el total y volvé a confirmar.");
        return;
      }
      if (benefit) {
        // A retry uses the same stored key. Neither a slow response nor a restart duplicates the canje.
        const attempt = await benefitAttemptKey(fingerprint + "|" + preview.totalARS);
        const payload = benefitCheckoutPayload({
          items: currentItems, destination, buyer, code, expectedTotalARS: preview.totalARS,
          idempotencyKey: attempt, termsAcceptance,
        });
        submittedAttempt = { payload, settlementItems: payload.items.map((item, index) => ({ ...item, cartAddedAt: currentItems[index].addedAt })) };
        await savePendingBenefitAttempt(currentUser.email, submittedAttempt);
        if (!(await checkoutContextIsCurrent(generation, currentUser.email))) return;
        setPendingBenefit(submittedAttempt);
        const result = await submitBenefitCheckout(payload);
        createdOrder = { id: result.orderNumber, totalARS: result.totalARS };
        if (!(await checkoutContextIsCurrent(generation, currentUser.email))) return;
        const remaining = await settleBenefit(submittedAttempt, result);
        if (!(await checkoutContextIsCurrent(generation, currentUser.email))) return;
        setPendingBenefit(null);
        activeCode.current = "";
        setItems(remaining);
        setBenefit(null);
        setPreview(null);
        setCouponInput("");
        if (result.bonified || !result.requiresPayment) {
          router.replace({ pathname: "/order/[id]", params: { id: result.orderNumber } });
          return;
        }
        const payment = await createMercadoPagoCheckout({ orderId: result.mongoId, expectedTotalARS: result.totalARS, termsAcceptance });
        if (!samePaymentAmount(result.totalARS, payment.totalARS)) throw new Error("Cambió el importe del pedido. Revisalo antes de pagar.");
        if (!(await checkoutContextIsCurrent(generation, currentUser.email))) return;
        router.replace({ pathname: "/order/[id]", params: { id: result.orderNumber } });
        await Linking.openURL(mercadoPagoUrl(payment));
        return;
      }
      const payment = await createMercadoPagoCheckout({
        buyer, destination, items: checkoutItems(currentItems) as any,
        expectedTotalARS: preview.totalARS, termsAcceptance,
      });
      if (!(await checkoutContextIsCurrent(generation, currentUser.email))) return;
      if (!samePaymentAmount(preview.totalARS, payment.totalARS)) {
        await loadCart();
        Alert.alert("Precio actualizado", "Revisá el nuevo total y volvé a confirmar.");
        return;
      }
      await Linking.openURL(mercadoPagoUrl(payment));
    } catch (error) {
      if (createdOrder) {
        if (!(await checkoutContextIsCurrent(generation, user.email).catch(() => false))) return;
        router.replace({ pathname: "/order/[id]", params: { id: createdOrder.id } });
        Alert.alert("Pedido creado", "Tu cupón ya se aplicó. Podés continuar el pago desde el pedido.");
      } else {
        const definitive = submittedAttempt && isDefinitiveBenefitRejection(error);
        if (definitive && submittedAttempt) {
          await clearPendingBenefitAttempt(submittedAttempt.payload.buyer.email, submittedAttempt.payload.idempotencyKey);
          await clearBenefitAttempt(submittedAttempt.payload.idempotencyKey);
          if (await checkoutContextIsCurrent(generation, submittedAttempt.payload.buyer.email).catch(() => false)) {
            setPendingBenefit(null);
            await loadCart(submittedAttempt.payload.code);
          }
        }
        if (!(await checkoutContextIsCurrent(loadId.current, user.email).catch(() => false))) return;
        const changed = error instanceof ApiError && error.data?.code === "CART_PRICE_CHANGED";
        if (changed && !definitive) await loadCart();
        Alert.alert(changed ? "Precio actualizado" : "No pudimos continuar", error instanceof Error ? error.message : "Volvé a intentar.");
      }
    } finally {
      checkoutBusy.current = false;
      if (mounted.current) setCheckoutLoading(false);
    }
  };

  const destination = destinationFor(user);
  const disabled = checkoutLoading || loading || Boolean(pendingBenefit);
  const total = preview?.totalARS;
  const fullyCovered = Boolean(benefit && preview?.totalUSD === 0 && total === 0);
  const paymentLabel = !user ? "Iniciar sesión" : !profileComplete ? "Completar mis datos"
    : fullyCovered ? "Confirmar canje" : benefit ? "Pagar diferencia con Mercado Pago" : "Pagar con Mercado Pago";
  const canContinue = !disabled && (!user || !profileComplete || Boolean(preview?.checkoutEnabled));

  return (
    <View style={s.app}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.shell}>
          <View style={s.topBar}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver" style={s.iconButton} onPress={() => router.back()}><Feather name="chevron-left" size={24} color={navy} /></TouchableOpacity>
            <Text accessibilityRole="header" style={s.heading}>Carrito</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Vaciar carrito" style={s.iconButton} disabled={disabled || !items.length} onPress={emptyCart}><Feather name="trash-2" size={19} color={navy} /></TouchableOpacity>
          </View>

          {recoveredOrder ? <TouchableOpacity accessibilityRole="button" style={s.address} onPress={() => router.push({ pathname: "/order/[id]", params: { id: recoveredOrder } })}>
            <Feather name="check-circle" size={22} color="#087C59" /><View style={{ flex: 1 }}><Text style={s.cardTitle}>Canje confirmado</Text><Text style={s.addressText}>Ver pedido {recoveredOrder}</Text></View><Feather name="chevron-right" size={20} color={navy} />
          </TouchableOpacity> : null}
          {pendingBenefit ? <View style={s.summary}>
            <Text style={s.cardTitle}>Canje pendiente de confirmación</Text>
            <Text style={s.addressText}>Cupón {pendingBenefit.payload.code} · {moneyARS(pendingBenefit.payload.expectedTotalARS)}</Text>
            <Text style={s.addressText}>{pendingBenefit.payload.buyer.address} · {pendingBenefit.payload.destination.city}</Text>
            <TouchableOpacity accessibilityRole="button" disabled={checkoutLoading || loading} style={s.primaryButton} onPress={() => { void retryBenefit(); }}>
              {checkoutLoading ? <ActivityIndicator color="white" /> : <Text style={s.primaryText}>Reintentar canje</Text>}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => router.push("/orders")}><Text style={s.link}>Ver mis pedidos</Text></TouchableOpacity>
          </View> : null}

          {loading && !items.length ? <View style={s.empty}><ActivityIndicator color={navy} /><Text style={s.muted}>Cargando carrito…</Text></View>
            : !items.length ? <View style={s.empty}>
              <Feather name="shopping-cart" size={42} color={navy} />
              <Text style={s.emptyTitle}>Tu carrito está vacío</Text>
              <TouchableOpacity accessibilityRole="button" style={s.primaryButton} onPress={() => router.push("/")}><Text style={s.primaryText}>Ver productos</Text></TouchableOpacity>
            </View> : <>
              <View style={s.items}>
                {items.map((item, index) => {
                  const image = getProductImage(item.product);
                  const confirmed = preview?.items?.[index];
                  const price = Number(confirmed?.priceUSD) * Number(item.quantity);
                  return <View key={getProductKey(item.product)} style={s.item}>
                    <View style={s.imageWrap}>{image ? <Image source={{ uri: image }} style={s.productImage} resizeMode="contain" /> : <MaterialCommunityIcons name="package-variant" size={36} color={muted} />}</View>
                    <View style={s.itemInfo}>
                      <Text style={s.brand} numberOfLines={1}>{item.product.brand || item.product.store || "ShopX"}</Text>
                      <Text style={s.productTitle} numberOfLines={3}>{item.product.title}</Text>
                      {getSelectedOptionsSummary(item.product).map(option => <Text key={option} style={s.option}>{option}</Text>)}
                      <View style={s.itemBottom}>
                        <View><Text style={s.priceLabel}>Precio USA</Text><Text style={s.price}>{Number.isFinite(price) && price > 0 ? "USD " + formatUSD(price) : "A confirmar"}</Text></View>
                        <View style={s.quantity}>
                          <TouchableOpacity accessibilityRole="button" accessibilityLabel={"Quitar una unidad de " + item.product.title} disabled={disabled} onPress={() => { void changeQuantity(item, item.quantity - 1); }} style={s.quantityButton}><Feather name={item.quantity === 1 ? "trash-2" : "minus"} size={15} color={navy} /></TouchableOpacity>
                          <Text style={s.quantityText}>{item.quantity}</Text>
                          <TouchableOpacity accessibilityRole="button" accessibilityLabel={"Agregar una unidad de " + item.product.title} disabled={disabled || item.quantity >= 3} onPress={() => { void changeQuantity(item, item.quantity + 1); }} style={[s.quantityButton, item.quantity >= 3 && s.disabled]}><Feather name="plus" size={15} color={navy} /></TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>;
                })}
              </View>

              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Editar dirección de entrega" style={s.address} disabled={checkoutLoading} onPress={() => router.push("/profile")}>
                <Feather name="map-pin" size={22} color={navy} />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Enviar a</Text>
                  <Text style={s.addressText}>{[user?.address?.street || [user?.address?.streetName, user?.address?.streetNumber].filter(Boolean).join(" "), destination.city, destination.province, destination.postalCode].filter(Boolean).join(" · ") || "Completá tu dirección de entrega"}</Text>
                </View>
                <Feather name="chevron-right" size={20} color={navy} />
              </TouchableOpacity>
              {user && !profileComplete && missingFields.length > 0 ? <Text style={s.warning}>Completá: {missingFields.map(fieldLabel).join(", ")}.</Text> : null}

              {!pendingBenefit ? <View style={s.summary}>
                <Text accessibilityRole="header" style={s.summaryTitle}>Resumen</Text>
                {loading ? <View style={s.status}><ActivityIndicator color={navy} /><Text style={s.muted}>Actualizando total…</Text></View>
                  : preview ? <PriceSummary rows={preview.pricingBreakdown} /> : <View style={s.status}>
                    <Text style={s.warning}>{pricingError || (!user ? "Iniciá sesión para confirmar tu total." : "Completá tu dirección para calcular el envío.")}</Text>
                    {user && hasPricingDestination(destination) ? <TouchableOpacity accessibilityRole="button" onPress={() => { void loadCart(); }}><Text style={s.link}>Volver a calcular</Text></TouchableOpacity> : null}
                  </View>}

                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Total a pagar</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={s.total}>{preview ? moneyARS(preview.totalARS) : "A confirmar"}</Text>
                    {preview ? <Text style={s.totalUSD}>USD {formatUSD(preview.totalUSD)}</Text> : null}
                  </View>
                </View>

                <View style={s.couponRow}>
                  <TextInput accessibilityLabel="Ingresar cupón" placeholder="Ingresar cupón" placeholderTextColor={muted} value={couponInput}
                    autoCapitalize="characters" autoCorrect={false} maxLength={80} editable={!disabled && !benefit}
                    onChangeText={value => { setCouponInput(value.toUpperCase()); setCouponError(""); }} style={s.couponInput}
                    returnKeyType="done" onSubmitEditing={applyCoupon} />
                  <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={benefit ? removeCoupon : applyCoupon} style={[s.couponButton, disabled && s.disabled]}>
                    <Text style={s.couponButtonText}>{benefit ? "Quitar" : "Aplicar"}</Text>
                  </TouchableOpacity>
                </View>
                {!!couponError && <Text accessibilityRole="alert" style={s.error}>{couponError}</Text>}
                {benefit ? <Text style={s.couponApplied}>{fullyCovered ? "Canje total · Sin cargo" : "Cupón " + benefit.benefit.code + " aplicado"}</Text> : null}

                {user && profileComplete ? <View style={s.terms}>
                  <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: termsAccepted, disabled }} accessibilityLabel={PURCHASE_TERMS_LABEL}
                    disabled={disabled} onPress={() => setTermsAccepted(value => !value)} style={s.termsCheck}>
                    <Feather name={termsAccepted ? "check-square" : "square"} size={23} color={navy} />
                    <Text style={s.termsText}>{PURCHASE_TERMS_LABEL}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="link" accessibilityLabel="Leer Términos y Condiciones" onPress={() => { void Linking.openURL(buildApiUrl(PURCHASE_TERMS_URL)).catch(() => Alert.alert("Términos", "No pudimos abrir los términos. Volvé a intentar.")); }}><Text style={s.termsLink}>Leer términos</Text></TouchableOpacity>
                </View> : null}

                <TouchableOpacity accessibilityRole="button" accessibilityLabel={paymentLabel} disabled={!canContinue} onPress={() => { void checkout(); }}
                  style={[s.payButton, fullyCovered && s.redeemButton, !canContinue && s.disabled]}>
                  {checkoutLoading ? <ActivityIndicator color="white" /> : <>
                    {user && profileComplete && !fullyCovered ? <MaterialCommunityIcons name="handshake-outline" size={25} color="white" /> : null}
                    <Text style={s.payButtonText}>{paymentLabel}</Text>
                  </>}
                </TouchableOpacity>
              </View> : null}
            </>}
        </View>
      </ScrollView>
      <AppBottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#F6F8FB" },
  shell: { width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 18, gap: 16 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 4 },
  heading: { fontSize: 23, color: navy, fontWeight: "800" },
  iconButton: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, borderColor: border, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", gap: 20, paddingVertical: 70, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 23, color: navy, fontWeight: "800" },
  muted: { color: muted, fontSize: 14 },
  primaryButton: { paddingHorizontal: 30, paddingVertical: 15, borderRadius: 16, backgroundColor: navy },
  primaryText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  items: { gap: 12 },
  item: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 22, backgroundColor: "#FFF", borderWidth: 1, borderColor: border },
  imageWrap: { width: 92, height: 114, borderRadius: 14, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  productImage: { width: "100%", height: "100%" },
  itemInfo: { flex: 1, gap: 5 },
  brand: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: muted, fontWeight: "700" },
  productTitle: { fontSize: 14, lineHeight: 19, color: navy, fontWeight: "700" },
  option: { fontSize: 11, color: muted },
  itemBottom: { gap: 8, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 7, flexWrap: "wrap" },
  priceLabel: { fontSize: 10, color: muted },
  price: { fontSize: 15, color: navy, fontWeight: "800", marginTop: 3 },
  quantity: { flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 11 },
  quantityButton: { width: 32, height: 34, alignItems: "center", justifyContent: "center" },
  quantityText: { minWidth: 22, textAlign: "center", fontWeight: "700", color: navy, fontSize: 13 },
  address: { flexDirection: "row", gap: 12, alignItems: "center", padding: 17, backgroundColor: "#EAF5F8", borderRadius: 20 },
  cardTitle: { fontSize: 14, color: navy, fontWeight: "800", marginBottom: 4 },
  addressText: { color: "#53677D", fontSize: 12, lineHeight: 18 },
  warning: { color: "#966000", fontSize: 13, lineHeight: 19 },
  summary: { backgroundColor: "#FFF", borderWidth: 1, borderColor: border, borderRadius: 24, padding: 20, gap: 20 },
  summaryTitle: { fontSize: 21, color: navy, fontWeight: "800" },
  status: { gap: 12, paddingVertical: 10 },
  link: { color: "#087C91", fontWeight: "700", fontSize: 14 },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderTopWidth: 1, borderColor: border, paddingTop: 18 },
  totalLabel: { fontSize: 15, fontWeight: "700", color: navy },
  total: { fontSize: 24, fontWeight: "900", color: navy },
  totalUSD: { fontSize: 13, color: muted, marginTop: 3 },
  couponRow: { flexDirection: "row", gap: 8 },
  couponInput: { flex: 1, minWidth: 0, height: 46, borderWidth: 1, borderColor: border, borderRadius: 12, paddingHorizontal: 12, color: navy, fontSize: 14 },
  couponButton: { height: 46, paddingHorizontal: 15, borderRadius: 12, backgroundColor: "#EDF5F8", justifyContent: "center" },
  couponButtonText: { color: navy, fontWeight: "700", fontSize: 13 },
  couponApplied: { fontSize: 13, color: "#087C59", fontWeight: "700", marginTop: -10 },
  error: { color: "#B91C1C", fontSize: 13, lineHeight: 18, marginTop: -8 },
  terms: { gap: 8 },
  termsCheck: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  termsText: { flex: 1, color: "#53677D", fontSize: 12, lineHeight: 18 },
  termsLink: { color: "#087C91", fontSize: 12, fontWeight: "700", marginLeft: 32 },
  payButton: { backgroundColor: "#009EE3", minHeight: 56, borderRadius: 16, padding: 14, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  payButtonText: { color: "#FFF", fontSize: 15, textAlign: "center", fontWeight: "800", flexShrink: 1 },
  redeemButton: { backgroundColor: navy },
  disabled: { opacity: 0.48 },
});
