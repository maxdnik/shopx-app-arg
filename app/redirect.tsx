import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const navy = "#062B4F";
const muted = "#718096";
const soft = "#F7FAFC";

export default function AuthRedirectScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/profile");
    }, 350);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={navy} />
      <Text style={styles.title}>Conectando con Google…</Text>
      <Text style={styles.subtitle}>Volviendo a ShopX.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
    backgroundColor: soft,
  },
  title: {
    color: navy,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: muted,
    fontSize: 14,
    textAlign: "center",
  },
});
