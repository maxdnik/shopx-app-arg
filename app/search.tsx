import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBottomNav } from "../components/AppBottomNav";
import { formatUSD } from "../lib/api";
import { catalogOfferTarget, CONDITION_LABELS, EMPTY_SEARCH_FACETS, mergeCatalogPages, searchCatalog, type CatalogOffer, type CatalogProduct, type CatalogSearchPage, type FacetValue, type SearchFilters } from "../lib/search";

const sorts: { value: SearchFilters["sort"]; label: string }[] = [
  { value: "relevant", label: "Relevancia" }, { value: "price-asc", label: "Menor precio" },
  { value: "price-desc", label: "Mayor precio" }, { value: "rating", label: "Mejor valoración" },
];
const sourceLabel = (value: string) => ({ shopx: "ShopX", amazon: "Amazon", ebay: "eBay", walmart: "Walmart", other: "Otras tiendas" })[value] || value;

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const insets = useSafeAreaInsets();
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>({ sort: "relevant" });
  const [draftFilters, setDraftFilters] = useState<SearchFilters>({ sort: "relevant" });
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [page, setPage] = useState<CatalogSearchPage>({ products: [], total: 0, cursor: null, facets: EMPTY_SEARCH_FACETS, dynamicFacets: [] });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [paginationError, setPaginationError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [retry, setRetry] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const generation = useRef(0);
  const moreBusy = useRef(false);
  const moreController = useRef<AbortController | null>(null);

  useEffect(() => { setInput(initialQuery); setQuery(initialQuery); setFilters({ sort: "relevant" }); }, [initialQuery]);
  useEffect(() => {
    const id = ++generation.current;
    const controller = new AbortController();
    moreController.current?.abort(); moreBusy.current = false; setLoadingMore(false);
    setError(""); setPaginationError(""); setSelectedProduct(null);
    if (!query.trim()) { setPage({ products: [], total: 0, cursor: null, facets: EMPTY_SEARCH_FACETS, dynamicFacets: [] }); setLoading(false); return; }
    setLoading(true);
    void searchCatalog(query, filters, undefined, controller.signal).then(data => {
      if (id === generation.current) setPage(data);
    }).catch(reason => {
      if (id === generation.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : "No pudimos buscar. Volvé a intentar.");
    }).finally(() => { if (id === generation.current) setLoading(false); });
    return () => { controller.abort(); moreController.current?.abort(); generation.current = id + 1; };
  }, [query, filters, retry]);

  const submit = () => {
    const value = input.trim();
    if (!value) return;
    Keyboard.dismiss();
    if (/^(https?:\/\/|www\.)/i.test(value)) { router.push({ pathname: "/quote", params: { url: value } }); return; }
    setQuery(value); setFilters({ sort: "relevant" });
  };

  async function more() {
    if (!page.cursor || loading || moreBusy.current) return;
    const id = generation.current;
    const controller = new AbortController(); moreController.current = controller;
    moreBusy.current = true; setLoadingMore(true); setPaginationError("");
    try {
      const data = await searchCatalog(query, filters, page.cursor, controller.signal);
      if (id === generation.current) setPage(previous => ({ ...data, products: mergeCatalogPages(previous.products, data.products) }));
    } catch (reason) { if (id === generation.current && !controller.signal.aborted) setPaginationError(reason instanceof Error ? reason.message : "No pudimos cargar más productos."); }
    finally { if (id === generation.current) { moreBusy.current = false; setLoadingMore(false); } }
  }

  function openOffer(product: CatalogProduct, offer: CatalogOffer) {
    const target = catalogOfferTarget(product, offer);
    if (target) { setSelectedProduct(null); router.push(target); }
  }
  function openProduct(product: CatalogProduct) {
    if (product.officialProductSlug) { openOffer(product, product.bestOffer); return; }
    if (product.offers.length === 1) openOffer(product, product.offers[0]);
    else setSelectedProduct(product);
  }
  function openFilters() {
    setDraftFilters({ ...filters, attributes: { ...filters.attributes } }); setMinInput(filters.minPrice ? String(filters.minPrice) : ""); setMaxInput(filters.maxPrice ? String(filters.maxPrice) : "");
    setFilterError(""); setFilterOpen(true);
  }
  function applyFilters() {
    const min = minInput.trim() ? Number(minInput.replace(",", ".")) : undefined;
    const max = maxInput.trim() ? Number(maxInput.replace(",", ".")) : undefined;
    if ([min, max].some(value => value !== undefined && (!Number.isFinite(value) || value < 0)) || (min !== undefined && max !== undefined && min > max)) { setFilterError("Revisá el rango de precios."); return; }
    setFilters({ ...draftFilters, minPrice: min, maxPrice: max }); setFilterOpen(false);
  }
  const filterCount = [filters.brand, filters.store, filters.source, filters.condition, filters.minPrice || filters.maxPrice, ...Object.values(filters.attributes || {})].filter(Boolean).length;
  const facetGroup = (label: string, key: "brand" | "store" | "source" | "condition", values: FacetValue[]) => values.length ? <View key={key} style={s.facet}><Text style={s.sectionTitle}>{label}</Text><View style={s.chips}>{values.map(value => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: draftFilters[key] === value.value }} key={value.value} style={[s.chip, draftFilters[key] === value.value && s.chipSelected]} onPress={() => setDraftFilters(old => ({ ...old, [key]: old[key] === value.value ? undefined : value.value }))}><Text style={s.chipText}>{key === "condition" ? CONDITION_LABELS[value.value] || value.value : key === "source" ? sourceLabel(value.value) : value.value} ({value.count})</Text></TouchableOpacity>)}</View></View> : null;

  return <View style={s.app}>
    <FlatList data={!loading && !error ? page.products : []} keyExtractor={item => item.id} style={s.list}
      contentContainerStyle={{ padding: 18, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 105 }} keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View style={s.header}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} style={s.back}><Feather name="chevron-left" size={23} color="#082A49" /><Text style={s.backText}>Volver</Text></TouchableOpacity>
        <Text accessibilityRole="header" style={s.title}>Buscar en USA</Text>
        <View style={s.search}><TextInput accessibilityLabel="Buscar producto, marca o modelo" value={input} onChangeText={setInput} placeholder="Producto, marca, modelo o link" placeholderTextColor="#718096" style={s.input} returnKeyType="search" onSubmitEditing={submit} autoCorrect={false} />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Buscar" style={s.icon} onPress={submit}><Feather name="search" size={23} color="#082A49" /></TouchableOpacity></View>
        {!!query && <View style={s.resultHeader}><Text style={s.count}>{!loading ? `${page.total} productos` : "Buscando…"}</Text><TouchableOpacity accessibilityRole="button" style={s.filterButton} onPress={openFilters}><Feather name="sliders" size={17} color="#087C91" /><Text style={s.filterText}>Filtros{filterCount ? ` (${filterCount})` : ""}</Text></TouchableOpacity></View>}
        {loading ? <View style={s.notice}><ActivityIndicator color="#087C91" size="large" /><Text style={s.noticeText}>Buscando “{query}”</Text></View> : error ? <View style={s.notice}><Text style={s.noticeText}>{error}</Text><TouchableOpacity accessibilityRole="button" style={s.button} onPress={() => setRetry(value => value + 1)}><Text style={s.buttonText}>Reintentar</Text></TouchableOpacity></View> : !query ? <View style={s.notice}><Feather name="search" size={38} color="#087C91" /><Text style={s.noticeText}>Buscá una marca, modelo o producto.</Text></View> : !page.products.length ? <View style={s.notice}><Text style={s.noticeText}>No encontramos productos con esos filtros.</Text><TouchableOpacity accessibilityRole="button" onPress={() => setFilters({ sort: "relevant" })}><Text style={s.filterText}>Limpiar filtros</Text></TouchableOpacity></View> : null}
      </View>}
      renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Ver ${item.title}`} disabled={!item.offers.some(offer => catalogOfferTarget(item, offer))} onPress={() => openProduct(item)} style={[s.card, !item.offers.some(offer => catalogOfferTarget(item, offer)) && { opacity: 0.55 }]}>
        <View style={s.imageWrap}><Image source={{ uri: item.images[0] || item.bestOffer.imageUrl }} contentFit="contain" style={s.image} cachePolicy="memory-disk" /></View>
        <View style={s.cardInfo}><Text style={s.brand} numberOfLines={1}>{item.brand || item.bestOffer.store}</Text><Text style={s.productTitle} numberOfLines={2}>{item.shortTitle || item.title}</Text><Text style={s.meta}>{CONDITION_LABELS[item.bestOffer.condition] || item.bestOffer.condition} · {sourceLabel(item.bestOffer.source)}</Text>
          {!!item.rating && <Text style={s.rating}>{item.rating.toFixed(1)} ★{item.reviewsCount ? ` (${item.reviewsCount.toLocaleString("es-AR")})` : ""}</Text>}
          <Text style={s.priceLabel}>{item.offerCount > 1 ? "Desde · Final Argentina" : "Final Argentina"}</Text><Text style={s.price}>{item.minFinalPriceUSD > 0 ? `USD ${formatUSD(item.minFinalPriceUSD)}` : "Consultar"}</Text>
          <Text style={s.offerCount}>{!item.offers.some(offer => catalogOfferTarget(item, offer)) ? "No disponible" : item.offerCount > 1 ? `${item.offerCount} ofertas · Comparar →` : "Ver producto →"}</Text>
        </View>
      </TouchableOpacity>}
      ListFooterComponent={!loading && !error && page.cursor ? <View>{!!paginationError && <Text style={s.error}>{paginationError}</Text>}<TouchableOpacity accessibilityRole="button" style={s.button} disabled={loadingMore} onPress={() => { void more(); }}>{loadingMore ? <ActivityIndicator color="#082A49" /> : <Text style={s.buttonText}>{paginationError ? "Reintentar" : "Ver más productos"}</Text>}</TouchableOpacity></View> : null} />
    <Modal visible={filterOpen} animationType="slide" transparent onRequestClose={() => setFilterOpen(false)}><View style={s.overlay}><TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setFilterOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar filtros" /><View style={[s.sheet, { paddingBottom: insets.bottom + 18 }]}>
      <View style={s.resultHeader}><Text style={s.sheetTitle}>Filtrar y ordenar</Text><TouchableOpacity style={s.icon} onPress={() => setFilterOpen(false)} accessibilityRole="button" accessibilityLabel="Cerrar"><Feather name="x" size={24} color="#082A49" /></TouchableOpacity></View>
      <ScrollView keyboardShouldPersistTaps="handled"><Text style={s.sectionTitle}>Ordenar</Text><View style={s.chips}>{sorts.map(option => <TouchableOpacity key={option.value} accessibilityRole="button" accessibilityState={{ selected: draftFilters.sort === option.value }} style={[s.chip, draftFilters.sort === option.value && s.chipSelected]} onPress={() => setDraftFilters(old => ({ ...old, sort: option.value }))}><Text style={s.chipText}>{option.label}</Text></TouchableOpacity>)}</View>
        {facetGroup("Marca", "brand", page.facets.brands)}{facetGroup("Tienda", "store", page.facets.stores)}{facetGroup("Origen", "source", page.facets.sources)}{facetGroup("Estado", "condition", page.facets.conditions)}
        {page.dynamicFacets.map(facet => <View style={s.facet} key={facet.key}><Text style={s.sectionTitle}>{facet.label}</Text><View style={s.chips}>{facet.values.map(value => <TouchableOpacity key={value.value} accessibilityRole="button" accessibilityState={{ selected: draftFilters.attributes?.[facet.key] === value.value }} style={[s.chip, draftFilters.attributes?.[facet.key] === value.value && s.chipSelected]} onPress={() => setDraftFilters(old => ({ ...old, attributes: { ...old.attributes, [facet.key]: old.attributes?.[facet.key] === value.value ? "" : value.value } }))}><Text style={s.chipText}>{value.value} ({value.count})</Text></TouchableOpacity>)}</View></View>)}
        <Text style={s.sectionTitle}>Precio final en USD</Text><View style={s.range}><TextInput accessibilityLabel="Precio mínimo USD" value={minInput} onChangeText={setMinInput} placeholder="Desde" keyboardType="decimal-pad" style={s.rangeInput} placeholderTextColor="#718096" /><TextInput accessibilityLabel="Precio máximo USD" value={maxInput} onChangeText={setMaxInput} placeholder="Hasta" keyboardType="decimal-pad" style={s.rangeInput} placeholderTextColor="#718096" /></View>
        {!!filterError && <Text style={s.error}>{filterError}</Text>}
        <TouchableOpacity accessibilityRole="button" style={s.clear} onPress={() => { setDraftFilters({ sort: "relevant" }); setMinInput(""); setMaxInput(""); }}><Text style={s.filterText}>Limpiar filtros</Text></TouchableOpacity>
      </ScrollView><TouchableOpacity accessibilityRole="button" style={s.button} onPress={applyFilters}><Text style={s.buttonText}>Ver resultados</Text></TouchableOpacity>
    </View></View></Modal>
    <Modal visible={!!selectedProduct} animationType="slide" transparent onRequestClose={() => setSelectedProduct(null)}><View style={s.overlay}><TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelectedProduct(null)} accessibilityRole="button" accessibilityLabel="Cerrar ofertas" /><View style={[s.sheet, { paddingBottom: insets.bottom + 18 }]}>
      <View style={s.resultHeader}><Text style={[s.sheetTitle, { flex: 1 }]} numberOfLines={2}>{selectedProduct?.shortTitle || selectedProduct?.title}</Text><TouchableOpacity style={s.icon} onPress={() => setSelectedProduct(null)} accessibilityRole="button" accessibilityLabel="Cerrar"><Feather name="x" size={24} color="#082A49" /></TouchableOpacity></View>
      <ScrollView>{selectedProduct && [...selectedProduct.offers].sort((a, b) => a.finalPriceUSD - b.finalPriceUSD).map(offer => <View key={offer.id} style={s.offer}><Text style={s.sectionTitle}>{offer.store}</Text><Text style={s.meta}>{CONDITION_LABELS[offer.condition] || offer.condition}</Text><Text style={s.price}>USD {formatUSD(offer.finalPriceUSD)}</Text><Text style={s.meta}>Final Argentina</Text>
        {offer.freightRequiresReview && <Text style={s.meta}>Envío sujeto a revisión.</Text>}
        <TouchableOpacity accessibilityRole="button" disabled={!catalogOfferTarget(selectedProduct, offer)} style={[s.button, !catalogOfferTarget(selectedProduct, offer) && { opacity: 0.4 }]} onPress={() => openOffer(selectedProduct, offer)}><Text style={s.buttonText}>{catalogOfferTarget(selectedProduct, offer) ? "Elegir esta oferta" : "No disponible"}</Text></TouchableOpacity>
      </View>)}</ScrollView>
    </View></View></Modal>
    <AppBottomNav />
  </View>;
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#F7FAFC" }, list: { width: "100%", maxWidth: 760, alignSelf: "center" }, header: { gap: 14, marginBottom: 16 }, back: { flexDirection: "row", alignItems: "center", minHeight: 38 }, backText: { color: "#082A49", fontWeight: "700" }, title: { color: "#082A49", fontWeight: "900", fontSize: 31 },
  search: { backgroundColor: "white", borderWidth: 1, borderColor: "#DFE6EF", flexDirection: "row", borderRadius: 14 }, input: { flex: 1, fontSize: 14, color: "#082A49", padding: 14 }, icon: { minHeight: 46, width: 46, justifyContent: "center", alignItems: "center" }, resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, count: { color: "#617590", fontSize: 13 }, filterButton: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8 }, filterText: { color: "#087C91", fontWeight: "700", fontSize: 13 },
  card: { backgroundColor: "white", borderRadius: 20, borderColor: "#E3EAF0", borderWidth: 1, padding: 12, flexDirection: "row", gap: 13, marginBottom: 12 }, imageWrap: { width: "33%", backgroundColor: "#F6F8FA", borderRadius: 12, alignItems: "center", justifyContent: "center", minHeight: 140 }, image: { width: "92%", height: 130 }, cardInfo: { flex: 1, gap: 5 }, brand: { color: "#087C91", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }, productTitle: { color: "#082A49", fontSize: 15, fontWeight: "800", lineHeight: 20 }, meta: { color: "#617590", fontSize: 11, lineHeight: 16 }, rating: { color: "#8A6115", fontSize: 11 }, priceLabel: { color: "#617590", fontSize: 10, marginTop: 5 }, price: { color: "#082A49", fontSize: 20, fontWeight: "900" }, offerCount: { color: "#087C91", fontWeight: "800", fontSize: 12, marginTop: 4 },
  notice: { padding: 28, alignItems: "center", gap: 20 }, noticeText: { color: "#617590", textAlign: "center", fontSize: 14, lineHeight: 22 }, button: { minHeight: 46, borderRadius: 12, backgroundColor: "#22D3EE", alignItems: "center", justifyContent: "center", padding: 14, marginTop: 8 }, buttonText: { color: "#082A49", fontWeight: "800", fontSize: 13 },
  overlay: { flex: 1, backgroundColor: "rgba(5,25,45,0.5)", justifyContent: "flex-end" }, sheet: { backgroundColor: "white", maxHeight: "87%", padding: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12 }, sheetTitle: { color: "#082A49", fontWeight: "800", fontSize: 19 }, sectionTitle: { color: "#082A49", fontSize: 14, fontWeight: "800", marginVertical: 10 }, facet: { marginTop: 12 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { borderWidth: 1, borderColor: "#DFE6EF", backgroundColor: "#F1F5F9", borderRadius: 12, padding: 12 }, chipSelected: { backgroundColor: "#DFFAFE", borderColor: "#22BFD3" }, chipText: { color: "#082A49", fontSize: 12, fontWeight: "600" }, range: { flexDirection: "row", gap: 12 }, rangeInput: { flex: 1, backgroundColor: "#F1F5F9", padding: 14, borderRadius: 12, color: "#082A49", fontSize: 14 }, clear: { paddingVertical: 20 }, error: { color: "#B42318", paddingTop: 12 }, offer: { backgroundColor: "#F7FAFC", borderColor: "#E3EAF0", borderWidth: 1, borderRadius: 16, padding: 15, gap: 6, marginBottom: 12 },
});
