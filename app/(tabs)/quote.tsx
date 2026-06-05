import { useEffect, useMemo, useState } from "react";
import { AppBottomNav } from "../../components/AppBottomNav";
import { ScreenHeader } from "../../components/ScreenHeader";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { getStoredUser } from "../../lib/auth";
import {
  normalizeQuoteUrl,
  submitQuoteRequest,
  validateQuoteUrl,
} from "../../lib/quote";

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
const amber = "#F59E0B";

const urgencyOptions = [
  { value: "normal", label: "Normal", icon: "clock" as const },
  { value: "urgent", label: "Lo necesito pronto", icon: "zap" as const },
  { value: "not_sure", label: "Estoy evaluando", icon: "help-circle" as const },
];

function detectStoreFromUrl(value: string) {
  const clean = value.toLowerCase();

  if (clean.includes("amazon.")) return "Amazon";
  if (clean.includes("apple.")) return "Apple";
  if (clean.includes("nike.")) return "Nike";
  if (clean.includes("ebay.")) return "eBay";
  if (clean.includes("bestbuy.")) return "Best Buy";
  if (clean.includes("yeti.")) return "YETI";
  if (clean.includes("walmart.")) return "Walmart";
  if (clean.includes("target.")) return "Target";
  if (clean.includes("adidas.")) return "Adidas";

  return "";
}

export default function QuoteScreen() {
  const [productUrl, setProductUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [store, setStore] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [comments, setComments] = useState("");
  const [contact, setContact] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "urgent" | "not_sure">(
    "normal"
  );
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [quoteNumber, setQuoteNumber] = useState("");

  useEffect(() => {
    let mounted = true;

    getStoredUser()
      .then((user) => {
        if (!mounted || !user) return;
        setContact(user.email || user.phone || "");
      })
      .catch(() => null);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const detected = detectStoreFromUrl(productUrl);
    if (detected && !store.trim()) {
      setStore(detected);
    }
  }, [productUrl, store]);

  const urlError = useMemo(() => {
    if (!productUrl.trim()) return "";
    return validateQuoteUrl(productUrl);
  }, [productUrl]);

  const canSubmit = productUrl.trim() && contact.trim() && !urlError && !loading;

  async function handleSubmit() {
    const validationError = validateQuoteUrl(productUrl);

    if (validationError) {
      Alert.alert("Revisá el link", validationError);
      return;
    }

    if (!contact.trim()) {
      Alert.alert(
        "Falta contacto",
        "Dejanos tu email o teléfono para responderte la cotización."
      );
      return;
    }

    setLoading(true);

    try {
      const data = await submitQuoteRequest({
        productUrl: normalizeQuoteUrl(productUrl),
        productName,
        store,
        quantity: Number(quantity || 1),
        comments,
        contact,
        urgency,
      });

      setQuoteNumber(data.quote?.quoteNumber || "");
      setSubmitted(true);
    } catch (error: any) {
      Alert.alert(
        "No pudimos enviar la cotización",
        error?.message || "Probá de nuevo en unos segundos."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setProductUrl("");
    setProductName("");
    setStore("");
    setQuantity("1");
    setComments("");
    setUrgency("normal");
    setSubmitted(false);
    setQuoteNumber("");
  }

  return (
    <KeyboardAvoidingView
      style={styles.app}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Cotizar"
          subtitle="Pegá cualquier link de USA y recibí precio final estimado puesto en Argentina."
          icon={<Feather name="link-2" size={24} color={white} />}
        />

        {submitted ? (
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Feather name="check" size={34} color={green} />
            </View>

            <Text style={styles.successKicker}>Solicitud recibida</Text>
            <Text style={styles.successTitle}>Ya la estamos revisando</Text>

            <Text style={styles.successText}>
              Vamos a validar disponibilidad, precio en origen, peso estimado,
              impuestos, aduana y logística para responderte con un precio final
              claro.
            </Text>

            <View style={styles.successSummary}>
              {!!quoteNumber && (
                <>
                  <View>
                    <Text style={styles.summaryLabel}>Número de solicitud</Text>
                    <Text style={styles.summaryValue}>{quoteNumber}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                </>
              )}

              <View>
                <Text style={styles.summaryLabel}>Link</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>
                  {productUrl}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View>
                <Text style={styles.summaryLabel}>Contacto</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>
                  {contact}
                </Text>
              </View>
            </View>

            <View style={styles.nextStepsCard}>
              <Text style={styles.nextStepsTitle}>Qué pasa ahora</Text>
              <View style={styles.nextStepRow}>
                <View style={styles.nextStepDot} />
                <Text style={styles.nextStepText}>Revisamos el producto y disponibilidad.</Text>
              </View>
              <View style={styles.nextStepRow}>
                <View style={styles.nextStepDotMuted} />
                <Text style={styles.nextStepText}>Calculamos precio final Argentina.</Text>
              </View>
              <View style={styles.nextStepRow}>
                <View style={styles.nextStepDotMuted} />
                <Text style={styles.nextStepText}>Te respondemos con próximos pasos.</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={resetForm}>
              <Text style={styles.primaryButtonText}>Cotizar otro producto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroKicker}>SHOPX LINK REQUEST</Text>
                <Text style={styles.heroTitle}>Traé cualquier producto de USA</Text>
                <Text style={styles.heroText}>
                  Pegá el link. ShopX analiza la compra y te devuelve un precio
                  final estimado para recibirlo en Argentina.
                </Text>
              </View>

              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>USA</Text>
                <Text style={styles.heroBadgeSub}>AR</Text>
              </View>
            </View>

            <View style={styles.flowCard}>
              <View style={styles.flowItem}>
                <View style={styles.flowIcon}>
                  <Text style={styles.flowNumber}>1</Text>
                </View>
                <Text style={styles.flowText}>Pegás el link</Text>
              </View>
              <View style={styles.flowLine} />
              <View style={styles.flowItem}>
                <View style={styles.flowIcon}>
                  <Text style={styles.flowNumber}>2</Text>
                </View>
                <Text style={styles.flowText}>Calculamos final</Text>
              </View>
              <View style={styles.flowLine} />
              <View style={styles.flowItem}>
                <View style={styles.flowIcon}>
                  <Text style={styles.flowNumber}>3</Text>
                </View>
                <Text style={styles.flowText}>Te respondemos</Text>
              </View>
            </View>

            <View style={styles.mainCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Feather name="link-2" size={20} color={navy} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Link del producto</Text>
                  <Text style={styles.sectionSubtitle}>
                    Copiá la URL completa de la tienda de USA
                  </Text>
                </View>
              </View>

              <TextInput
                value={productUrl}
                onChangeText={setProductUrl}
                placeholder="https://www.amazon.com/..."
                placeholderTextColor="#8FA0B6"
                style={[styles.linkInput, urlError ? styles.inputError : null]}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />

              {!!urlError && <Text style={styles.errorText}>{urlError}</Text>}

              <Text style={styles.helperText}>
                Puede ser Amazon, Apple, Nike, eBay, Best Buy, StockX, YETI o
                cualquier tienda de USA.
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Feather name="shopping-bag" size={20} color={navy} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Datos útiles opcionales</Text>
                  <Text style={styles.sectionSubtitle}>
                    La tienda, el modelo y los comentarios no son obligatorios.
                  </Text>
                </View>
              </View>

              <TextInput
                value={productName}
                onChangeText={setProductName}
                placeholder="Nombre/modelo del producto"
                placeholderTextColor="#8FA0B6"
                style={styles.contactInput}
              />

              <View style={styles.rowInputs}>
                <TextInput
                  value={store}
                  onChangeText={setStore}
                  placeholder="Tienda (opcional)"
                  placeholderTextColor="#8FA0B6"
                  style={[styles.smallInput, { flex: 1.45 }]}
                />
                <TextInput
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="Cant."
                  placeholderTextColor="#8FA0B6"
                  style={[styles.smallInput, { flex: 0.55 }]}
                  keyboardType="number-pad"
                />
              </View>

              <Text style={styles.optionalHint}>
                Si no sabés la tienda, dejalo vacío. Con el link alcanza para pedir la cotización.
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Feather name="message-square" size={20} color={navy} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Comentarios</Text>
                  <Text style={styles.sectionSubtitle}>
                    Talle, color, modelo exacto o urgencia
                  </Text>
                </View>
              </View>

              <TextInput
                value={comments}
                onChangeText={setComments}
                placeholder="Ej: talle M, color negro, versión 256GB, envío sin apuro..."
                placeholderTextColor="#8FA0B6"
                style={styles.commentsInput}
                multiline
              />
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Feather name="user" size={20} color={navy} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Contacto</Text>
                  <Text style={styles.sectionSubtitle}>Dónde te respondemos</Text>
                </View>
              </View>

              <TextInput
                value={contact}
                onChangeText={setContact}
                placeholder="Email o teléfono"
                placeholderTextColor="#8FA0B6"
                style={styles.contactInput}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Feather name="clock" size={20} color={navy} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Prioridad</Text>
                  <Text style={styles.sectionSubtitle}>
                    Ayuda a ordenar la respuesta
                  </Text>
                </View>
              </View>

              <View style={styles.urgencyGrid}>
                {urgencyOptions.map((option) => {
                  const active = option.value === urgency;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.urgencyChip, active && styles.urgencyChipActive]}
                      onPress={() => setUrgency(option.value as any)}
                    >
                      <Feather
                        name={option.icon}
                        size={15}
                        color={active ? white : navy}
                      />
                      <Text
                        style={[
                          styles.urgencyText,
                          active && styles.urgencyTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.trustCard}>
              <View style={styles.trustHeader}>
                <View style={styles.trustIconBig}>
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={25}
                    color={white}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.trustTitle}>Qué incluye la cotización</Text>
                  <Text style={styles.trustSubtitle}>
                    Pensado para evitar sorpresas antes de comprar.
                  </Text>
                </View>
              </View>

              <View style={styles.trustList}>
                <View style={styles.trustItem}>
                  <Feather name="check-circle" size={18} color={accent} />
                  <Text style={styles.trustText}>Precio final estimado en Argentina</Text>
                </View>

                <View style={styles.trustItem}>
                  <Feather name="check-circle" size={18} color={accent} />
                  <Text style={styles.trustText}>Producto, impuestos, aduana y tasas</Text>
                </View>

                <View style={styles.trustItem}>
                  <Feather name="check-circle" size={18} color={accent} />
                  <Text style={styles.trustText}>Logística internacional y entrega local</Text>
                </View>

                <View style={styles.trustItem}>
                  <Feather name="check-circle" size={18} color={accent} />
                  <Text style={styles.trustText}>Acompañamiento ShopX hasta la entrega</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? (
                <ActivityIndicator color={white} />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Solicitar cotización</Text>
                  <Feather name="arrow-right" size={20} color={white} />
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.legalText}>
              La cotización puede variar según disponibilidad, precio en origen,
              peso, medidas y condiciones logísticas al momento de la compra.
            </Text>
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
    paddingHorizontal: 18,
    paddingBottom: 0,
  },

  heroCard: {
    borderRadius: 30,
    backgroundColor: navyDark,
    padding: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: navy,
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroKicker: {
    color: accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: white,
    fontSize: 23,
    fontWeight: "900",
    marginTop: 6,
    letterSpacing: -0.8,
    lineHeight: 28,
  },
  heroText: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    marginTop: 7,
  },
  heroBadge: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  heroBadgeText: {
    color: white,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  heroBadgeSub: {
    color: accent,
    fontSize: 11,
    fontWeight: "900",
    marginTop: -2,
  },

  flowCard: {
    borderRadius: 24,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: navy,
    shadowOpacity: 0.035,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  flowItem: {
    flex: 1,
    alignItems: "center",
  },
  flowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  flowNumber: {
    color: navy,
    fontSize: 12,
    fontWeight: "900",
  },
  flowText: {
    color: text,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  flowLine: {
    width: 18,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#DCE7F2",
    marginHorizontal: 2,
  },

  mainCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: white,
    padding: 16,
    marginBottom: 14,
    shadowColor: navy,
    shadowOpacity: 0.045,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: white,
    padding: 16,
    marginBottom: 14,
    shadowColor: navy,
    shadowOpacity: 0.035,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#EAFBFD",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: text,
    fontSize: 16,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: muted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },

  linkInput: {
    minHeight: 108,
    borderRadius: 20,
    backgroundColor: softCard,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: text,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
    fontWeight: "600",
  },
  inputError: {
    borderColor: "#EF4444",
    backgroundColor: "#FFF7F7",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    marginTop: 9,
  },
  commentsInput: {
    minHeight: 116,
    borderRadius: 20,
    backgroundColor: softCard,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: text,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
    fontWeight: "600",
  },
  contactInput: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: softCard,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 16,
    color: text,
    fontSize: 15,
    fontWeight: "700",
  },
  rowInputs: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  smallInput: {
    height: 52,
    borderRadius: 18,
    backgroundColor: softCard,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 16,
    color: text,
    fontSize: 15,
    fontWeight: "700",
  },
  helperText: {
    color: muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 11,
    fontWeight: "600",
  },
  optionalHint: {
    color: muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    fontWeight: "600",
  },
  urgencyGrid: {
    gap: 9,
  },
  urgencyChip: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: softCard,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  urgencyChipActive: {
    backgroundColor: navy,
    borderColor: navy,
  },
  urgencyText: {
    color: text,
    fontSize: 13,
    fontWeight: "900",
  },
  urgencyTextActive: {
    color: white,
  },

  trustCard: {
    borderRadius: 28,
    backgroundColor: navy,
    padding: 18,
    marginBottom: 18,
    shadowColor: navy,
    shadowOpacity: 0.13,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  trustHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  trustIconBig: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  trustTitle: {
    color: white,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900",
  },
  trustSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },
  trustList: {
    gap: 12,
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trustText: {
    flex: 1,
    color: "#D7E2EF",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },

  submitButton: {
    backgroundColor: navy,
    borderRadius: 999,
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    marginBottom: 14,
    shadowColor: navy,
    shadowOpacity: 0.13,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.48,
  },
  submitButtonText: {
    color: white,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  legalText: {
    color: muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: 8,
    fontWeight: "500",
  },

  successCard: {
    borderRadius: 30,
    backgroundColor: navy,
    padding: 22,
    alignItems: "center",
    shadowColor: navy,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  successIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successKicker: {
    color: accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  successTitle: {
    color: white,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },
  successText: {
    color: "#D7E2EF",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "600",
  },
  successSummary: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 18,
    marginBottom: 14,
  },
  summaryLabel: {
    color: "#9FB1C8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  summaryValue: {
    color: white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 14,
  },
  nextStepsCard: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: "rgba(24,199,216,0.11)",
    borderWidth: 1,
    borderColor: "rgba(24,199,216,0.22)",
    padding: 16,
    marginBottom: 16,
  },
  nextStepsTitle: {
    color: white,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 11,
  },
  nextStepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 9,
  },
  nextStepDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: accent,
  },
  nextStepDotMuted: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  nextStepText: {
    flex: 1,
    color: "#D7E2EF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  primaryButton: {
    width: "100%",
    backgroundColor: white,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: navy,
    fontSize: 15,
    fontWeight: "900",
  },
});
