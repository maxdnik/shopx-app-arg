import { Feather } from "@expo/vector-icons";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { formatUSD } from "../lib/api";
import { PriceRow, summarizePrices } from "../lib/price-summary";

export function PriceSummary({ rows }: { rows: PriceRow[] }) {
  return (
    <View style={{ gap: 13 }}>
      {summarizePrices(rows).map((row) => (
        <View key={row.key} style={styles.row}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Detalle de ${row.label}`}
            style={styles.label}
            onPress={() =>
              Alert.alert(
                row.label,
                row.details
                  .map(
                    (detail) =>
                      `${detail.label}: USD ${formatUSD(detail.amount)}`,
                  )
                  .join("\n"),
              )
            }
          >
            <Text style={styles.text}>{row.label}</Text>
            <Feather name="info" size={15} color="#718096" />
          </TouchableOpacity>
          <Text style={styles.amount}>USD {formatUSD(row.amount)}</Text>
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  label: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  text: { color: "#53677D", fontSize: 13, flexShrink: 1 },
  amount: { fontSize: 13, color: "#062B4F", fontWeight: "700" },
});
