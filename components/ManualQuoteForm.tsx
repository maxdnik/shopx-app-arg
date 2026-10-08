import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { createManualProduct, type ManualQuoteProduct } from "../lib/quote-manual";
import { isValidQuotePostalCode, normalizeQuotePostalCode } from "../lib/quote-postal-code";

type Props = {
  products: ManualQuoteProduct[];
  onProductsChange: (products: ManualQuoteProduct[]) => void;
  postalCode: string;
  onPostalCodeChange: (value: string) => void;
  signedIn: boolean;
  loading: boolean;
  message: string;
  onLogin: () => void;
  onSubmit: () => void;
};

export function ManualQuoteForm({ products, onProductsChange, postalCode, onPostalCodeChange, signedIn, loading, message, onLogin, onSubmit }: Props) {
  const update = (id: string, field: keyof ManualQuoteProduct, value: string) => {
    onProductsChange(products.map(product => product.id === id ? { ...product, [field]: value } : product));
  };
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.heading}>Solicitá tu cotización</Text>
    <Text style={s.text}>{message}</Text>
    {!signedIn && <View style={s.notice}>
      <Text style={s.text}>Ingresá a tu cuenta para recibir la cotización. Conservamos los datos que completes.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={onLogin} disabled={loading}><Text style={s.link}>Iniciar sesión o crear cuenta →</Text></TouchableOpacity>
    </View>}
    <Text style={s.label}>Código postal de entrega en Argentina *</Text>
    <TextInput accessibilityLabel="Código postal de entrega en Argentina" value={postalCode} onChangeText={value => onPostalCodeChange(normalizeQuotePostalCode(value))} placeholder="Ej. 1425 o C1425ABC" autoCapitalize="characters" autoCorrect={false} maxLength={8} editable={!loading} style={s.input} />
    <Text style={s.help}>Ingresá 4 números o el CPA completo. Lo necesitamos para calcular la entrega.</Text>
    {products.map((product, index) => <View key={product.id} style={s.product}>
      <View style={s.row}>
        <Text style={s.label}>Producto {index + 1}</Text>
        {products.length > 1 && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Quitar producto ${index + 1}`} disabled={loading} onPress={() => onProductsChange(products.filter(item => item.id !== product.id))}><Feather name="trash-2" size={20} color="#B42318" /></TouchableOpacity>}
      </View>
      <TextInput accessibilityLabel={`Link del producto ${index + 1}`} value={product.productUrl} onChangeText={value => update(product.id, "productUrl", value)} placeholder="Link del producto *" autoCapitalize="none" autoCorrect={false} keyboardType="url" multiline editable={!loading} style={s.input} />
      <TextInput accessibilityLabel={`Nombre del producto ${index + 1}`} value={product.productName} onChangeText={value => update(product.id, "productName", value)} placeholder="Producto o modelo (opcional)" editable={!loading} style={s.input} />
      <View style={s.row}>
        <TextInput accessibilityLabel={`Talle del producto ${index + 1}`} value={product.size} onChangeText={value => update(product.id, "size", value)} placeholder="Talle (opcional)" editable={!loading} style={[s.input, s.flex]} />
        <TextInput accessibilityLabel={`Color del producto ${index + 1}`} value={product.color} onChangeText={value => update(product.id, "color", value)} placeholder="Color (opcional)" editable={!loading} style={[s.input, s.flex]} />
      </View>
      <View style={s.row}>
        <Text style={s.label}>Cantidad</Text>
        <View style={s.quantity}>
          {[1, 2, 3].map(quantity => <TouchableOpacity key={quantity} accessibilityRole="button" accessibilityLabel={`${quantity} unidades del producto ${index + 1}`} accessibilityState={{ selected: Number(product.quantity) === quantity }} disabled={loading} onPress={() => update(product.id, "quantity", String(quantity))} style={[s.quantityOption, Number(product.quantity) === quantity && s.selected]}><Text style={[s.quantityText, Number(product.quantity) === quantity && { color: "white" }]}>{quantity}</Text></TouchableOpacity>)}
        </View>
      </View>
      <TextInput accessibilityLabel={`Detalles del producto ${index + 1}`} value={product.specs} onChangeText={value => update(product.id, "specs", value)} placeholder="Detalles o especificaciones (opcional)" multiline editable={!loading} style={s.input} />
    </View>)}
    {products.length < 10 && <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={() => onProductsChange([...products, createManualProduct()])} style={s.add}><Feather name="plus" size={18} color="#087F91" /><Text style={s.link}>Agregar otro producto</Text></TouchableOpacity>}
    {signedIn && <TouchableOpacity accessibilityRole="button" onPress={onSubmit} disabled={loading || !isValidQuotePostalCode(postalCode)} style={[s.button, (loading || !isValidQuotePostalCode(postalCode)) && { opacity: 0.5 }]}><Text style={s.buttonText}>{loading ? "Enviando solicitud…" : "Enviar solicitud de cotización"}</Text><Feather name="arrow-right" size={18} color="#062B4F" /></TouchableOpacity>}
  </View>;
}

const s = StyleSheet.create({
  card: { padding: 18, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "white", borderRadius: 20, gap: 14 },
  heading: { color: "#062B4F", fontWeight: "800", fontSize: 21 },
  label: { color: "#062B4F", fontWeight: "700", fontSize: 14, flexShrink: 1 },
  text: { color: "#617590", fontSize: 13, lineHeight: 20 },
  help: { color: "#617590", fontSize: 12, lineHeight: 18 },
  input: { backgroundColor: "#F3F6FA", color: "#062B4F", padding: 14, borderRadius: 12, minHeight: 48 },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  product: { borderTopWidth: 1, borderColor: "#E2E8F0", paddingTop: 16, gap: 12 },
  notice: { backgroundColor: "#EAFBFD", padding: 14, borderRadius: 14, gap: 12 },
  link: { color: "#087F91", fontSize: 14, fontWeight: "700" },
  add: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  quantity: { flexDirection: "row", gap: 8 },
  quantityOption: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F3F6FA", alignItems: "center", justifyContent: "center" },
  selected: { backgroundColor: "#087F91" },
  quantityText: { color: "#062B4F", fontWeight: "700", fontSize: 16 },
  button: { backgroundColor: "#22D3EE", borderRadius: 14, padding: 16, flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" },
  buttonText: { color: "#062B4F", fontWeight: "800", fontSize: 15, flexShrink: 1 },
});
