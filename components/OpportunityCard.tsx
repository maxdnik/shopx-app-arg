import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { opportunityQuoteParams, validOpportunity, type Opportunity } from "../lib/opportunities";

const amount = (value: number) => value.toLocaleString("es-AR", { maximumFractionDigits: 2 });

async function openReference(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return;
    await openBrowserAsync(url.href);
  } catch { Alert.alert("No pudimos abrir el enlace", "Volvé a intentar."); }
}

export function OpportunityCard({ opportunity: item }: { opportunity: Opportunity }) {
  const [expanded, setExpanded] = useState(false);
  if (!validOpportunity(item)) return null;
  const saving = item.argentinaPriceArs - item.shopxPriceArs;
  const date = new Date(item.quotedAt).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const open = () => router.push({ pathname: "/quote", params: opportunityQuoteParams(item) });
  return <View style={s.card}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Ver ${item.title}`} onPress={open} style={s.imageWrap}>
      {item.image ? <Image source={{ uri: item.image }} style={s.image} contentFit="contain" cachePolicy="memory-disk" accessibilityLabel={item.title} />
        : <Feather name="package" color="#8B9CAF" size={42} />}
    </TouchableOpacity>
    <Text style={s.brand} numberOfLines={1}>{item.brand || item.category}</Text>
    <TouchableOpacity accessibilityRole="button" onPress={open}><Text style={s.title} numberOfLines={2}>{item.title}</Text></TouchableOpacity>
    <Text style={s.meta} numberOfLines={1}>{[item.model, item.variant].filter(Boolean).join(" · ")}</Text>
    <View style={s.prices}>
      <View style={s.priceCell}><Text style={s.priceLabel}>En Argentina</Text><Text style={s.currency}>AR$</Text><Text style={s.price} numberOfLines={1} adjustsFontSizeToFit>{amount(item.argentinaPriceArs)}</Text><Text style={s.meta} numberOfLines={1}>{item.argentinaStore}</Text></View>
      <View style={[s.priceCell, s.shopx]}><Text style={[s.priceLabel, s.teal]}>Con ShopX</Text><Text style={[s.currency, s.teal]}>AR$</Text><Text style={[s.price, s.strong]} numberOfLines={1} adjustsFontSizeToFit>{amount(item.shopxPriceArs)}</Text><Text style={s.meta}>Envío e impuestos</Text></View>
    </View>
    <Text style={s.saving}>Ahorrás AR$ {amount(saving)} · {((saving / item.argentinaPriceArs) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%</Text>
    <Text style={s.date}>Referencia argentina del {date}.</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} style={s.detailsButton} onPress={() => setExpanded(value => !value)}><Text style={s.detailsLabel}>Ver comparación</Text><Feather name={expanded ? "chevron-up" : "chevron-down"} size={17} color="#082A49" /></TouchableOpacity>
    {expanded ? <View style={s.details}>
      <Text style={s.detailText}>{[item.model, item.variant].filter(Boolean).join(" · ")}</Text>
      <TouchableOpacity accessibilityRole="link" onPress={() => { void openReference(item.argentinaUrl); }}><Text style={s.link}>{item.argentinaStore} ↗</Text></TouchableOpacity>
      <Text style={s.detailText}>{item.argentinaPayment || "Precio público publicado"}. Relevado el {date}.</Text>
      <Text style={s.detailText}>Total ShopX para una unidad, con envío a CABA (CP 1425) e impuestos incluidos.</Text>
      <TouchableOpacity accessibilityRole="link" onPress={() => { void openReference(item.sourceUrl); }}><Text style={s.link}>Ver publicación de origen ↗</Text></TouchableOpacity>
      <Text style={s.detailText}>Actualizamos precio y disponibilidad al cotizar.</Text>
    </View> : null}
    <TouchableOpacity accessibilityRole="button" style={s.button} onPress={open}><Text style={s.buttonText}>Ver producto</Text><Feather name="arrow-right" size={18} color="#082A49" /></TouchableOpacity>
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: "white", borderWidth: 1, borderColor: "#E3EAF0", borderRadius: 22, padding: 13, gap: 7 },
  imageWrap: { width: "100%", aspectRatio: 4 / 3, borderRadius: 15, backgroundColor: "#F5F7FA", justifyContent: "center", alignItems: "center", overflow: "hidden" },
  image: { width: "88%", height: "88%" },
  brand: { color: "#087C91", fontSize: 10, fontWeight: "800", letterSpacing: 0.8, marginTop: 7, textTransform: "uppercase" },
  title: { color: "#082A49", fontWeight: "900", fontSize: 16, lineHeight: 21, minHeight: 42 },
  meta: { fontSize: 10, color: "#617590", marginTop: 3 },
  prices: { flexDirection: "row", borderRadius: 12, overflow: "hidden", marginTop: 7 },
  priceCell: { flex: 1, backgroundColor: "#F1F3F6", padding: 11 },
  shopx: { backgroundColor: "#DFFAFE" },
  priceLabel: { fontSize: 11, fontWeight: "700", color: "#617590" },
  currency: { fontSize: 10, color: "#617590", marginTop: 8 },
  price: { fontSize: 19, fontWeight: "700", color: "#082A49", marginTop: 2 },
  strong: { fontWeight: "900" },
  teal: { color: "#087C91" },
  saving: { borderRadius: 10, backgroundColor: "#EAF9E8", padding: 9, color: "#166534", fontSize: 12, fontWeight: "800", textAlign: "center" },
  date: { fontSize: 10, color: "#617590", marginTop: 3 },
  detailsButton: { minHeight: 42, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailsLabel: { fontSize: 12, fontWeight: "700", color: "#082A49" },
  details: { padding: 12, borderRadius: 12, backgroundColor: "#F5F7FA", gap: 10 },
  detailText: { fontSize: 12, lineHeight: 18, color: "#617590" },
  link: { fontSize: 12, lineHeight: 20, fontWeight: "700", color: "#087C91", textDecorationLine: "underline" },
  button: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 46, borderRadius: 12, backgroundColor: "#22D3EE", paddingHorizontal: 15 },
  buttonText: { fontSize: 13, fontWeight: "800", color: "#082A49" },
});
