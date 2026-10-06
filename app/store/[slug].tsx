import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBottomNav } from "../../components/AppBottomNav";
import { ProductCard } from "../../components/ProductCard";
import type { ShopXProduct } from "../../lib/api";
import { getStoreCatalog, mergeCatalogPages, type StoreCatalogPage } from "../../lib/store-catalog";
import { saveProductToCache } from "../../lib/product-cache";
import { FALLBACK_STORES, type ShopXStore } from "../../lib/stores";
import { canUseRemoteStoreLogo, getStoreLogoSource, getStoreLogoWordmark } from "../../lib/store-logos";

export default function StoreScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = (Array.isArray(params.slug) ? params.slug[0] : params.slug || "").toLowerCase();
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<ShopXStore | null>(null);
  const [products, setProducts] = useState<ShopXProduct[]>([]);
  const [categories, setCategories] = useState<StoreCatalogPage["categories"]>([]);
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const busy = useRef(false);
  const list = useRef<FlatList<ShopXProduct>>(null);
  const load = useCallback(async (nextPage: number) => {
    if (nextPage > 1 && busy.current) return;
    const id = ++generation.current;
    busy.current = true;
    setLoading(true); setError("");
    if (nextPage === 1) { setPage(1); setProducts([]); setHasMore(false); }
    try {
      const result = await getStoreCatalog(slug, category, nextPage);
      if (id !== generation.current) return;
      setStore(result.store);
      setCategories(result.categories);
      setProducts(current => nextPage === 1 ? result.products : mergeCatalogPages(current, result.products));
      setTotal(result.pagination.total); setInventoryTotal(result.totalProducts);
      setPage(nextPage); setHasMore(result.pagination.hasMore);
    } catch (e) {
      if (id === generation.current) setError(e instanceof Error ? e.message : "No pudimos cargar la tienda.");
    } finally {
      if (id === generation.current) { busy.current = false; setLoading(false); }
    }
  }, [slug, category]);
  useEffect(() => { setCategory(""); setStore(null); setCategories([]); }, [slug]);
  useEffect(() => { void load(1); return () => { generation.current++; busy.current = false; }; }, [load]);
  const currentStore = store || FALLBACK_STORES.find(item => item.slug === slug);
  const localLogo = getStoreLogoSource(slug);
  const logo = localLogo || (canUseRemoteStoreLogo(currentStore?.logo) ? { uri: currentStore?.logo } : null);
  const selectCategory = (value: string) => { setCategory(value); list.current?.scrollToOffset({offset:0,animated:false}); };
  return <View style={s.app}>
    <FlatList ref={list} data={products} numColumns={2}
      keyExtractor={item => item._id || item.id || item.slug}
      columnWrapperStyle={s.row}
      contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
      refreshControl={<RefreshControl refreshing={loading && page === 1} onRefresh={() => load(1)} />}
      onEndReached={() => { if (hasMore && !loading && !error) void load(page + 1); }} onEndReachedThreshold={0.4}
      ListHeaderComponent={<>
        <View style={[s.hero, {paddingTop:insets.top+14}]}>
          <TouchableOpacity accessibilityLabel="Volver" onPress={() => router.back()} style={s.back}><Feather name="chevron-left" size={24} color="white" /></TouchableOpacity>
          <View style={s.identity}>
            <View style={s.logo}>{logo ? <Image source={logo} style={{width:64,height:64}} resizeMode="contain" /> : <Text style={s.logoText}>{getStoreLogoWordmark(currentStore || {name:slug,slug})}</Text>}</View>
            <View style={{flex:1}}><Text style={s.eyebrow}>PRODUCTOS DE ESTADOS UNIDOS</Text><Text style={s.title}>{currentStore?.name || "ShopX"}</Text></View>
          </View>
          <Text style={s.intro}>Explorá el catálogo completo con precio final Argentina.</Text>
        </View>
        <View style={s.filters}>
          <Text style={s.heading}>Categorías</Text>
          <View style={s.chips}>
            {[{label:"Todos",count:inventoryTotal,value:""}, ...categories.map(item=>({...item,value:item.label}))].map(item=><TouchableOpacity key={item.value} accessibilityRole="button" accessibilityState={{selected:category===item.value}} accessibilityLabel={`${item.label}, ${item.count} productos`} onPress={()=>selectCategory(item.value)} style={[s.chip,category===item.value&&s.active]}><Text style={[s.chipText,category===item.value&&s.activeText]}>{item.label} ({item.count})</Text></TouchableOpacity>)}
          </View>
          <Text style={s.count}>{total} productos{category ? ` · ${category}` : ""}</Text>
        </View>
      </>}
      renderItem={({item})=><View style={s.column}><ProductCard product={item} variant="grid" onPress={()=>{saveProductToCache(item);router.push({pathname:"/product/[id]",params:{id:item.slug||item._id||""}});}} /></View>}
      ListEmptyComponent={!loading&&!error?<Text style={s.state}>No hay productos en esta categoría.</Text>:null}
      ListFooterComponent={<View style={s.footer}>
        {loading&&<ActivityIndicator color="#00A6C8" />}
        {!!error&&<><Text style={s.state}>{error}</Text><TouchableOpacity style={s.action} onPress={()=>load(products.length?page+1:1)}><Text style={s.activeText}>Reintentar</Text></TouchableOpacity></>}
        {!loading&&!error&&hasMore&&<TouchableOpacity style={s.action} onPress={()=>load(page+1)}><Text style={s.activeText}>Ver más productos ({products.length} de {total})</Text></TouchableOpacity>}
        {!loading&&!error&&!hasMore&&products.length>0&&<Text style={s.count}>Viste los {products.length} productos.</Text>}
      </View>}
    />
    <AppBottomNav />
  </View>;
}
const s=StyleSheet.create({
  app:{flex:1,backgroundColor:"#F8FAFC"},hero:{backgroundColor:"#071E3A",padding:18,paddingBottom:26},back:{width:44,height:44,justifyContent:"center"},identity:{flexDirection:"row",gap:16,alignItems:"center",marginTop:12},logo:{width:80,height:80,padding:8,borderRadius:20,backgroundColor:"white",justifyContent:"center",alignItems:"center"},logoText:{fontSize:14,fontWeight:"900",color:"#071E3A"},eyebrow:{fontSize:10,letterSpacing:1.3,color:"#67DCE9",fontWeight:"800"},title:{fontSize:28,fontWeight:"900",color:"white",marginTop:8},intro:{color:"#D9E4F0",lineHeight:22,marginTop:20},filters:{padding:18,gap:14},heading:{fontSize:20,fontWeight:"900",color:"#071E3A"},chips:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{maxWidth:"100%",paddingHorizontal:14,paddingVertical:11,borderRadius:24,borderWidth:1,borderColor:"#E2E8F0",backgroundColor:"white"},chipText:{color:"#0A2647",fontWeight:"700",fontSize:12},active:{backgroundColor:"#0A2647",borderColor:"#0A2647"},activeText:{color:"white",fontWeight:"800"},count:{color:"#64748B",fontSize:13},row:{paddingHorizontal:18,gap:12,marginBottom:14},column:{flex:1,maxWidth:"50%"},footer:{padding:20,alignItems:"center",gap:12},state:{padding:18,textAlign:"center",color:"#64748B"},action:{borderRadius:24,backgroundColor:"#071E3A",paddingHorizontal:22,paddingVertical:14}
});
