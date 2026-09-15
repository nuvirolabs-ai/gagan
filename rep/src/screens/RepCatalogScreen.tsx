import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  AppStateStatus,
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { repApi, ApiError } from "../api/repClient";
import CommercialBreakdown from "../components/CommercialBreakdown";
import { useRep } from "../context/RepContext";
import { colors, radius, spacing, inr } from "../theme";
import { haptic } from "../feedback/haptics";
import ProductThumb from "../components/ProductThumb";
import { SearchBar, ChipRow, QtyStepper, EmptyState } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";
import { catalogGroups, selectedCatalogSku, type CatalogGroup } from "../lib/catalogSelection";
import { canSubmitQuote, classifyQuoteRefresh } from "../lib/commercialQuoteState";

const ALL = "All";

export default function RepCatalogScreen({ route, navigation }: any) {
  const { retailerId, retailerName } = route.params;
  const { lines, addLine, updateQty, clearCart, cartTotal } = useRep();
  const { t } = useLanguage();

  const [products, setProducts] = useState<CatalogGroup[]>([]);
  const [selectedSkus, setSelectedSkus] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const checkoutKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const [review,setReview]=useState(false);
  const [quote,setQuote]=useState<any>(null);
  const [quoteReady,setQuoteReady]=useState(false);
  const [quoteError,setQuoteError]=useState("");
  const [refreshingQuote,setRefreshingQuote]=useState(false);
  const [rateApprovalSubmitting,setRateApprovalSubmitting]=useState(false);
  const quoteRef=useRef<any>(null);
  const refreshInFlight=useRef(false);
  const appState=useRef<AppStateStatus>(AppState.currentState);
  const basketRef=useRef("");
  const basket=JSON.stringify(lines.map(l=>({variantId:l.variantId,qty:l.qty})));
  basketRef.current=basket;
  const applyQuote=useCallback((nextQuote:any)=>{
    quoteRef.current=nextQuote;
    setQuote(nextQuote);
    setQuoteReady(true);
    setQuoteError("");
  },[]);
  useEffect(()=>{quoteRef.current=null;setReview(false);setQuote(null);setQuoteReady(false);setQuoteError("");},[basket,retailerId]);
  const requestQuote=useCallback(async()=>{
    const requestedBasket=basket;
    quoteRef.current=null;
    setQuote(null);
    setQuoteReady(false);
    setQuoteError("");
    try{
      const r=await repApi.commercialQuote(retailerId,JSON.parse(requestedBasket));
      if(basketRef.current===requestedBasket) applyQuote(r.quote);
    }
    catch{if(basketRef.current===requestedBasket)setQuoteError("Unable to price this basket. Return to products and retry.");}
  },[applyQuote,basket,retailerId]);
  const openReview=useCallback(async()=>{setReview(true);await requestQuote();},[requestQuote]);
  const refreshQuote=useCallback(async({silent=false}:{silent?:boolean}={})=>{
    const currentQuote=quoteRef.current;
    if(!currentQuote || refreshInFlight.current) return "noop";
    refreshInFlight.current=true;
    setRefreshingQuote(true);
    try {
      const r=await repApi.refreshCommercialQuote(currentQuote.id);
      if(quoteRef.current?.id!==currentQuote.id) return "stale";
      const classification=classifyQuoteRefresh(r.quote);
      if(classification.kind==="accepted"){
        applyQuote(r.quote);
        if(!silent) Alert.alert("Order already placed","Check this retailer’s recent orders before starting another checkout.");
        return "accepted";
      }
      if(classification.kind==="expired"){
        quoteRef.current=null;
        setQuote(null);
        setQuoteReady(false);
        void requestQuote();
        if(!silent) Alert.alert("Quote expired","Review the fresh quote and ask the manager to confirm freight again.");
        return "expired";
      }
      applyQuote(r.quote);
      return "updated";
    }catch{
      if(!silent) Alert.alert("Could not refresh quote","Your cart and quote are preserved. Retry when connected.");
      return "failed";
    }finally{
      refreshInFlight.current=false;
      setRefreshingQuote(false);
    }
  },[applyQuote,requestQuote]);
  const sendRateForApproval=useCallback(async()=>{
    if(!quote?.id || rateApprovalSubmitting) return;
    setRateApprovalSubmitting(true);
    try {
      await repApi.requestRateApproval(quote.id);
      Alert.alert("Rate sent for approval", "🍓 Rate Sent for Approval");
    } catch (error) {
      Alert.alert("Could not send rate", error instanceof Error ? error.message : "Please retry when connected.");
    } finally { setRateApprovalSubmitting(false); }
  },[quote,rateApprovalSubmitting]);

  useFocusEffect(useCallback(()=>{
    if(review) void refreshQuote({silent:true});
  },[refreshQuote,review]));
  useEffect(()=>{
    const subscription=AppState.addEventListener("change",(nextState)=>{
      const wasAway=appState.current==="background" || appState.current==="inactive";
      appState.current=nextState;
      if(wasAway && nextState==="active" && review) void refreshQuote({silent:true});
    });
    return ()=>subscription.remove();
  },[refreshQuote,review]);

  useEffect(() => {
    repApi
      .catalogFor(retailerId)
      .then((res) => {
        setProducts(catalogGroups(res));
        setCategories(res.categories ?? []);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [retailerId]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => category === ALL || p.category === category)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.skus.some(sku => sku.unitSize.toLowerCase().includes(q)));
  }, [products, category, query]);

  const qtyFor = (variantId: string) => lines.find((l) => l.variantId === variantId)?.qty ?? 0;

  const setQty = (product: any, variant: any, next: number) => {
    if (variant.price == null) return;
    const current = qtyFor(variant.id);
    const orderable = variant.availability?.status === "available" && Number(variant.availability.available) > 0;
    // The API owns inventory. A rep can reduce a saved line, but cannot add
    // stock that SAP has marked unavailable or stale.
    if (next > current && !orderable) return;
    if (current === 0 && next > 0) {
      addLine({
        variantId: variant.id,
        productName: product.name,
        packSize: `${variant.unitSize} × ${variant.unitsPerCase}`,
        unitPrice: Number(variant.price),
        qty: next,
      });
    } else {
      updateQty(variant.id, next);
    }
  };

  const submit = useCallback(async () => {
    if (submitting.current || lines.length === 0) return;
    submitting.current = true;
    setPlacing(true);
    try {
      checkoutKey.current ??= `rep-checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await repApi.createOrder(
        retailerId,
        lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        checkoutKey.current,
        quote ? {quoteId:quote.id,revision:quote.revision}:undefined
      );
      clearCart();
      checkoutKey.current = null;
      haptic("success");
      navigation.replace("OrderDetail", { orderId: res.order.id });
    } catch (e) {
      if (e instanceof ApiError && e.body?.error === "idempotency_key_conflict") {
        Alert.alert("Check your previous order", "This checkout already belongs to another basket. Review this retailer's orders before submitting again.");
      } else if (e instanceof ApiError && e.body?.error === "quote_changed_or_expired") {
        await refreshQuote({silent:true});
        Alert.alert("Quote updated","The manager's latest freight and total are now shown. Review the updated quote before placing the order.");
      } else if (e instanceof ApiError && (e.status === 402 || e.body?.error === "credit_blocked")) {
        Alert.alert(
          "Order needs review",
          `Please review ${retailerName}'s outstanding dues and commercial eligibility before placing this order.`
        );
      } else {
        Alert.alert(t("errors.generic"), e instanceof ApiError ? e.message : t("errors.generic"));
      }
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.body?.error !== "idempotency_key_conflict") checkoutKey.current = null;
    } finally {
      submitting.current = false;
      setPlacing(false);
    }
  }, [lines, retailerId, retailerName, clearCart, navigation,quote]);

  const cartCount = lines.reduce((n, l) => n + l.qty, 0);
  const canCheckout = canSubmitQuote({lineCount:lines.length,quoteReady,placing,quote:review ? quote : null});
  const checkoutDisabled = placing || (review && !canCheckout);

  return (
    <View style={styles.screen}>
      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Ionicons name="storefront-outline" size={16} color={colors.blue} />
        </View>
        <Text style={styles.bannerText} numberOfLines={1}>
          Ordering for {retailerName}
        </Text>
      </View>

      {review ? <ScrollView contentContainerStyle={{padding:16,paddingBottom:160,gap:16}}>
        <TouchableOpacity accessibilityRole="button" style={{padding:16}} onPress={()=>setReview(false)} disabled={placing}><Text>Back to products</Text></TouchableOpacity>
        {!quoteReady && !quoteError ? <ActivityIndicator/>:null}
        {quoteError ? <Text>{quoteError}</Text>:null}
        {quote ? <>
          <View style={styles.quoteStatus}>
            <View style={styles.quoteStatusCopy}>
              <Text style={styles.quoteStatusTitle}>{quote.acceptedAt ? "Order already placed" : quote.freightConfirmedByStaffId ? "Manager freight confirmed" : "Waiting for manager freight"}</Text>
              <Text style={styles.quoteStatusBody}>{refreshingQuote ? "Checking the latest quote…" : "Check for the latest approved freight and total."}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh manager freight" style={styles.refreshButton} disabled={placing || refreshingQuote} onPress={()=>void refreshQuote()}>
              {refreshingQuote ? <ActivityIndicator size="small" color={colors.onDark} /> : <Ionicons name="refresh-outline" size={16} color={colors.onDark} />}
              <Text style={styles.refreshButtonText}>{refreshingQuote ? "Checking" : "Refresh"}</Text>
            </TouchableOpacity>
          </View>
          <CommercialBreakdown value={quote.snapshot}/><TouchableOpacity accessibilityRole="button" style={styles.rateApprovalButton} disabled={rateApprovalSubmitting || !!quote.acceptedAt} onPress={()=>void sendRateForApproval()}><Text style={styles.rateApprovalButtonText}>{rateApprovalSubmitting ? "Sending…" : "Send rate for approval"}</Text></TouchableOpacity><Text style={styles.quoteId}>Quote {quote.id}</Text>
        </> : quoteReady ? <Text>Order total {inr(cartTotal)}</Text>:null}
      </ScrollView> : <>
      <SearchBar value={query} onChange={setQuery} placeholder={t("common.search")} />
      <View style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
        <ChipRow options={[ALL, ...categories]} value={category} onChange={setCategory} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.blue} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: cartCount > 0 ? 140 : 40 }}
          ListEmptyComponent={<EmptyState icon="magnify" title={t("common.search")} />}
          renderItem={({ item }) => {
            const product = item;
            const variant = selectedCatalogSku(product, selectedSkus[product.id], qtyFor);
            const qty = qtyFor(variant.id);
            return (
              <View style={[styles.card, product.skus.some(sku => qtyFor(sku.id) > 0) && styles.cardSelected]}>
                <View style={styles.productRow}>
                <ProductThumb
                  name={product.name}
                  category={product.category}
                  imageUrl={product.imageUrl}
                  size={72}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.pack}>
                    {variant.unitSize} × {variant.unitsPerCase}
                  </Text>
                  <View style={styles.priceStack}>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>
                        {variant.price != null ? `${inr(variant.price)}/case` : "—"}
                      </Text>
                    </View>
                    {variant.pricePerKg != null ? <Text style={styles.perKg}>{inr(variant.pricePerKg)}/kg</Text> : null}
                  </View>
                  {variant.isOverride && <Text style={styles.override}>{t("catalog.specialRate")}</Text>}
                </View>
                {qty === 0 ? <QtyStepper qty={qty} onChange={(next) => setQty(product, variant, next)} compact disabled={placing} /> : null}
                </View>
                {product.skus.length > 1 || qty > 0 ? <View style={styles.controlsRow}>
                {product.skus.length > 1 ? <View style={styles.packOptions}>
                  {product.skus.map(sku => <TouchableOpacity key={sku.id}
                    style={[styles.packOption, sku.id === variant.id && styles.packOptionSelected]}
                    disabled={placing} accessibilityRole="button"
                    accessibilityState={{ selected: sku.id === variant.id, disabled: placing }}
                    accessibilityLabel={`${product.name}, ${sku.unitSize}, ${qtyFor(sku.id)} cases in cart`}
                    onPress={() => setSelectedSkus(previous => ({ ...previous, [product.id]: sku.id }))}>
                    <Text style={styles.packOptionText}>{sku.unitSize}{qtyFor(sku.id) > 0 ? ` · ${qtyFor(sku.id)}` : ""}</Text>
                  </TouchableOpacity>)}
                </View> : null}
                {qty > 0 ? <View style={{ marginLeft: "auto" }}>
                  <QtyStepper qty={qty} onChange={(next) => setQty(product, variant, next)} compact disabled={placing} />
                </View> : null}
                </View> : null}
              </View>
            );
          }}
        />
      )}

      </>}
      {cartCount > 0 && (
        <View style={styles.bar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.barLabel}>
              {cartCount} case{cartCount > 1 ? "s" : ""} · {lines.length} line
              {lines.length > 1 ? "s" : ""}
            </Text>
            <Text style={styles.barValue}>{inr(quote ? Number(quote.snapshot.total):cartTotal)}</Text>
          </View>
          <TouchableOpacity style={[styles.placeBtn,checkoutDisabled && {opacity:0.45}]} accessibilityState={{disabled:checkoutDisabled}} disabled={checkoutDisabled} onPress={review ? submit:openReview}>
            {placing ? (
              <ActivityIndicator color={colors.onDark} />
            ) : (
              <>
                <Text style={styles.placeText}>{review ? t("orders.place"):"Review order"}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.onDark} />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.blueSoft,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  bannerIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerText: { color: colors.blueInk, fontWeight: "700", fontSize: 13.5 },
  quoteStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quoteStatusCopy: { flex: 1, minWidth: 0 },
  quoteStatusTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  quoteStatusBody: { color: colors.inkMuted, fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  refreshButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.greenDeep,
  },
  refreshButtonText: { color: colors.onDark, fontSize: 12.5, fontWeight: "700" },
  quoteId: { color: colors.inkMuted, fontSize: 10.5 },
  rateApprovalButton: { alignSelf: "flex-start", minHeight: 42, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.navy },
  rateApprovalButtonText: { color: colors.onDark, fontSize: 13, fontWeight: "700" },

  card: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  productRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  controlsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  packOptions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  packOption: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  packOptionSelected: { backgroundColor: colors.blueSoft, borderColor: colors.blue },
  packOptionText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  cardSelected: {
    borderColor: colors.blue,
    backgroundColor: colors.blueSoft,
  },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink },
  pack: { fontSize: 12, color: colors.inkMuted, marginTop: 3 },
  priceStack: { marginTop: 4 },
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  // Keep both price contexts legible. If a very narrow device cannot fit the
  // pair, the wrapping row gives the per-kg value its own line instead of
  // truncating it with an ellipsis.
  price: { fontSize: 14.5, fontWeight: "700", color: colors.ink, flexShrink: 0 },
  perKg: { fontSize: 11, color: colors.inkMuted, marginTop: 1 },
  override: { fontSize: 10, color: colors.blue, fontWeight: "700", marginTop: 3 },

  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  barLabel: { fontSize: 11.5, color: colors.inkMuted },
  barValue: { fontSize: 19, fontWeight: "700", color: colors.ink },
  placeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.blue,
    borderRadius: radius.lg,
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  placeText: { color: colors.onDark, fontWeight: "700", fontSize: 14.5 },
});
