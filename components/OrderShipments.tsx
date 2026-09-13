import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { AppOrder } from "../lib/orders";
function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}
export function OrderShipments({ order }: { order: AppOrder }) {
  return (
    <View style={s.card}>
      <Text style={s.title}>Seguimiento por producto</Text>
      {order.items.map((item, index) => (
        <View key={`${item.productId}-${index}`} style={s.item}>
          <Text style={s.heading}>{item.title}</Text>
          {Object.entries(item.selections || {}).map(([key, value]) => (
            <Text key={key} style={s.text}>
              {key}: {String(value)}
            </Text>
          ))}
          {item.inboundShipments?.length ? (
            item.inboundShipments.map((shipment: any, i: number) => (
              <View key={shipment.key || i} style={s.shipment}>
                <Text style={s.label}>
                  {shipment.deliveredToFastTrack
                    ? "Entregado a Fast Track · Miami"
                    : shipment.statusDetail ||
                      shipment.status ||
                      "Seguimiento informado"}
                </Text>
                {!!shipment.carrier && (
                  <Text style={s.text}>{shipment.carrier}</Text>
                )}
                {!!shipment.trackingNumber && (
                  <Text selectable style={s.tracking}>
                    {shipment.trackingNumber}
                  </Text>
                )}
                {!!shipment.estimatedDeliveryAt && (
                  <Text style={s.text}>
                    Entrega estimada en Miami:{" "}
                    {new Date(shipment.estimatedDeliveryAt).toLocaleDateString(
                      "es-AR",
                    )}
                  </Text>
                )}
                {!!shipment.deliveredAt && (
                  <Text style={s.text}>
                    Entrega registrada:{" "}
                    {new Date(shipment.deliveredAt).toLocaleDateString("es-AR")}
                  </Text>
                )}
                {safeUrl(shipment.trackingUrl || "") && (
                  <TouchableOpacity
                    onPress={() =>
                      Linking.openURL(safeUrl(shipment.trackingUrl))
                    }
                  >
                    <Text style={s.link}>Consultar transportista →</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <Text style={s.text}>
              El seguimiento de origen aparecerá cuando esté informado.
            </Text>
          )}
        </View>
      ))}
      {!!order.partialShipments?.length && (
        <>
          <Text style={s.title}>Entregas parciales</Text>
          {order.partialShipments.map((shipment) => (
            <View style={s.shipment} key={shipment.id || shipment.code}>
              <Text style={s.heading}>
                {shipment.code || `Envío ${shipment.sequence}`}
              </Text>
              <Text style={s.label}>{shipment.status}</Text>
              {shipment.itemIndexes.map((index) =>
                order.items[index] ? (
                  <Text key={index} style={s.text}>
                    {order.items[index].title}
                  </Text>
                ) : null,
              )}
              {!!shipment.localCourierName && (
                <Text style={s.text}>{shipment.localCourierName}</Text>
              )}
              {!!shipment.localTrackingNumber && (
                <Text selectable style={s.tracking}>
                  {shipment.localTrackingNumber}
                </Text>
              )}
              {shipment.history?.map((event, index) => (
                <Text key={index} style={s.text}>
                  {event.date
                    ? `${new Date(event.date).toLocaleDateString("es-AR")} · `
                    : ""}
                  {event.label || event.status}
                </Text>
              ))}
            </View>
          ))}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginTop: 18,
    backgroundColor: "#FFF",
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 14,
  },
  title: { fontSize: 21, fontWeight: "800", color: "#062B4F" },
  item: { gap: 8, borderTopWidth: 1, borderColor: "#E2E8F0", paddingTop: 14 },
  heading: { color: "#062B4F", fontWeight: "700", fontSize: 15 },
  shipment: {
    backgroundColor: "#F3F8FC",
    borderRadius: 12,
    padding: 12,
    gap: 7,
  },
  label: { color: "#087F91", fontWeight: "700", fontSize: 13 },
  text: { color: "#617590", fontSize: 13, lineHeight: 20 },
  tracking: { color: "#062B4F", fontSize: 14, fontWeight: "700" },
  link: { color: "#087F91", fontWeight: "700", paddingVertical: 5 },
});
