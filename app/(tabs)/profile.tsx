import { router, useFocusEffect } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as WebBrowser from "expo-web-browser";
import { AppBottomNav } from "../../components/AppBottomNav";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useFavorites } from "../../hooks/useFavorites";
import { AppOrder, getAppOrders } from "../../lib/orders";
import {
  GOOGLE_AUTH_CONFIG,
  getGoogleAuthConfigError,
} from "../../lib/google-auth-config";
import {
  CheckoutProfile,
  fetchCurrentUser,
  getAppAccount,
  getStoredUser,
  loginApp,
  loginWithGoogleApp,
  loginWithAppleApp,
  logoutApp,
  deleteAppAccount,
  registerApp,
  ShopXUser,
  updateAppAccount,
  forgotPasswordApp,
} from "../../lib/auth";
import { registerForPushNotificationsAsync } from "../../lib/push-notifications";

WebBrowser.maybeCompleteAuthSession();

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

type AuthMode = "login" | "register";

type MenuItem = {
  title: string;
  subtitle: string;
  icon: string;
  action?: () => void;
};

const provinces = [
  "CABA",
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

function getDisplayName(user: ShopXUser | null) {
  if (!user) return "Maxi";
  return user.fullName || user.name || user.email || "Usuario ShopX";
}

function getInitial(user: ShopXUser | null) {
  return getDisplayName(user).slice(0, 1).toUpperCase();
}

function getMissingLabel(field: string) {
  const labels: Record<string, string> = {
    phone: "Teléfono",
    dni: "DNI / CUIT",
    streetName: "Calle",
    streetNumber: "Número",
    city: "Ciudad",
    province: "Provincia",
    postalCode: "Código postal",
  };

  return labels[field] || field;
}


function normalizeOrderStatus(order: AppOrder) {
  const status = String(order.status || "").toLowerCase();
  const paymentStatus = String(order.paymentStatus || "").toLowerCase();
  const trackingStep = String(order.tracking?.currentStep || "").toLowerCase();

  if (trackingStep === "delivered" || status === "delivered") return "delivered";

  if (
    trackingStep === "cancelled" ||
    trackingStep === "canceled" ||
    status === "cancelled" ||
    status === "canceled" ||
    paymentStatus === "rejected" ||
    paymentStatus === "cancelled"
  ) {
    return "cancelled";
  }

  return "active";
}

function getOrderStats(orders: AppOrder[]) {
  return orders.reduce(
    (acc, order) => {
      const status = normalizeOrderStatus(order);

      acc.total += 1;

      if (status === "delivered") acc.delivered += 1;
      if (status === "active") acc.active += 1;

      return acc;
    },
    { total: 0, active: 0, delivered: 0 }
  );
}

function StatCard({
  value,
  label,
  icon,
  onPress,
}: {
  value: string;
  label: string;
  icon: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.statCard}
      activeOpacity={onPress ? 0.88 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.statIcon}>
        <MaterialCommunityIcons name={icon as any} size={20} color={navy} />
      </View>

      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function MenuRow({ item }: { item: MenuItem }) {
  return (
    <TouchableOpacity
      style={styles.menuRow}
      activeOpacity={0.88}
      onPress={item.action}
    >
      <View style={styles.menuIcon}>
        <MaterialCommunityIcons name={item.icon as any} size={23} color={navy} />
      </View>

      <View style={styles.menuTextBlock}>
        <Text style={styles.menuTitle}>{item.title}</Text>
        <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
      </View>

      <Feather name="chevron-right" size={22} color="#9AA6B8" />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const scrollRef = useRef<ScrollView | null>(null);
  const { favoritesCount } = useFavorites();

  const [user, setUser] = useState<ShopXUser | null>(null);
  const [checkoutProfile, setCheckoutProfile] =
    useState<CheckoutProfile | null>(null);
  const [profileOrders, setProfileOrders] = useState<AppOrder[]>([]);
  const [loadingOrdersSummary, setLoadingOrdersSummary] = useState(false);

  const [loadingSession, setLoadingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editCheckoutData, setEditCheckoutData] = useState(false);
  const [checkoutCardY, setCheckoutCardY] = useState(0);

  const [mode, setMode] = useState<AuthMode>("login");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [formFullName, setFormFullName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formDni, setFormDni] = useState("");
  const [formStreetName, setFormStreetName] = useState("");
  const [formStreetNumber, setFormStreetNumber] = useState("");
  const [formFloor, setFormFloor] = useState("");
  const [formApartment, setFormApartment] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formProvince, setFormProvince] = useState("");
  const [formPostalCode, setFormPostalCode] = useState("");

  useEffect(() => {
    const configError = getGoogleAuthConfigError();

    if (configError) {
      console.log("GOOGLE AUTH CONFIG ERROR:", configError);
      return;
    }

    const googleSignInConfig: Parameters<typeof GoogleSignin.configure>[0] = {
      offlineAccess: false,
      scopes: ["profile", "email"],
    };

    if (Platform.OS === "ios") {
      googleSignInConfig.iosClientId = GOOGLE_AUTH_CONFIG.iosClientId;
    } else {
      googleSignInConfig.webClientId = GOOGLE_AUTH_CONFIG.webClientId;
    }

    GoogleSignin.configure(googleSignInConfig);
  }, []);

  function hydrateForm(nextUser: ShopXUser | null) {
    if (!nextUser) return;

    setFormFullName(nextUser.fullName || nextUser.name || "");
    setFormPhone(nextUser.phone || "");
    setFormDni(nextUser.dni || nextUser.billing?.dni || "");
    setFormStreetName(
      nextUser.address?.streetName || nextUser.address?.street || ""
    );
    setFormStreetNumber(nextUser.address?.streetNumber || "");
    setFormFloor(nextUser.address?.floor || "");
    setFormApartment(nextUser.address?.apartment || "");
    setFormCity(nextUser.address?.city || nextUser.billing?.city || "");
    setFormProvince(
      nextUser.address?.province || nextUser.billing?.province || ""
    );
    setFormPostalCode(
      nextUser.address?.postalCode || nextUser.billing?.postalCode || ""
    );
  }

  async function hydrateAccountAfterAuth(nextUser: ShopXUser) {
    setUser(nextUser);
    hydrateForm(nextUser);

    try {
      const account = await getAppAccount();
      setUser(account.user);
      setCheckoutProfile(account.checkoutProfile);
      hydrateForm(account.user);
      await loadProfileOrders(account.user);
    } catch {
      // Login succeeded; account endpoint can be retried later.
    }

    try {
      await registerForPushNotificationsAsync({ requestPermissions: false });
    } catch (error) {
      console.log("ERROR REGISTER PUSH AFTER AUTH:", error);
    }
  }


  async function loadProfileOrders(nextUser?: ShopXUser | null) {
    const targetUser = nextUser || user;

    if (!targetUser?.email) {
      setProfileOrders([]);
      return;
    }

    try {
      setLoadingOrdersSummary(true);
      const orders = await getAppOrders({
        email: targetUser.email,
        phone: targetUser.phone,
        limit: 80,
      });
      setProfileOrders(orders || []);
    } catch {
      setProfileOrders([]);
    } finally {
      setLoadingOrdersSummary(false);
    }
  }

  async function handleForgotPassword() {
    const email = loginEmail.trim();

    if (!email) {
      Alert.alert(
        "Ingresá tu email",
        "Escribí el email de tu cuenta y después tocá ‘Olvidé mi contraseña’."
      );
      return;
    }

    try {
      setSubmitting(true);
      await forgotPasswordApp(email);
      Alert.alert(
        "Revisá tu email",
        "Si existe una cuenta ShopX con ese email, te enviamos un link para restablecer tu contraseña."
      );
    } catch (error: any) {
      Alert.alert(
        "No pudimos enviar el email",
        error?.message || "Intentá nuevamente en unos minutos."
      );
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  function scrollToCheckoutCard() {
    setEditCheckoutData(true);

    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(checkoutCardY - 20, 0),
        animated: true,
      });
    }, 120);
  }

  function handleOpenMyData() {
    scrollToCheckoutCard();
  }

  function handleOpenDeliveryAddress() {
    scrollToCheckoutCard();
  }

  function handleOpenPaymentMethods() {
    Alert.alert(
      "Métodos de pago",
      "Por ahora los pagos se procesan de forma segura mediante Mercado Pago. ShopX no guarda tarjetas ni datos financieros en la app."
    );
  }

  async function handleOpenTerms() {
    const url = "https://www.shopx-ar.com/terminos";

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        throw new Error("No se pudo abrir el enlace.");
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Términos y condiciones",
        "No pudimos abrir el enlace. Podés consultarlos desde la web de ShopX."
      );
    }
  }

  function handleOpenWhatsapp() {
    Linking.openURL("https://wa.me/541162661076");
  }

  async function handleAppleLogin() {
    if (appleLoading || googleLoading || submitting) return;

    try {
      setAppleLoading(true);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("Apple no devolvió un token de identidad.");
      }

      const fullName = [
        credential.fullName?.givenName,
        credential.fullName?.middleName,
        credential.fullName?.familyName,
      ]
        .filter(Boolean)
        .join(" ");

      const loggedUser = await loginWithAppleApp({
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
        email: credential.email,
        fullName,
      });

      await hydrateAccountAfterAuth(loggedUser);

      Alert.alert("Sesión iniciada", "Ya podés comprar con tu cuenta ShopX.");
    } catch (error: any) {
      if (error?.code === "ERR_REQUEST_CANCELED") return;

      Alert.alert(
        "No pudimos iniciar sesión con Apple",
        error?.message || "Intentá nuevamente."
      );
    } finally {
      setAppleLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (googleLoading || appleLoading || submitting) return;

    const configError = getGoogleAuthConfigError();

    if (configError) {
      Alert.alert("Google no está configurado", configError);
      return;
    }

    try {
      setGoogleLoading(true);

      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      await GoogleSignin.signOut().catch(() => undefined);
      const response = await GoogleSignin.signIn();

      if (isCancelledResponse(response)) {
        return;
      }

      if (!isSuccessResponse(response)) {
        throw new Error("Google no devolvió una sesión válida.");
      }

      const idToken = response.data.idToken;

      if (!idToken) {
        throw new Error("Google no devolvió el token de sesión.");
      }

      const loggedUser = await loginWithGoogleApp({ idToken });
      await hydrateAccountAfterAuth(loggedUser);

      Alert.alert("Sesión iniciada", "Ya podés comprar con tu cuenta ShopX.");
    } catch (error: any) {
      if (isErrorWithCode(error)) {
        if (error.code === statusCodes.IN_PROGRESS) return;
        if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          Alert.alert(
            "Google Play Services no disponible",
            "Actualizá Google Play Services e intentá nuevamente."
          );
          return;
        }
      }

      Alert.alert(
        "No pudimos iniciar sesión con Google",
        error?.message || "Intentá nuevamente."
      );
    } finally {
      setGoogleLoading(false);
    }
  }

  const menuItems: MenuItem[] = [
    {
      title: "Favoritos",
      subtitle:
        favoritesCount === 1
          ? "1 producto guardado"
          : `${favoritesCount} productos guardados`,
      icon: "heart-outline",
      action: () => router.push("/favorites"),
    },
    {
      title: "Mis datos",
      subtitle: "Nombre, email y datos personales",
      icon: "account-outline",
      action: handleOpenMyData,
    },
    {
      title: "Direcciones de entrega",
      subtitle: "Dónde querés recibir tus compras",
      icon: "map-marker-outline",
      action: handleOpenDeliveryAddress,
    },
    {
      title: "Métodos de pago",
      subtitle: "Tarjetas, Mercado Pago y preferencias",
      icon: "credit-card-outline",
      action: handleOpenPaymentMethods,
    },
    {
      title: "Ayuda por WhatsApp",
      subtitle: "Atención real para resolver dudas",
      icon: "whatsapp",
      action: handleOpenWhatsapp,
    },
    {
      title: "Términos y condiciones",
      subtitle: "Políticas de compra, envío y garantía",
      icon: "file-document-outline",
      action: handleOpenTerms,
    },
  ];

  async function loadSession() {
    setLoadingSession(true);

    const storedUser = await getStoredUser();

    if (storedUser) {
      setUser(storedUser);
      hydrateForm(storedUser);

      try {
        const account = await getAppAccount();
        setUser(account.user);
        setCheckoutProfile(account.checkoutProfile);
        hydrateForm(account.user);
        await loadProfileOrders(account.user);
      } catch {
        const freshUser = await fetchCurrentUser();
        setUser(freshUser);
        hydrateForm(freshUser);
        await loadProfileOrders(freshUser);
      }

      setLoadingSession(false);
      return;
    }

    const freshUser = await fetchCurrentUser();

    if (freshUser) {
      setUser(freshUser);
      hydrateForm(freshUser);

      try {
        const account = await getAppAccount();
        setUser(account.user);
        setCheckoutProfile(account.checkoutProfile);
        hydrateForm(account.user);
        await loadProfileOrders(account.user);
      } catch {
        await loadProfileOrders(freshUser);
      }
    } else {
      setUser(null);
      setCheckoutProfile(null);
      setProfileOrders([]);
    }

    setLoadingSession(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadSession();
    }, [])
  );

  async function handleLogin() {
    if (submitting || googleLoading || appleLoading) return;

    if (!loginEmail.trim() || !loginPassword) {
      Alert.alert("Faltan datos", "Ingresá email y contraseña.");
      return;
    }

    try {
      setSubmitting(true);

      const loggedUser = await loginApp({
        email: loginEmail,
        password: loginPassword,
      });

      await hydrateAccountAfterAuth(loggedUser);
      setLoginPassword("");

      Alert.alert("Sesión iniciada", "Ya podés comprar con tu cuenta ShopX.");
    } catch (error: any) {
      Alert.alert(
        "No pudimos iniciar sesión",
        error?.message || "Revisá los datos e intentá nuevamente."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister() {
    if (submitting || googleLoading || appleLoading) return;

    if (!registerName.trim()) {
      Alert.alert("Falta nombre", "Ingresá tu nombre y apellido.");
      return;
    }

    if (!registerEmail.trim()) {
      Alert.alert("Falta email", "Ingresá un email válido.");
      return;
    }

    if (!registerPassword || registerPassword.length < 8) {
      Alert.alert(
        "Contraseña inválida",
        "La contraseña debe tener al menos 8 caracteres."
      );
      return;
    }

    try {
      setSubmitting(true);

      const registeredUser = await registerApp({
        fullName: registerName,
        email: registerEmail,
        phone: registerPhone,
        password: registerPassword,
      });

      await hydrateAccountAfterAuth(registeredUser);
      setRegisterPassword("");

      Alert.alert("Cuenta creada", "Ya podés comprar con tu cuenta ShopX.");
    } catch (error: any) {
      Alert.alert(
        "No pudimos crear la cuenta",
        error?.message || "Probá con otro email o intentá nuevamente."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveCheckoutData() {
    if (savingProfile) return;

    if (!formFullName.trim()) {
      Alert.alert("Falta nombre", "Ingresá tu nombre y apellido.");
      return;
    }

    if (!formPhone.trim()) {
      Alert.alert("Falta teléfono", "Ingresá tu WhatsApp o teléfono.");
      return;
    }

    if (!formDni.trim()) {
      Alert.alert("Falta DNI / CUIT", "Ingresá tu DNI o CUIT.");
      return;
    }

    if (
      !formStreetName.trim() ||
      !formStreetNumber.trim() ||
      !formCity.trim() ||
      !formProvince.trim() ||
      !formPostalCode.trim()
    ) {
      Alert.alert(
        "Falta dirección",
        "Completá calle, número, ciudad, provincia y código postal."
      );
      return;
    }

    try {
      setSavingProfile(true);

      const account = await updateAppAccount({
        fullName: formFullName,
        name: formFullName,
        phone: formPhone,
        dni: formDni,
        address: {
          streetName: formStreetName,
          streetNumber: formStreetNumber,
          floor: formFloor,
          apartment: formApartment,
          city: formCity,
          province: formProvince,
          postalCode: formPostalCode,
        },
        billing: {
          fullName: formFullName,
          dni: formDni,
          address: [formStreetName, formStreetNumber]
            .filter(Boolean)
            .join(" "),
          city: formCity,
          province: formProvince,
          postalCode: formPostalCode,
        },
        arca: user?.arca || {
          enabled: false,
        },
      });

      setUser(account.user);
      setCheckoutProfile(account.checkoutProfile);
      hydrateForm(account.user);
      setEditCheckoutData(false);

      Alert.alert("Datos guardados", "Tu perfil de compra quedó actualizado.");
    } catch (error: any) {
      Alert.alert(
        "No pudimos guardar los datos",
        error?.message || "Intentá nuevamente."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleLogout() {
    Alert.alert("Cerrar sesión", "¿Querés salir de tu cuenta ShopX?", [
      {
        text: "Cancelar",
        style: "cancel",
      },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await logoutApp();

          setUser(null);
          setCheckoutProfile(null);
          setProfileOrders([]);
          setEditCheckoutData(false);

          setLoginEmail("");
          setLoginPassword("");
          setRegisterName("");
          setRegisterEmail("");
          setRegisterPhone("");
          setRegisterPassword("");

          setFormFullName("");
          setFormPhone("");
          setFormDni("");
          setFormStreetName("");
          setFormStreetNumber("");
          setFormFloor("");
          setFormApartment("");
          setFormCity("");
          setFormProvince("");
          setFormPostalCode("");
        },
      },
    ]);
  }

  async function confirmDeleteAccount() {
    if (deletingAccount) return;

    Alert.alert(
      "Eliminar cuenta",
      "Esta acción elimina tu cuenta ShopX y cierra la sesión en este dispositivo. No es una desactivación temporal.",
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar definitivamente",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingAccount(true);
              await deleteAppAccount();

              setUser(null);
              setCheckoutProfile(null);
              setProfileOrders([]);
              setEditCheckoutData(false);

              setLoginEmail("");
              setLoginPassword("");
              setRegisterName("");
              setRegisterEmail("");
              setRegisterPhone("");
              setRegisterPassword("");

              setFormFullName("");
              setFormPhone("");
              setFormDni("");
              setFormStreetName("");
              setFormStreetNumber("");
              setFormFloor("");
              setFormApartment("");
              setFormCity("");
              setFormProvince("");
              setFormPostalCode("");

              Alert.alert(
                "Cuenta eliminada",
                "Tu cuenta fue eliminada correctamente."
              );
            } catch (error: any) {
              Alert.alert(
                "No pudimos eliminar la cuenta",
                error?.message || "Intentá nuevamente en unos minutos."
              );
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  }

  const orderStats = getOrderStats(profileOrders);

  if (loadingSession) {
    return (
      <View style={styles.app}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={navy} />
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>

        <AppBottomNav />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.app}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Mi cuenta"
          subtitle={
            user
              ? "Gestioná tu perfil, pedidos y preferencias de compra."
              : undefined
          }
        />

        {user ? (
          <>
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitial(user)}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {getDisplayName(user)}
                  </Text>

                  <View style={styles.verifiedPill}>
                    <Feather name="check" size={13} color={green} />
                    <Text style={styles.verifiedText}>
                      {user.emailVerified ? "Verificado" : "Pendiente"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.email} numberOfLines={1}>
                  {user.email}
                </Text>

                <TouchableOpacity
                  style={styles.editProfileButton}
                  onPress={() => setEditCheckoutData((prev) => !prev)}
                >
                  <Text style={styles.editProfileText}>
                    {editCheckoutData ? "Cerrar edición" : "Editar perfil"}
                  </Text>
                  <Feather name="arrow-right" size={15} color={accent} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.statsRow}>
              <StatCard
                value={loadingOrdersSummary ? "…" : String(orderStats.total)}
                label={
                  orderStats.active > 0
                    ? `${orderStats.active} en curso`
                    : orderStats.delivered > 0
                    ? `${orderStats.delivered} entregado${orderStats.delivered === 1 ? "" : "s"}`
                    : "Pedidos"
                }
                icon="package-variant-closed"
                onPress={() => router.push("/orders")}
              />
              <StatCard
                value={String(favoritesCount)}
                label="Favoritos"
                icon="heart-outline"
                onPress={() => router.push("/favorites")}
              />
              <StatCard value="24/7" label="Soporte" icon="whatsapp" />
            </View>

            <View
              style={styles.checkoutCard}
              onLayout={(event) => setCheckoutCardY(event.nativeEvent.layout.y)}
            >
              <View style={styles.checkoutHeader}>
                <View style={styles.checkoutIcon}>
                  <MaterialCommunityIcons
                    name="clipboard-check-outline"
                    size={23}
                    color={navy}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.checkoutTitle}>Datos para comprar</Text>
                  <Text style={styles.checkoutSubtitle}>
                    Necesarios para pagar, facturar y recibir tus pedidos.
                  </Text>
                </View>

                <View
                  style={[
                    styles.checkoutStatus,
                    checkoutProfile?.complete
                      ? styles.checkoutStatusComplete
                      : styles.checkoutStatusPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.checkoutStatusText,
                      checkoutProfile?.complete
                        ? styles.checkoutStatusTextComplete
                        : styles.checkoutStatusTextPending,
                    ]}
                  >
                    {checkoutProfile?.complete ? "COMPLETO" : "PENDIENTE"}
                  </Text>
                </View>
              </View>

              {!checkoutProfile?.complete ? (
                <View style={styles.missingBox}>
                  <Text style={styles.missingTitle}>Faltan datos</Text>
                  <Text style={styles.missingText}>
                    {(checkoutProfile?.missingFields || [])
                      .map(getMissingLabel)
                      .join(", ") || "Completá tus datos de compra."}
                  </Text>
                </View>
              ) : null}

              {editCheckoutData ? (
                <View style={styles.formBlock}>
                  <TextInput
                    value={formFullName}
                    onChangeText={setFormFullName}
                    placeholder="Nombre y apellido"
                    placeholderTextColor="#8FA0B6"
                    style={styles.input}
                  />

                  <TextInput
                    value={formPhone}
                    onChangeText={setFormPhone}
                    placeholder="WhatsApp / teléfono"
                    placeholderTextColor="#8FA0B6"
                    style={styles.input}
                    keyboardType="phone-pad"
                  />

                  <TextInput
                    value={formDni}
                    onChangeText={setFormDni}
                    placeholder="DNI / CUIT"
                    placeholderTextColor="#8FA0B6"
                    style={styles.input}
                    keyboardType="number-pad"
                  />

                  <View style={styles.inputRow}>
                    <TextInput
                      value={formStreetName}
                      onChangeText={setFormStreetName}
                      placeholder="Calle"
                      placeholderTextColor="#8FA0B6"
                      style={[styles.input, styles.inputFlex]}
                    />

                    <TextInput
                      value={formStreetNumber}
                      onChangeText={setFormStreetNumber}
                      placeholder="Número"
                      placeholderTextColor="#8FA0B6"
                      style={[styles.input, styles.inputSmall]}
                      keyboardType="number-pad"
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <TextInput
                      value={formFloor}
                      onChangeText={setFormFloor}
                      placeholder="Piso"
                      placeholderTextColor="#8FA0B6"
                      style={[styles.input, styles.inputSmall]}
                    />

                    <TextInput
                      value={formApartment}
                      onChangeText={setFormApartment}
                      placeholder="Depto"
                      placeholderTextColor="#8FA0B6"
                      style={[styles.input, styles.inputFlex]}
                    />
                  </View>

                  <TextInput
                    value={formCity}
                    onChangeText={setFormCity}
                    placeholder="Ciudad"
                    placeholderTextColor="#8FA0B6"
                    style={styles.input}
                  />

                  <Text style={styles.provinceTitle}>Provincia</Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.provinceRow}
                  >
                    {provinces.map((province) => {
                      const active = formProvince === province;

                      return (
                        <TouchableOpacity
                          key={province}
                          style={[
                            styles.provincePill,
                            active && styles.provincePillActive,
                          ]}
                          activeOpacity={0.88}
                          onPress={() => setFormProvince(province)}
                        >
                          <Text
                            style={[
                              styles.provincePillText,
                              active && styles.provincePillTextActive,
                            ]}
                          >
                            {province}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <TextInput
                    value={formPostalCode}
                    onChangeText={setFormPostalCode}
                    placeholder="Código postal"
                    placeholderTextColor="#8FA0B6"
                    style={styles.input}
                    keyboardType="number-pad"
                  />

                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      savingProfile && styles.buttonDisabled,
                    ]}
                    activeOpacity={0.9}
                    onPress={handleSaveCheckoutData}
                    disabled={savingProfile}
                  >
                    {savingProfile ? (
                      <ActivityIndicator color={white} />
                    ) : (
                      <>
                        <Text style={styles.saveButtonText}>Guardar datos</Text>
                        <Feather name="check" size={18} color={white} />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.checkoutPreview}>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Teléfono</Text>
                    <Text style={styles.previewValue}>
                      {user.phone || "Pendiente"}
                    </Text>
                  </View>

                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>DNI / CUIT</Text>
                    <Text style={styles.previewValue}>
                      {user.dni || user.billing?.dni || "Pendiente"}
                    </Text>
                  </View>

                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Dirección</Text>
                    <Text style={styles.previewValue}>
                      {user.address?.street ||
                      user.address?.streetName ||
                      user.address?.city
                        ? [
                            user.address?.street ||
                              [
                                user.address?.streetName,
                                user.address?.streetNumber,
                              ]
                                .filter(Boolean)
                                .join(" "),
                            user.address?.city,
                            user.address?.province,
                          ]
                            .filter(Boolean)
                            .join(", ")
                        : "Pendiente"}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.editDataButton}
                    activeOpacity={0.9}
                    onPress={() => setEditCheckoutData(true)}
                  >
                    <Text style={styles.editDataButtonText}>
                      {checkoutProfile?.complete
                        ? "Editar datos de compra"
                        : "Completar datos"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.trustCard}>
              <View style={styles.trustIcon}>
                <MaterialCommunityIcons
                  name="shield-check-outline"
                  size={25}
                  color={white}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.trustTitle}>Cuenta protegida ShopX</Text>
                <Text style={styles.trustText}>
                  Tus compras, pagos y entregas se gestionan con seguimiento y
                  soporte real.
                </Text>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Configuración</Text>
              <Text style={styles.sectionSubtitle}>
                Todo lo importante de tu cuenta
              </Text>
            </View>

            <View style={styles.menuCard}>
              {menuItems.map((item, index) => (
                <View key={item.title}>
                  <MenuRow item={item} />
                  {index < menuItems.length - 1 && (
                    <View style={styles.menuDivider} />
                  )}
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.whatsappButton}
              activeOpacity={0.9}
              onPress={handleOpenWhatsapp}
            >
              <MaterialCommunityIcons name="whatsapp" size={23} color={white} />
              <Text style={styles.whatsappButtonText}>Hablar con ShopX</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteAccountButton, deletingAccount && styles.buttonDisabled]}
              onPress={confirmDeleteAccount}
              disabled={deletingAccount}
            >
              {deletingAccount ? (
                <ActivityIndicator color="#C53030" />
              ) : (
                <>
                  <Feather name="trash-2" size={18} color="#C53030" />
                  <Text style={styles.deleteAccountText}>Eliminar cuenta</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Feather name="log-out" size={18} color={muted} />
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.authCard}>
              <View style={styles.authHeader}>
                <View style={styles.authIcon}>
                  <MaterialCommunityIcons
                    name="shield-account-outline"
                    size={25}
                    color={navy}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.authTitle}>Entrá a tu cuenta ShopX</Text>
                  <Text style={styles.authSubtitle}>
                    Para comprar necesitás iniciar sesión o crear una cuenta.
                  </Text>
                </View>
              </View>

              {appleAvailable ? (
                <TouchableOpacity
                  style={[
                    styles.appleButton,
                    (appleLoading || googleLoading || submitting) &&
                      styles.buttonDisabled,
                  ]}
                  activeOpacity={0.9}
                  onPress={handleAppleLogin}
                  disabled={appleLoading || googleLoading || submitting}
                >
                  {appleLoading ? (
                    <ActivityIndicator color={white} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="apple" size={22} color={white} />
                      <Text style={styles.appleButtonText}>Continuar con Apple</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.googleButton,
                  (googleLoading || appleLoading || submitting) &&
                    styles.buttonDisabled,
                ]}
                activeOpacity={0.9}
                onPress={handleGoogleLogin}
                disabled={googleLoading || appleLoading || submitting}
              >
                {googleLoading ? (
                  <ActivityIndicator color={text} />
                ) : (
                  <>
                    <View style={styles.googleIconCircle}>
                      <Text style={styles.googleIconText}>G</Text>
                    </View>
                    <Text style={styles.googleButtonText}>
                      Continuar con Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.authDividerRow}>
                <View style={styles.authDividerLine} />
                <Text style={styles.authDividerText}>o ingresá con email</Text>
                <View style={styles.authDividerLine} />
              </View>

              <View style={styles.modeSwitch}>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    mode === "login" && styles.modeButtonActive,
                  ]}
                  activeOpacity={0.9}
                  onPress={() => setMode("login")}
                >
                  <Text
                    style={[
                      styles.modeButtonText,
                      mode === "login" && styles.modeButtonTextActive,
                    ]}
                  >
                    Iniciar sesión
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    mode === "register" && styles.modeButtonActive,
                  ]}
                  activeOpacity={0.9}
                  onPress={() => setMode("register")}
                >
                  <Text
                    style={[
                      styles.modeButtonText,
                      mode === "register" && styles.modeButtonTextActive,
                    ]}
                  >
                    Crear cuenta
                  </Text>
                </TouchableOpacity>
              </View>

              {mode === "login" ? (
                <>
                  <TextInput
                    value={loginEmail}
                    onChangeText={setLoginEmail}
                    placeholder="Email"
                    placeholderTextColor="#8FA0B6"
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <TextInput
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    placeholder="Contraseña"
                    placeholderTextColor="#8FA0B6"
                    style={styles.input}
                    secureTextEntry
                  />

                  <TouchableOpacity
                    style={styles.forgotPasswordButton}
                    activeOpacity={0.85}
                    onPress={handleForgotPassword}
                    disabled={submitting || googleLoading || appleLoading}
                  >
                    <Text style={styles.forgotPasswordText}>Olvidé mi contraseña</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.authSubmitButton,
                      (submitting || googleLoading || appleLoading) && styles.buttonDisabled,
                    ]}
                    activeOpacity={0.9}
                    onPress={handleLogin}
                    disabled={submitting || googleLoading || appleLoading}
                  >
                    {submitting ? (
                      <ActivityIndicator color={white} />
                    ) : (
                      <>
                        <Text style={styles.authSubmitText}>Iniciar sesión</Text>
                        <Feather name="arrow-right" size={18} color={white} />
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TextInput
                    value={registerName}
                    onChangeText={setRegisterName}
                    placeholder="Nombre y apellido"
                    placeholderTextColor="#8FA0B6"
                    style={styles.input}
                  />

                  <TextInput
                    value={registerEmail}
                    onChangeText={setRegisterEmail}
                    placeholder="Email"
                    placeholderTextColor="#8FA0B6"
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <TextInput
                    value={registerPhone}
                    onChangeText={setRegisterPhone}
                    placeholder="WhatsApp"
                    placeholderTextColor="#8FA0B6"
                    style={styles.input}
                    keyboardType="phone-pad"
                  />

                  <TextInput
                    value={registerPassword}
                    onChangeText={setRegisterPassword}
                    placeholder="Contraseña"
                    placeholderTextColor="#8FA0B6"
                    style={styles.input}
                    secureTextEntry
                  />

                  <TouchableOpacity
                    style={[
                      styles.authSubmitButton,
                      (submitting || googleLoading || appleLoading) && styles.buttonDisabled,
                    ]}
                    activeOpacity={0.9}
                    onPress={handleRegister}
                    disabled={submitting || googleLoading || appleLoading}
                  >
                    {submitting ? (
                      <ActivityIndicator color={white} />
                    ) : (
                      <>
                        <Text style={styles.authSubmitText}>Crear cuenta</Text>
                        <Feather name="arrow-right" size={18} color={white} />
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>

          </>
        )}

        <View style={{ height: 130 }} />
      </ScrollView>

      <AppBottomNav />
    </KeyboardAvoidingView>
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

  profileCard: {
    marginHorizontal: 18,
    marginTop: 6,
    borderRadius: 28,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: navy,
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  avatarText: {
    color: white,
    fontSize: 34,
    fontWeight: "900",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  name: {
    color: text,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.5,
    maxWidth: "70%",
  },
  verifiedPill: {
    height: 24,
    borderRadius: 999,
    paddingHorizontal: 9,
    backgroundColor: greenSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    color: green,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  email: {
    marginTop: 3,
    color: muted,
    fontSize: 14,
    fontWeight: "600",
  },
  editProfileButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  editProfileText: {
    color: accent,
    fontSize: 13,
    fontWeight: "900",
  },

  statsRow: {
    marginHorizontal: 18,
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: navy,
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    color: text,
    fontSize: 18,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 2,
    color: muted,
    fontSize: 11,
    fontWeight: "800",
  },

  checkoutCard: {
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
  checkoutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkoutIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutTitle: {
    color: text,
    fontSize: 17,
    fontWeight: "900",
  },
  checkoutSubtitle: {
    marginTop: 3,
    color: muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  checkoutStatus: {
    height: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutStatusComplete: {
    backgroundColor: greenSoft,
  },
  checkoutStatusPending: {
    backgroundColor: orangeSoft,
  },
  checkoutStatusText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  checkoutStatusTextComplete: {
    color: green,
  },
  checkoutStatusTextPending: {
    color: orange,
  },
  missingBox: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: orangeSoft,
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 13,
  },
  missingTitle: {
    color: "#9A3412",
    fontSize: 13,
    fontWeight: "900",
  },
  missingText: {
    marginTop: 3,
    color: "#9A3412",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  formBlock: {
    marginTop: 16,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
  },
  inputFlex: {
    flex: 1,
  },
  inputSmall: {
    width: 102,
  },
  provinceTitle: {
    color: muted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginBottom: 9,
    marginTop: 2,
  },
  provinceRow: {
    gap: 8,
    paddingBottom: 11,
  },
  provincePill: {
    height: 38,
    borderRadius: 999,
    paddingHorizontal: 14,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    alignItems: "center",
    justifyContent: "center",
  },
  provincePillActive: {
    backgroundColor: navy,
    borderColor: navy,
  },
  provincePillText: {
    color: muted,
    fontSize: 13,
    fontWeight: "800",
  },
  provincePillTextActive: {
    color: white,
  },
  checkoutPreview: {
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: softCard,
    borderWidth: 1,
    borderColor: border,
    padding: 14,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  previewLabel: {
    color: muted,
    fontSize: 13,
    fontWeight: "700",
  },
  previewValue: {
    flex: 1,
    color: text,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  editDataButton: {
    marginTop: 8,
    height: 44,
    borderRadius: 999,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    alignItems: "center",
    justifyContent: "center",
  },
  editDataButtonText: {
    color: navy,
    fontSize: 13,
    fontWeight: "900",
  },
  saveButton: {
    marginTop: 6,
    height: 54,
    borderRadius: 999,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveButtonText: {
    color: white,
    fontSize: 15,
    fontWeight: "900",
  },

  trustCard: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 24,
    backgroundColor: navyDark,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    shadowColor: navy,
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  trustIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  trustTitle: {
    color: white,
    fontSize: 16,
    fontWeight: "900",
  },
  trustText: {
    marginTop: 4,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  sectionHeader: {
    paddingHorizontal: 18,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    color: text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  sectionSubtitle: {
    marginTop: 3,
    color: muted,
    fontSize: 13,
    fontWeight: "700",
  },

  menuCard: {
    marginHorizontal: 18,
    borderRadius: 28,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    overflow: "hidden",
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  menuRow: {
    minHeight: 76,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: softCard,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  menuTextBlock: {
    flex: 1,
  },
  menuTitle: {
    color: text,
    fontSize: 16,
    fontWeight: "900",
  },
  menuSubtitle: {
    marginTop: 3,
    color: muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  menuDivider: {
    height: 1,
    backgroundColor: border,
    marginLeft: 73,
  },

  benefitsCard: {
    marginHorizontal: 18,
    marginTop: 18,
    borderRadius: 26,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  benefitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  benefitEyebrow: {
    color: accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  benefitTitle: {
    marginTop: 3,
    color: text,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  benefitBadge: {
    height: 30,
    borderRadius: 999,
    paddingHorizontal: 13,
    backgroundColor: greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitBadgeText: {
    color: green,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  benefitList: {
    marginTop: 14,
    gap: 10,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  benefitItemText: {
    color: muted,
    fontSize: 13,
    fontWeight: "700",
  },

  whatsappButton: {
    marginHorizontal: 18,
    marginTop: 20,
    height: 56,
    borderRadius: 999,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    shadowColor: navy,
    shadowOpacity: 0.13,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  whatsappButtonText: {
    color: white,
    fontSize: 16,
    fontWeight: "900",
  },
  deleteAccountButton: {
    marginHorizontal: 18,
    marginTop: 12,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#FED7D7",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  deleteAccountText: {
    color: "#C53030",
    fontSize: 14,
    fontWeight: "900",
  },

  logoutButton: {
    marginTop: 18,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  logoutText: {
    color: muted,
    fontSize: 13,
    fontWeight: "800",
  },

  authCard: {
    marginHorizontal: 18,
    marginTop: 6,
    borderRadius: 28,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    shadowColor: navy,
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  authHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 16,
  },
  authIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
  },
  authTitle: {
    color: text,
    fontSize: 18,
    fontWeight: "900",
  },
  authSubtitle: {
    marginTop: 3,
    color: muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  appleButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  appleButtonText: {
    color: white,
    fontSize: 15,
    fontWeight: "900",
  },

  googleButton: {
    height: 54,
    borderRadius: 999,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  googleIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: border,
    alignItems: "center",
    justifyContent: "center",
  },
  googleIconText: {
    color: "#4285F4",
    fontSize: 16,
    fontWeight: "900",
  },
  googleButtonText: {
    color: text,
    fontSize: 15,
    fontWeight: "900",
  },
  authDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  authDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: border,
  },
  authDividerText: {
    color: "#9AA6B8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  modeSwitch: {
    flexDirection: "row",
    backgroundColor: softCard,
    borderRadius: 999,
    padding: 5,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonActive: {
    backgroundColor: navy,
  },
  modeButtonText: {
    color: muted,
    fontSize: 13,
    fontWeight: "900",
  },
  modeButtonTextActive: {
    color: white,
  },
  input: {
    height: 52,
    borderRadius: 18,
    backgroundColor: softCard,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 15,
    color: text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 11,
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginTop: -2,
    marginBottom: 14,
    paddingVertical: 6,
  },

  forgotPasswordText: {
    color: accent,
    fontSize: 13,
    fontWeight: "900",
  },

  authSubmitButton: {
    marginTop: 4,
    height: 54,
    borderRadius: 999,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  authSubmitText: {
    color: white,
    fontSize: 16,
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.72,
  },
});