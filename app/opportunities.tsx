import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { OpportunityCard } from "../components/OpportunityCard";
import { getOpportunities, type OpportunitiesPage, type OpportunitySort } from "../lib/opportunities";

const sorts: { value: OpportunitySort; label: string }[] = [
  { value: "destacadas", label: "Destacadas" }, { value: "ahorro", label: "Mayor ahorro" },
  { value: "porcentaje", label: "Mayor porcentaje" }, { value: "precio", label: "Menor precio" },
];

export default function OpportunitiesScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columns = width >= 650 ? 2 : 1;
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<OpportunitySort>("destacadas");
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState<OpportunitiesPage>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  const paginationRequest = useRef<number | null>(null);

  useEffect(() => {
    const id = ++generation.current;
    paginationRequest.current = null;
    const controller = new AbortController();
    setLoading(true); setLoadingMore(false); setError(""); setPage(undefined);
    void getOpportunities({ query, category, sort }, controller.signal).then(value => {
      if (id === generation.current) { setPage(value); setCategories(value.categories); }
    }).catch(() => { if (id === generation.current && !controller.signal.aborted) setError("No pudimos cargar las oportunidades. Volvé a intentar."); })
      .finally(() => { if (id === generation.current) setLoading(false); });
    return () => { controller.abort(); generation.current = id + 1; };
  }, [query, category, sort, reload]);

  async function more() {
    if (!page || page.page >= page.pageCount || loading || loadingMore || paginationRequest.current !== null) return;
    const id = generation.current;
    paginationRequest.current = id;
    setLoadingMore(true); setError("");
    try {
      const next = await getOpportunities({ query, category, sort, page: page.page + 1 });
      if (id === generation.current) setPage(previous => {
        const seen = new Set(previous?.items.map(item => item.id));
        return { ...next, items: [...(previous?.items || []), ...next.items.filter(item => !seen.has(item.id))] };
      });
    } catch { if (id === generation.current) setError("No pudimos cargar más oportunidades."); }
    finally {
      if (paginationRequest.current === id) paginationRequest.current = null;
      if (id === generation.current) setLoadingMore(false);
    }
  }

  const submit = () => { Keyboard.dismiss(); setQuery(input.trim()); };
  return <View style={s.app}>
    <FlatList key={columns} data={page?.items || []} numColumns={columns} keyExtractor={item => item.id}
      style={s.list} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }}
      refreshing={loading && !!page} onRefresh={() => setReload(value => value + 1)} keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => <View style={[s.item, columns === 2 && { width: "50%", paddingHorizontal: 6 }]}><OpportunityCard opportunity={item} /></View>}
      ListHeaderComponent={<View style={s.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver" style={s.back} onPress={() => router.back()}><Feather name="chevron-left" size={24} color="#082A49" /><Text style={s.backLabel}>Volver</Text></TouchableOpacity>
        <Text accessibilityRole="header" style={s.title}>Oportunidades ShopX</Text>
        <View style={s.search}><TextInput accessibilityLabel="Buscar oportunidades" placeholder="Buscar marca o producto" placeholderTextColor="#617590" value={input} onChangeText={setInput} onSubmitEditing={submit} returnKeyType="search" style={s.input} />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Buscar" onPress={submit} style={s.icon}><Feather name="search" size={22} color="#082A49" /></TouchableOpacity></View>
        <View style={s.filterRow}><Text style={s.count}>{page ? `${page.total.toLocaleString("es-AR")} oportunidades` : ""}</Text><TouchableOpacity accessibilityRole="button" style={s.filter} onPress={() => setFilterOpen(true)}><Feather name="sliders" size={17} color="#087C91" /><Text style={s.filterLabel}>Filtrar y ordenar</Text></TouchableOpacity></View>
        {!!category && <TouchableOpacity accessibilityRole="button" onPress={() => setCategory("")}><Text style={s.filterLabel}>{category} ×</Text></TouchableOpacity>}
        {loading ? <ActivityIndicator size="large" color="#087C91" style={{ padding: 32 }} /> : null}
        {!loading && page?.total === 0 ? <Text style={s.notice}>No encontramos oportunidades con esos filtros.</Text> : null}
      </View>}
      ListFooterComponent={<View style={s.footer}>
        {!!error && <TouchableOpacity accessibilityRole="button" onPress={() => page?.items.length ? void more() : setReload(value => value + 1)}><Text style={s.notice}>{error} Tocá para reintentar.</Text></TouchableOpacity>}
        {!loading && page && page.page < page.pageCount ? <TouchableOpacity accessibilityRole="button" style={s.more} onPress={() => { void more(); }} disabled={loadingMore}>{loadingMore ? <ActivityIndicator color="#082A49" /> : <Text style={s.moreText}>Ver más oportunidades</Text>}</TouchableOpacity> : null}
      </View>} />
    <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
      <View style={s.modal}><TouchableOpacity style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cerrar filtros" onPress={() => setFilterOpen(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}><View style={s.filterRow}><Text style={s.sheetTitle}>Filtrar y ordenar</Text><TouchableOpacity style={s.icon} accessibilityRole="button" accessibilityLabel="Cerrar filtros" onPress={() => setFilterOpen(false)}><Feather name="x" size={24} color="#082A49" /></TouchableOpacity></View>
          <ScrollView><Text style={s.section}>Ordenar</Text><View style={s.options}>{sorts.map(option => <TouchableOpacity key={option.value} accessibilityRole="button" accessibilityState={{ selected: sort === option.value }} style={[s.chip, sort === option.value && s.selected]} onPress={() => setSort(option.value)}><Text style={s.chipLabel}>{option.label}</Text></TouchableOpacity>)}</View>
            <Text style={s.section}>Categoría</Text><View style={s.options}>{["", ...categories, ...(category && !categories.includes(category) ? [category] : [])].map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: category === value }} style={[s.chip, category === value && s.selected]} onPress={() => setCategory(value)}><Text style={s.chipLabel}>{value || "Todas"}</Text></TouchableOpacity>)}</View></ScrollView>
          <TouchableOpacity accessibilityRole="button" style={s.more} onPress={() => setFilterOpen(false)}><Text style={s.moreText}>Ver resultados</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
    <AppBottomNav />
  </View>;
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#F7FAFC" }, list: { width: "100%", maxWidth: 880, alignSelf: "center" },
  header: { gap: 15, marginBottom: 16 }, back: { minHeight: 40, flexDirection: "row", alignItems: "center" }, backLabel: { color: "#082A49", fontWeight: "700" },
  title: { color: "#082A49", fontSize: 30, fontWeight: "900", letterSpacing: -0.7 }, search: { flexDirection: "row", backgroundColor: "white", borderColor: "#DFE6EF", borderWidth: 1, borderRadius: 14 },
  input: { flex: 1, padding: 14, color: "#082A49", fontSize: 14 }, icon: { width: 46, minHeight: 46, justifyContent: "center", alignItems: "center" },
  filterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }, count: { color: "#617590", fontSize: 12 }, filter: { flexDirection: "row", gap: 8, minHeight: 42, alignItems: "center" }, filterLabel: { fontSize: 12, fontWeight: "700", color: "#087C91" },
  item: { width: "100%", marginBottom: 16 }, notice: { color: "#617590", textAlign: "center", padding: 20, fontSize: 13, lineHeight: 21 },
  more: { borderRadius: 14, padding: 16, alignItems: "center", backgroundColor: "#22D3EE", minHeight: 48 }, moreText: { fontWeight: "800", color: "#082A49", fontSize: 14 }, footer: { gap: 10 },
  modal: { flex: 1, backgroundColor: "rgba(5,25,45,0.5)", justifyContent: "flex-end" }, sheet: { maxHeight: "85%", backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 }, sheetTitle: { fontSize: 20, fontWeight: "800", color: "#082A49" },
  section: { fontSize: 14, fontWeight: "800", color: "#082A49", marginVertical: 12 }, options: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { paddingVertical: 12, paddingHorizontal: 14, backgroundColor: "#F1F5F9", borderRadius: 12, borderWidth: 1, borderColor: "#E3EAF0" }, selected: { backgroundColor: "#DFFAFE", borderColor: "#22BFD3" }, chipLabel: { color: "#082A49", fontSize: 12, fontWeight: "600" },
});
