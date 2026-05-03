import { useState } from "react";
import { AppBottomNav } from "../../components/AppBottomNav";
import { ScreenHeader } from "../../components/ScreenHeader";
import {
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

export default function QuoteScreen() {
  const [productUrl, setProductUrl] = useState("");
  const [comments, setComments] = useState("");
  const [contact, setContact] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!productUrl.trim()) {
      Alert.alert(
        "Falta el link",
        "Pegá el link del producto que querés traer de USA."
      );
      return;
    }

    if (!contact.trim()) {
      Alert.alert(
        "Falta contacto",
        "Dejanos tu WhatsApp o email para responderte la cotización."
      );
      return;
    }

    setSubmitted(true);
  }

  function resetForm() {
    setProductUrl("");
    setComments("");
    setContact("");
    setSubmitted(false);
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
          subtitle="Pegá el link de una tienda de USA y recibí el precio final estimado en Argentina."
          icon={<Feather name="link-2" size={24} color={white} />}
        />

        {submitted ? (
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Feather name="check" size={34} color={green} />
            </View>

            <Text style={styles.successTitle}>Solicitud recibida</Text>

            <Text style={styles.successText}>
              Vamos a revisar disponibilidad, impuestos, logística y precio final
              para responderte con una cotización clara.
            </Text>

            <View style={styles.successSummary}>
              <View>
                <Text style={styles.summaryLabel}>Producto</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>
                  Cotización por link
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

            <TouchableOpacity style={styles.primaryButton} onPress={resetForm}>
              <Text style={styles.primaryButtonText}>Cotizar otro producto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroKicker}>SHOPX REQUEST</Text>
                <Text style={styles.heroTitle}>Cotizá tu compra de USA</Text>
                <Text style={styles.heroText}>
                  Peganos el link del producto y calculamos el precio final
                  estimado para recibirlo en Argentina.
                </Text>
              </View>

              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>USA</Text>
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
                    Pegá el link de la tienda de USA
                  </Text>
                </View>
              </View>

              <TextInput
                value={productUrl}
                onChangeText={setProductUrl}
                placeholder="https://www.amazon.com/..."
                placeholderTextColor="#8FA0B6"
                style={styles.linkInput}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.helperText}>
                Puede ser Amazon, eBay, Apple, Nike, StockX, Best Buy o
                cualquier tienda de USA.
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
                    Talle, color, modelo o urgencia
                  </Text>
                </View>
              </View>

              <TextInput
                value={comments}
                onChangeText={setComments}
                placeholder="Talle, color, modelo exacto, urgencia o cualquier dato útil..."
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
                  <Text style={styles.sectionSubtitle}>
                    Dónde te respondemos
                  </Text>
                </View>
              </View>

              <TextInput
                value={contact}
                onChangeText={setContact}
                placeholder="WhatsApp o email"
                placeholderTextColor="#8FA0B6"
                style={styles.contactInput}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.helperText}>
                Te vamos a responder con precio final, tiempos estimados y
                próximos pasos.
              </Text>
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
                  <Text style={styles.trustTitle}>
                    Qué incluye la cotización
                  </Text>
                  <Text style={styles.trustSubtitle}>
                    Todo pensado para evitar sorpresas.
                  </Text>
                </View>
              </View>

              <View style={styles.trustList}>
                <View style={styles.trustItem}>
                  <Feather name="check-circle" size={18} color={accent} />
                  <Text style={styles.trustText}>
                    Precio final estimado en Argentina
                  </Text>
                </View>

                <View style={styles.trustItem}>
                  <Feather name="check-circle" size={18} color={accent} />
                  <Text style={styles.trustText}>
                    Impuestos, aduana y tasas estimadas
                  </Text>
                </View>

                <View style={styles.trustItem}>
                  <Feather name="check-circle" size={18} color={accent} />
                  <Text style={styles.trustText}>
                    Logística internacional y entrega local
                  </Text>
                </View>

                <View style={styles.trustItem}>
                  <Feather name="check-circle" size={18} color={accent} />
                  <Text style={styles.trustText}>
                    Acompañamiento de ShopX durante el proceso
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>Solicitar cotización</Text>
              <Feather name="arrow-right" size={20} color={white} />
            </TouchableOpacity>

            <Text style={styles.legalText}>
              La cotización final puede variar según disponibilidad, precio en
              origen y condiciones logísticas al momento de la compra.
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
    borderRadius: 28,
    backgroundColor: navyDark,
    padding: 18,
    marginBottom: 16,
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
    fontSize: 22,
    fontWeight: "900",
    marginTop: 6,
    letterSpacing: -0.5,
  },
  heroText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    marginTop: 6,
  },
  heroBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  heroBadgeText: {
    color: white,
    fontSize: 15,
    fontWeight: "900",
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
  },
  contactInput: {
    height: 52,
    borderRadius: 999,
    backgroundColor: softCard,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 18,
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
    padding: 24,
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
    marginBottom: 18,
  },
  successTitle: {
    color: white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },
  successText: {
    color: "#D7E2EF",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 22,
    fontWeight: "600",
  },
  successSummary: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 18,
    marginBottom: 20,
  },
  summaryLabel: {
    color: "#9FB1C8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  summaryValue: {
    color: white,
    fontSize: 16,
    fontWeight: "900",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 14,
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