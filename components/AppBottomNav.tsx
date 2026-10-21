import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, usePathname, type Href } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

const tabs = [
  { route: "/", label: "Inicio", icon: "home" },
  { route: "/categories", label: "Categorías", icon: "grid" },
  { route: "/quote", label: "Cotizar", icon: "link" },
  { route: "/orders", label: "Pedidos", icon: "box" },
  { route: "/profile", label: "Mi cuenta", icon: "user" },
] as const;

export function AppBottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { paddingBottom: Math.max(8, insets.bottom) }]}>
      <View style={s.bar}>
        {tabs.map((tab) => {
          const active = tab.route === "/" ? ["/", "/index", "/(tabs)"].includes(pathname) : pathname.startsWith(tab.route);
          const quote = tab.route === "/quote";
          const color = active ? "#087C91" : "#718096";
          return <TouchableOpacity key={tab.route} style={[s.item, quote && s.quoteItem]} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: active }} activeOpacity={0.8} onPress={() => router.navigate(tab.route as Href)}>
            {quote ? <View style={[s.quoteButton, active && s.quoteButtonActive]}><Feather name="link" size={26} color="#FFFFFF" /></View>
              : <Feather name={tab.icon} size={25} color={active ? "#16BED2" : color} />}
            <Text style={[s.label, { color }, active && s.active, quote && s.quoteLabel]} numberOfLines={1}>{tab.label}</Text>
          </TouchableOpacity>;
        })}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderColor: "#E8EDF2" },
  bar: { flexDirection: "row", maxWidth: 640, width: "100%", alignSelf: "center", height: 64, paddingHorizontal: 8 },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 5 },
  quoteItem: { justifyContent: "flex-end", paddingBottom: 7, gap: 3 },
  quoteButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#082A49", borderWidth: 3, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#082A49", shadowOpacity: 0.16, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  quoteButtonActive: { backgroundColor: "#087C91", borderColor: "#D5F7FA" },
  quoteLabel: { color: "#082A49", fontWeight: "700" },
  label: { fontSize: 10, fontWeight: "500" },
  active: { fontWeight: "700" },
});
