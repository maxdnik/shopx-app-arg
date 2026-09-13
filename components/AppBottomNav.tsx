import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";

const navy = "#062B4F";
const muted = "#718096";
const accent = "#18C7D8";
const border = "#E2E8F0";
const white = "#FFFFFF";

function isActive(pathname: string, matches: string[]) {
  return matches.some((match) => {
    if (match === "/") {
      return (
        pathname === "/" || pathname === "/index" || pathname === "/(tabs)"
      );
    }

    return pathname.startsWith(match);
  });
}

export function AppBottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const homeActive = isActive(pathname, ["/"]);
  const categoriesActive = isActive(pathname, ["/categories"]);
  const quoteActive = isActive(pathname, ["/quote"]);
  const ordersActive = isActive(pathname, ["/orders"]);
  const profileActive = isActive(pathname, ["/profile"]);

  return (
    <View
      style={[styles.bottomNavWrap, { bottom: Math.max(12, insets.bottom) }]}
    >
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.85}
          onPress={() => router.push("/")}
        >
          <Feather name="home" size={23} color={homeActive ? accent : muted} />
          <Text style={[styles.navLabel, homeActive && styles.navLabelActive]}>
            Inicio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.85}
          onPress={() => router.push("/categories")}
        >
          <Feather
            name="grid"
            size={23}
            color={categoriesActive ? accent : muted}
          />
          <Text
            style={[styles.navLabel, categoriesActive && styles.navLabelActive]}
          >
            Categorías
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.centerNavItem}
          activeOpacity={0.9}
          onPress={() => router.push("/quote")}
        >
          <View style={styles.centerNavButton}>
            <Feather name="plus" size={31} color={white} />
          </View>
          <Text style={[styles.navLabel, quoteActive && styles.navLabelActive]}>
            Cotizar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.85}
          onPress={() => router.push("/orders")}
        >
          <Feather name="box" size={23} color={ordersActive ? accent : muted} />
          <Text
            style={[styles.navLabel, ordersActive && styles.navLabelActive]}
          >
            Pedidos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.85}
          onPress={() => router.push("/profile")}
        >
          <Feather
            name="user"
            size={23}
            color={profileActive ? accent : muted}
          />
          <Text
            style={[styles.navLabel, profileActive && styles.navLabelActive]}
          >
            Mi cuenta
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavWrap: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    zIndex: 50,
  },
  bottomNav: {
    height: 76,
    borderRadius: 30,
    backgroundColor: white,
    borderWidth: 1,
    borderColor: border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    shadowColor: navy,
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  centerNavItem: {
    flex: 1,
    alignItems: "center",
    marginTop: -28,
  },
  centerNavButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: navy,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 7,
    borderColor: white,
  },
  navLabel: {
    marginTop: 2,
    color: muted,
    fontSize: 11,
    fontWeight: "700",
  },
  navLabelActive: {
    color: accent,
    fontWeight: "900",
  },
});
