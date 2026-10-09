import { useState, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Alert, Linking, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { AppOrder } from "../lib/orders";
import { currentShipmentState, localDeliveryLabel, localDeliveryRows, type LocalDeliveryRow } from "../lib/order-tracking/detail-shipping";
import { isCorreoArgentino } from "../lib/order-tracking/local-tracking";
import { localRegistrationDate } from "../lib/order-tracking/local-registration";
import { dateLabel, etaHint, etaText, isDirectOrder, publicTrackingUrl, purchaseComplete, shipmentLabel, stageDate, stageOf, validInbound, type DeliveryRow } from "../lib/order-tracking/view-model";

type Icon = ComponentProps<typeof Feather>["name"];
const navy = "#062B4F", teal = "#087F91", muted = "#596B82", border = "#DFE7EF";

async function openTracking(url: string) {
  try { await Linking.openURL(url); }
  catch { Alert.alert("No pudimos abrir el seguimiento", "Volvé a intentar en unos segundos."); }
}

function TrackingNumber({ number }: { number: string }) {
  return <View style={s.trackingRow}>
    <View style={s.flex}>
      <Text selectable style={s.tracking}>{number || "Todavía no informado"}</Text>
      {number ? <Text style={s.small}>Mantené presionado para copiar.</Text> : null}
    </View>
    {number ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Compartir seguimiento ${number}`} style={s.iconButton} onPress={async () => {
      try { await Share.share({ message: number }); }
      catch { Alert.alert("Seguimiento", "Mantené presionado el número para copiarlo."); }
    }}><Feather name="share-2" size={18} color={teal} /></TouchableOpacity> : null}
  </View>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text>{typeof children === "string" ? <Text style={s.value}>{children}</Text> : children}</View>;
}

function Accordion({ title, description, children, initiallyOpen = false }: { title: string; description?: string; children: ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <View>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={title} activeOpacity={0.8} style={s.accordion} onPress={() => setOpen(value => !value)}>
      <View style={s.flex}><Text style={s.heading}>{title}</Text>{description ? <Text style={s.text}>{description}</Text> : null}</View>
      <Feather name={open ? "chevron-up" : "chevron-down"} size={20} color={navy} />
    </TouchableOpacity>
    {open ? <View style={s.accordionBody}>{children}</View> : null}
  </View>;
}

function Step({ title, description, icon, done, active, date, children, last = false }: { title?: string; description?: string; icon: Icon; done?: boolean; active?: boolean; date?: string | null; children?: ReactNode; last?: boolean }) {
  return <View style={s.step}>
    <View style={s.rail}>
      <View style={[s.marker, done && s.markerDone, active && !done && s.markerActive]}>
        <Feather name={done ? "check" : icon} size={16} color={done ? "#FFF" : active ? teal : muted} />
      </View>
      {!last ? <View style={[s.line, done && s.lineDone]} /> : null}
    </View>
    <View style={s.stepContent}>
      {title ? <Text style={[s.heading, !done && !active && s.pending]}>{title}</Text> : null}
      {description ? <Text style={s.text}>{description}</Text> : null}
      {date ? <Text style={s.date}>{dateLabel(date, true)}</Text> : null}
      {children}
    </View>
  </View>;
}

function PackageRoute({ labels, completed }: { labels: string[]; completed: number }) {
  return <View style={s.route} accessibilityLabel="Etapas registradas del envío, no ubicación en tiempo real">
    {labels.map((label, i) => <View key={label} style={s.routeStop}>
      <View style={[s.routeBar, i <= completed && s.routeBarDone]} />
      <Text style={[s.small, i <= completed && s.routeReached]}>{label}</Text>
    </View>)}
  </View>;
}

function UsaShipment({ row }: { row: DeliveryRow }) {
  const valid = validInbound(row);
  const moving = valid && ["shipped", "in_transit", "out_for_delivery", "delivered"].includes(row.status);
  const href = valid ? publicTrackingUrl(row.carrier, row.number) : "";
  return <View style={s.shipment}>
    <Text style={s.heading}>{row.itemIndex === null ? "Seguimiento general de la orden" : row.title}</Text>
    <Field label="Tienda">{row.store || "No informada"}</Field>
    <Field label="Transportista">{row.carrier || "Por confirmar"}</Field>
    <Field label="N.º de seguimiento"><TrackingNumber number={row.number} /></Field>
    <View style={[s.notice, !valid && s.warning]}>
      <Text style={s.label}>Última novedad</Text>
      <Text style={s.value}>{shipmentLabel(row)}</Text>
      {row.eventAt ? <Text style={s.small}>{dateLabel(row.eventAt, true, !row.direct)} · {row.direct ? "Argentina" : "Miami"}</Text> : null}
      {row.checkedAt ? <Text style={s.small}>Consultado: {dateLabel(row.checkedAt, true, !row.direct)} · {row.direct ? "Argentina" : "Miami"}</Text> : null}
      {row.review ? <Text style={s.text}>Estamos verificando la información de este paquete.</Text> : null}
      {row.direct ? <Text style={s.text}>Este envío va directo a Argentina y no pasa por el depósito de Miami.</Text> : null}
    </View>
    <Field label={row.direct ? "Destino del envío" : row.confirmedMiami ? "Recibido en Miami" : "Llegada estimada a depósito Miami"}>
      <Text style={s.value}>{row.direct ? "Argentina" : row.confirmedMiami ? dateLabel(row.deliveredAt, false, true) || "Recepción confirmada" : row.refunded ? "No aplica" : etaText(row.eta, row.etaEnd)}</Text>
      <Text style={s.small}>{row.confirmedMiami ? "Según seguimiento del paquete" : row.direct || row.refunded ? shipmentLabel(row) : etaHint(row.eta, row.etaEnd)}</Text>
    </Field>
    {valid ? <PackageRoute labels={["Tienda en USA", "Tránsito en USA", row.status === "delivered" && !row.confirmedMiami ? "Miami: recepción por confirmar" : "Depósito Miami"]} completed={row.confirmedMiami ? 2 : moving ? 1 : -1} /> : null}
    {href ? <TouchableOpacity accessibilityRole="link" style={s.linkButton} onPress={() => void openTracking(href)}>
      <Text style={s.link}>Ver seguimiento completo</Text><Feather name="external-link" size={16} color={teal} />
    </TouchableOpacity> : <Text style={s.small}>{row.number && valid ? "El transportista aún no ofrece un enlace público de seguimiento." : "Las novedades aparecerán cuando estén informadas."}</Text>}
  </View>;
}

function LocalMovements({ row }: { row: LocalDeliveryRow }) {
  if (!isCorreoArgentino(row.carrier)) return null;
  const tracking = row.localTracking;
  return <View style={s.movements}>
    <Text style={s.heading}>Movimientos de Correo Argentino</Text>
    <Text style={s.small}>{tracking?.deliveredAt ? "Entrega confirmada por Correo Argentino." : "Actualización diaria mientras tu envío esté pendiente de entrega."}</Text>
    {tracking?.syncedAt ? <Text style={s.small}>Última actualización: {localRegistrationDate(tracking.syncedAt)}</Text> : null}
    {tracking?.lastError ? <Text style={s.warningText}>{tracking.lastError === "missing_product_prefix" ? "Estamos completando los datos de seguimiento de este envío." : `No pudimos actualizar la consulta más reciente. ${tracking.events.length ? "Se conserva el último historial disponible." : "Los movimientos aparecerán cuando Correo Argentino los informe."}`}</Text> : null}
    {tracking?.events.length ? <Accordion title={`Ver movimientos (${tracking.events.length})`} description="Del más reciente al más antiguo">
      {tracking.events.map((event, index) => <View key={`${event.date}-${index}`} style={s.event}>
        <Text style={s.date}>{localRegistrationDate(event.date)}</Text>
        <Text style={s.value}>{event.event}</Text>
        <Text style={s.text}>Planta: {event.branch || "No informada"}</Text>
        {event.status ? <Text style={s.text}>Estado: {event.status}</Text> : null}
      </View>)}
    </Accordion> : !tracking?.lastError ? <Text style={s.text}>Todavía no hay movimientos disponibles para este envío.</Text> : null}
    <TouchableOpacity accessibilityRole="link" style={s.linkButton} onPress={() => void openTracking("https://www.correoargentino.com.ar/formularios/ondnc")}>
      <Text style={s.link}>Ver en Correo Argentino</Text><Feather name="external-link" size={16} color={teal} />
    </TouchableOpacity>
  </View>;
}

function LocalShipment({ row, order }: { row: LocalDeliveryRow; order: AppOrder }) {
  const delivered = row.status === "delivered" || Boolean(row.localTracking?.deliveredAt);
  const latest = row.localTracking?.events[0];
  const dispatched = row.status === "shipped" || delivered;
  return <View style={s.shipment}>
    <Text style={s.heading}>{row.title}</Text>
    {row.products.map((product, index) => <Text key={index} style={s.text}>{product}</Text>)}
    <Field label="Correo">{row.carrier || "Por confirmar"}</Field>
    <Field label="N.º de seguimiento"><TrackingNumber number={row.number} /></Field>
    <Field label="Estado del envío">{delivered ? "Entregado" : latest?.status || latest?.event || localDeliveryLabel(row.status)}</Field>
    <Field label="Despacho registrado">{localRegistrationDate(row.dispatchedAt) || "Fecha y hora no registradas"}</Field>
    {row.status === "delivered" ? <Field label="Entrega registrada">{localRegistrationDate(row.deliveredAt) || "Fecha y hora no registradas"}</Field> : null}
    <Field label="Dirección de entrega">
      <Text style={s.value}>{order.buyer?.address || "No informada"}</Text>
      <Text style={s.text}>{[order.buyer?.city, order.buyer?.province, order.buyer?.postalCode].filter(Boolean).join(" · ")}</Text>
    </Field>
    <PackageRoute labels={["Correo local", "En camino a tu domicilio", delivered ? "Entrega confirmada" : "Entrega pendiente"]} completed={delivered ? 2 : dispatched ? 1 : -1} />
    <LocalMovements row={row} />
  </View>;
}

function partialLabel(status: string) {
  return ({ in_miami_warehouse: "Preparado en Miami", in_transit: "Volando a Argentina", arrived_argentina: "Arribado a Argentina", arrived_in_argentina: "Arribado a Argentina", shipped: "En camino a tu domicilio", delivered: "Entregado", incident: "En revisión", cancelled: "Reprogramado" } as Record<string, string>)[status] || "En preparación";
}

function PartialShipments({ order }: { order: AppOrder }) {
  if (!order.partialShipments?.length) return null;
  return <View style={s.card}>
    <Text style={s.title}>Envíos parciales</Text>
    <Text style={s.text}>Tu compra puede llegar en varios envíos. Consultá los productos y el avance de cada uno.</Text>
    {order.partialShipments.map(shipment => <View key={shipment.id} style={s.shipment}>
      <Accordion title={`Envío ${shipment.sequence}${shipment.code ? ` · ${shipment.code}` : ""}`} description={partialLabel(shipment.status)}>
        {shipment.itemIndexes.map(index => order.items[index] ? <Text key={index} style={s.value}>{order.items[index].qty} × {order.items[index].title}</Text> : null)}
        {shipment.usaTrackingNumber ? <Field label="Seguimiento USA"><TrackingNumber number={shipment.usaTrackingNumber} /></Field> : null}
        {shipment.localCourierName ? <Field label="Correo local">{shipment.localCourierName}</Field> : null}
        {shipment.localTrackingNumber ? <Field label="Seguimiento local"><TrackingNumber number={shipment.localTrackingNumber} /></Field> : null}
        {shipment.history?.length ? [...shipment.history].reverse().map((event, index) => <View style={s.event} key={index}>
          <Text style={s.value}>{event.label || partialLabel(event.status || "")}</Text>
          {event.description ? <Text style={s.text}>{event.description}</Text> : null}
          {event.date ? <Text style={s.date}>{localRegistrationDate(event.date)}</Text> : null}
        </View>) : <Text style={s.text}>El historial aparecerá cuando se registren movimientos.</Text>}
      </Accordion>
    </View>)}
  </View>;
}

const stages: { stage: number; title: string; icon: Icon; done: string; pending: string }[] = [
  { stage: 3, title: "Recibido en depósito Miami", icon: "home", done: "Tu paquete llegó a nuestro depósito en Miami.", pending: "Recibiremos tu paquete en el depósito de Miami." },
  { stage: 4, title: "Vuelo a Argentina", icon: "navigation", done: "Tu paquete fue enviado desde Miami hacia Argentina.", pending: "Tu paquete viajará desde Miami hacia Argentina." },
  { stage: 5, title: "Arribado a Argentina", icon: "package", done: "Tu paquete llegó al país para su recepción y gestión local.", pending: "Tu paquete llegará al país para su recepción y gestión local." },
  { stage: 6, title: "Envío local", icon: "truck", done: "Tu pedido fue despachado hacia tu domicilio.", pending: "Tu pedido será despachado hacia tu domicilio." },
  { stage: 7, title: "Entregado", icon: "check", done: "Tu pedido fue entregado en el domicilio indicado.", pending: "Tu pedido será entregado en el domicilio indicado." },
];

export function OrderShipments({ order, onRefresh, refreshing = false }: { order: AppOrder; onRefresh?: () => void; refreshing?: boolean }) {
  const stage = stageOf(order), purchased = purchaseComplete(order), direct = isDirectOrder(order);
  const current = currentShipmentState(order), localRows = localDeliveryRows(order);
  const purchaseCount = order.delivery?.purchases.filter(item => item.purchased || item.at).length || 0;
  const rows = order.delivery?.rows || [];
  return <>
    <View style={s.currentCard}>
      <Feather name={current.icon === "check" ? "check-circle" : current.icon === "alert" ? "alert-circle" : "package"} size={24} color={teal} />
      <View style={s.flex}>
        <Text style={s.label}>Estado actual del envío</Text>
        <Text style={s.currentTitle}>{current.label}</Text>
        {current.at ? <Text style={s.text}>{dateLabel(current.at, true, current.miamiTime)}{current.miamiTime ? " · Miami" : " · Argentina"}</Text> : null}
      </View>
    </View>
    <View style={s.card}>
      <View style={s.sectionHeader}>
        <Text style={[s.title, s.flex]}>Seguimiento de tu envío</Text>
        {onRefresh ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Actualizar seguimiento" accessibilityState={{ disabled: refreshing }} disabled={refreshing} style={s.iconButton} onPress={onRefresh}>
          {refreshing ? <ActivityIndicator color={teal} /> : <Feather name="refresh-cw" size={20} color={teal} />}
        </TouchableOpacity> : null}
      </View>
      <Text style={s.text}>{order.partialShipments?.length ? "El estado general avanza cuando todos los envíos alcanzan cada etapa. Más abajo podés ver cada envío por separado." : "Seguí tu compra desde Estados Unidos hasta tu domicilio en Argentina."}</Text>
      {stage === -1 ? <Text style={s.warningText}>La orden está cancelada. El historial disponible se conserva como referencia.</Text> : null}
      {order.status === "pending_payment" ? <Text style={s.warningText}>El seguimiento avanzará después de la confirmación del pago y la compra en USA.</Text> : null}
      <View style={s.timeline}>
        <Step title="Compra confirmada" icon="shopping-bag" done={purchased} active={!purchased && stage >= 0} date={purchased ? stageDate(order, 1) : null} description={purchased ? "Tu compra fue confirmada en la tienda de Estados Unidos." : purchaseCount > 0 ? `${purchaseCount} de ${order.items.length} productos comprados en USA.` : "Te avisaremos cuando confirmemos la compra en la tienda de USA."} />
        <Step icon="truck" done={stage >= 3} active={stage === 2}>
          <Accordion title={direct ? "Envío directo a Argentina" : "Tránsito en USA"} description={direct ? "Consultá el transportista y las novedades del envío directo." : stage >= 3 ? "Consultá la información registrada del trayecto hasta Miami." : stage === 2 ? "Tu compra está en camino a nuestro depósito en Miami." : "Acá verás el despacho, el transportista y las novedades de cada paquete."}>
            {rows.length ? rows.map(row => <UsaShipment key={row.key} row={row} />) : <Text style={s.text}>Todavía no hay movimientos de tránsito en USA informados para esta orden.</Text>}
          </Accordion>
        </Step>
        {stages.filter(step => !direct || step.stage === 7 || (step.stage === 6 && localRows.length > 0)).map(step => (
          <Step key={step.stage} icon={step.icon} done={stage >= step.stage} active={stage === step.stage} last={step.stage === 7}
            title={step.stage === 6 && localRows.length ? undefined : step.title}
            description={step.stage === 6 && localRows.length ? undefined : stage >= step.stage ? step.done : step.pending}
            date={stage >= step.stage && !(step.stage === 6 && localRows.length) ? stageDate(order, step.stage) : null}>
            {step.stage === 6 && localRows.length ? <Accordion title="Envío local" description="Ampliá para ver el correo, el seguimiento y los movimientos de tu envío en Argentina.">
              {localRows.map(row => <LocalShipment key={row.key} row={row} order={order} />)}
            </Accordion> : null}
          </Step>
        ))}
      </View>
      {order.tracking?.lastUpdatedAt ? <Text style={s.small}>Última actualización de la orden: {dateLabel(order.tracking.lastUpdatedAt, true)}</Text> : null}
      {order.tracking?.history?.length ? <Accordion title="Historial de la orden">
        {[...order.tracking.history].reverse().map((event, index) => <View key={index} style={s.event}>
          <Text style={s.value}>{event.label || "Actualización ShopX"}</Text>
          {event.description ? <Text style={s.text}>{event.description}</Text> : null}
          {event.date ? <Text style={s.date}>{dateLabel(event.date, true)}</Text> : null}
        </View>)}
      </Accordion> : null}
    </View>
    <PartialShipments order={order} />
  </>;
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { marginHorizontal: 18, marginTop: 18, backgroundColor: "#FFF", padding: 18, borderRadius: 22, borderWidth: 1, borderColor: border, gap: 12 },
  currentCard: { marginHorizontal: 18, marginTop: 18, backgroundColor: "#EAF8FA", padding: 18, borderRadius: 20, gap: 14, flexDirection: "row", alignItems: "center" },
  currentTitle: { color: navy, fontSize: 21, fontWeight: "800", marginTop: 3 },
  title: { fontSize: 21, fontWeight: "800", color: navy },
  heading: { color: navy, fontWeight: "700", fontSize: 16, lineHeight: 22 },
  text: { color: muted, fontSize: 14, lineHeight: 21 },
  small: { color: muted, fontSize: 12, lineHeight: 18 },
  date: { color: teal, fontSize: 12, lineHeight: 18, marginTop: 4 },
  label: { color: muted, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  value: { color: navy, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  field: { gap: 3 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  accordion: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48 },
  accordionBody: { gap: 12, paddingTop: 12 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  timeline: { marginTop: 8 },
  step: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center", width: 32 },
  marker: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: border },
  markerDone: { backgroundColor: teal, borderColor: teal },
  markerActive: { backgroundColor: "#E5F8FA", borderColor: teal, borderWidth: 2 },
  line: { width: 2, backgroundColor: border, flex: 1, minHeight: 18 },
  lineDone: { backgroundColor: "#A0DDE3" },
  stepContent: { flex: 1, minWidth: 0, paddingTop: 4, paddingBottom: 25, gap: 4 },
  pending: { color: muted },
  shipment: { backgroundColor: "#F6F9FC", borderWidth: 1, borderColor: border, borderRadius: 14, padding: 12, gap: 12 },
  trackingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  tracking: { color: navy, fontSize: 14, fontWeight: "700", lineHeight: 21 },
  notice: { borderRadius: 10, padding: 10, backgroundColor: "#EAF8FA", gap: 4 },
  warning: { backgroundColor: "#FFF7E6" },
  warningText: { backgroundColor: "#FFF7E6", color: "#854D0E", padding: 10, borderRadius: 10, fontSize: 13, lineHeight: 20 },
  link: { color: teal, fontWeight: "700", fontSize: 13, flexShrink: 1 },
  linkButton: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  route: { flexDirection: "row", gap: 5, paddingTop: 4 },
  routeStop: { flex: 1, gap: 7 },
  routeBar: { height: 3, borderRadius: 2, backgroundColor: border },
  routeBarDone: { backgroundColor: teal },
  routeReached: { color: teal, fontWeight: "600" },
  movements: { borderTopWidth: 1, borderColor: border, paddingTop: 14, gap: 8 },
  event: { borderLeftWidth: 2, borderColor: "#A0DDE3", paddingLeft: 10, paddingVertical: 4, gap: 3 },
});
