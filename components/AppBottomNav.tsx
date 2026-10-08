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
          const color = active ? "#087C91" : "#718096";
          return <TouchableOpacity key={tab.route} style={s.item} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: active }} activeOpacity={0.8} onPress={() => router.navigate(tab.route as Href)}>
            <Feather name={tab.icon} size={25} color={active ? "#16BED2" : color} />
            <Text style={[s.label, { color }, active && s.active]} numberOfLines={1}>{tab.label}</Text>
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
  label: { fontSize: 10, fontWeight: "500" },
  active: { fontWeight: "700" },
});
