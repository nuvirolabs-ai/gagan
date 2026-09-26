import React, { useCallback, useEffect, useRef, useState } from "react";
import CommercialBreakdown from "../components/CommercialBreakdown";
import {
  AppState,
  AppStateStatus,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCart } from "../context/CartContext";
import { api, ApiError } from "../api/client";
import { colors, radius, spacing, inr, tabBarContentSpace } from "../theme";
import { ScreenHeader, QtyStepper, EmptyState, SectionTitle } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";
import { canSubmitQuote, classifyQuoteRefresh } from "../lib/commercialQuoteState";
import { commercialTaxPresentation } from "../lib/commercialTaxPresentation";

export default function CartScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { lines, updateQty, clear, total, reconcile, staleNotice, dismissStaleNotice } = useCart();
  const { t } = useLanguage();
  const [placing, setPlacing] = useState(false);
  const [quote,setQuote]=useState<any>(null);
  const [quoteReady,setQuoteReady]=useState(false);
  const [quoteError,setQuoteError]=useState("");
  const [quoteAttempt,setQuoteAttempt]=useState(0);
  const [refreshingQuote,setRefreshingQuote]=useState(false);
  const quoteRef=useRef<any>(null);
  const refreshInFlight=useRef(false);
  const appState=useRef<AppStateStatus>(AppState.currentState);
  const basket=JSON.stringify(lines.map(l=>({variantId:l.variantId,qty:l.qty})));
  const applyQuote=useCallback((nextQuote:any)=>{
    quoteRef.current=nextQuote;
    setQuote(nextQuote);
    setQuoteReady(true);
    setQuoteError("");
  },[]);
  useEffect(()=>{let active=true;quoteRef.current=null;setQuoteReady(false);setQuote(null);setQuoteError("");
    if(lines.length) api.commercialQuote(JSON.parse(basket)).then(r=>{if(active)applyQuote(r.quote);}).catch(()=>{if(active)setQuoteError("Unable to price this basket. Retry when connected.");});
    return ()=>{active=false;};
  },[applyQuote,basket,lines.length,quoteAttempt]);
  const refreshQuote=useCallback(async({silent=false}:{silent?:boolean}={})=>{
    const currentQuote=quoteRef.current;
    if(!currentQuote || refreshInFlight.current) return "noop";
    refreshInFlight.current=true;
    setRefreshingQuote(true);
    try {
      const r=await api.refreshCommercialQuote(currentQuote.id);
      if(quoteRef.current?.id!==currentQuote.id) return "stale";
      const classification=classifyQuoteRefresh(r.quote);
      if(classification.kind==="accepted"){
        applyQuote(r.quote);
        if(!silent) Alert.alert("Order already placed","Open order history before starting another checkout.");
        return "accepted";
      }
      if(classification.kind==="expired"){
        quoteRef.current=null;
        setQuote(null);
        setQuoteReady(false);
        setQuoteAttempt(a=>a+1);
        if(!silent) Alert.alert("Quote expired","A fresh quote is being requested. The manager must confirm freight again.");
        return "expired";
      }
      applyQuote(r.quote);
      return "updated";
    }catch{
      if(!silent) Alert.alert("Could not refresh quote","Your existing quote and cart are preserved. Retry when connected.");
      return "failed";
    }finally{
      refreshInFlight.current=false;
      setRefreshingQuote(false);
    }
  },[applyQuote]);
  const checkoutKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const [credit, setCredit] = useState<any>(null);
  const [config, setConfig] = useState<any>({ freeDeliveryThreshold: 0, minOrderValue: 0 });

  // Credit and thresholds are read fresh on focus — an admin may have changed
  // the limit, or another order may have consumed headroom since last visit.
  useFocusEffect(
    useCallback(() => {
      void refreshQuote({silent:true});
      api
        .getHome()
        .then((res) => {
          setCredit(res.credit);
          setConfig(res.config);
        })
        .catch(() => setCredit(null));
    }, [refreshQuote])
  );

  useEffect(()=>{
    const subscription=AppState.addEventListener("change",(nextState)=>{
      const wasAway=appState.current==="background" || appState.current==="inactive";
      appState.current=nextState;
      if(wasAway && nextState==="active") void refreshQuote({silent:true});
    });
    return ()=>subscription.remove();
  },[refreshQuote]);

  const payable = quote ? Number(quote.snapshot.total) : total;
  const quoteTax = commercialTaxPresentation(quote?.snapshot);
  const cartCount = lines.reduce((count, line) => count + line.qty, 0);
  const tabBarSpace = tabBarContentSpace(0, insets.bottom);
  const belowMin = payable > 0 && payable < (config.minOrderValue ?? 0);
  const overCredit = credit != null && payable > credit.available;
  const canCheckout = canSubmitQuote({lineCount:lines.length,quoteReady,placing,belowMinimum:belowMin,overCredit,quote});

  const handleCheckout = async () => {
    if (submitting.current || !canCheckout) return;
    submitting.current = true;
    setPlacing(true);
    try {
      // A database reset, SAP sync, or admin price edit can leave an old
      // AsyncStorage cart with variant IDs that no longer exist. Reconcile
      // immediately before checkout so the API never receives stale lines.
      const freshLines = await reconcile();
      const cartChanged =
        freshLines.length !== lines.length ||
        freshLines.some((fresh, index) => {
          const previous = lines[index];
          return (
            !previous ||
            fresh.variantId !== previous.variantId ||
            fresh.unitPrice !== previous.unitPrice ||
            fresh.qty !== previous.qty
          );
        });
      if (cartChanged) {
        Alert.alert("Cart updated", "Some saved items or prices changed. Please review the cart and try again.");
        return;
      }
      checkoutKey.current ??= `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await api.createOrder(
        freshLines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        checkoutKey.current,
        quote ? {quoteId:quote.id,revision:quote.revision}:undefined
      );
      clear();
      checkoutKey.current = null;
      navigation.navigate("OrderConfirmation", { order: res.order });
    } catch (e) {
      if (e instanceof ApiError && e.body?.error === "idempotency_key_conflict") {
        Alert.alert("Check your previous order", "This checkout was already used for a different basket. Check order history before placing another order.",
          [{ text: "View orders", onPress: () => navigation.navigate("Main", { screen: "Orders" }) }]);
      } else if (e instanceof ApiError && e.body?.error === "quote_changed_or_expired") {
        await refreshQuote({silent:true});
        Alert.alert("Quote updated","The manager's latest freight and total are now shown. Review the updated quote before placing the order.");
      } else if (e instanceof ApiError && (e.status === 402 || e.body?.error === "credit_blocked")) {
        Alert.alert(
          "Order needs review",
          "Please clear outstanding dues or contact your salesperson before placing this order."
        );
      } else {
        Alert.alert(t("errors.order"), e instanceof ApiError ? e.message : t("errors.generic"));
      }
      // An explicit validation rejection permits a corrected request. Unknown
      // outcomes retain their key so a lost response cannot create two orders.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.body?.error !== "idempotency_key_conflict") checkoutKey.current = null;
    } finally {
      submitting.current = false;
      setPlacing(false);
    }
  };

  if (lines.length === 0) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title={t("cart.title")} />
        {staleNotice ? (
          <TouchableOpacity style={[styles.stale, { marginHorizontal: spacing.lg }]} onPress={dismissStaleNotice} accessibilityRole="button" accessibilityLabel="Dismiss saved cart update">
            <Ionicons name="information-circle" size={16} color="#8A6A12" />
            <Text style={styles.staleText}>{staleNotice}</Text>
            <Ionicons name="close" size={15} color="#8A6A12" />
          </TouchableOpacity>
        ) : null}
        <EmptyState
          icon="cart-outline"
          title={t("cart.emptyTitle")}
          body={t("cart.emptyBody")}
          actionLabel={t("tabs.products")}
          onAction={() => navigation.navigate("Products")}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t("cart.title")}
        subtitle={`${lines.length} line${lines.length === 1 ? "" : "s"}`}
        right={
          <TouchableOpacity onPress={clear} disabled={placing}>
            <Text style={styles.clear}>{t("cart.clear")}</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: tabBarContentSpace(cartCount, insets.bottom) + 150 }}
        showsVerticalScrollIndicator={false}
      >
        {quoteError ? <><Text>{quoteError}</Text><TouchableOpacity accessibilityRole="button" style={{padding:16}} onPress={()=>setQuoteAttempt(a=>a+1)} disabled={placing}><Text>Retry pricing</Text></TouchableOpacity></> : null}
        {!quoteReady && !quoteError ? <ActivityIndicator accessibilityLabel="Pricing basket" /> : null}
        {quote ? <>
          <View style={styles.quoteStatus}>
            <View style={styles.quoteStatusCopy}>
              <Text style={styles.quoteStatusTitle}>{quote.acceptedAt ? "Order already placed" : quote.freightConfirmedByStaffId ? "Manager freight confirmed" : "Waiting for manager freight"}</Text>
              <Text style={styles.quoteStatusBody}>{refreshingQuote ? "Checking the latest quote…" : "Check for the latest approved freight and total."}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh manager freight" style={styles.refreshButton} disabled={placing || refreshingQuote} onPress={()=>void refreshQuote()}>
              {refreshingQuote ? <ActivityIndicator size="small" color={colors.onDark} /> : <Feather name="refresh-cw" size={15} color={colors.onDark} />}
              <Text style={styles.refreshButtonText}>{refreshingQuote ? "Checking" : "Refresh"}</Text>
            </TouchableOpacity>
          </View>
          <CommercialBreakdown value={quote.snapshot}/><Text style={styles.quoteId}>Quote {quote.id}</Text>
        </> : null}
        {staleNotice && (
          <TouchableOpacity style={styles.stale} onPress={dismissStaleNotice}>
            <Ionicons name="information-circle" size={16} color="#8A6A12" />
            <Text style={styles.staleText}>{staleNotice}</Text>
            <Ionicons name="close" size={15} color="#8A6A12" />
          </TouchableOpacity>
        )}

        {lines.map((l) => (
          <View key={l.variantId} style={styles.line}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.lineName} numberOfLines={1}>
                {l.productName}
              </Text>
              <Text style={styles.linePack} numberOfLines={1}>
                {l.packSize}
              </Text>
              {!quote && <Text style={styles.lineRate}>{inr(l.unitPrice)} / case</Text>}
            </View>
            <View style={styles.lineRight}>
              <Text
                style={styles.lineTotal}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {quote ? "" : inr(l.unitPrice * l.qty)}
              </Text>
              <QtyStepper qty={l.qty} onChange={(next) => updateQty(l.variantId, next)} compact disabled={placing} />
            </View>
          </View>
        ))}

        {!quote && <SectionTitle>{t("cart.summary")}</SectionTitle>}
        {!quote && <View style={styles.summary}>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>{t("cart.subtotal")}</Text>
            <Text style={styles.sumValue}>{inr(total)}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text style={styles.totalLabel}>{quote ? quoteTax.totalLabel : "Catalogue subtotal"}</Text>
            <Text
              style={styles.totalValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {inr(payable)}
            </Text>
          </View>

          {config.freeDeliveryThreshold > 0 && total > 0 && total < config.freeDeliveryThreshold ? (
            <View style={styles.hint}>
              <Feather name="truck" size={13} color={colors.accentStrong} />
              <Text style={styles.hintText}>
                Typical free-delivery guidance is {inr(config.freeDeliveryThreshold)}. This catalogue subtotal is not a final payable; applicable tax and final charges are confirmed by the backend.
              </Text>
            </View>
          ) : null}
        </View>}


        {belowMin && (
          <View style={styles.warn}>
            <Ionicons name="alert-circle" size={15} color={colors.danger} />
            <Text style={styles.warnText}>
              Minimum order value is {inr(config.minOrderValue)}. Add {inr(config.minOrderValue - total)}{" "}
              more to check out.
            </Text>
          </View>
        )}
        {overCredit && (
          <View style={styles.warn}>
            <Ionicons name="alert-circle" size={15} color={colors.danger} />
            <Text style={styles.warnText}>
              Please clear outstanding dues or contact your salesperson before placing this order.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: tabBarSpace }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.barLabel}>{quote ? quoteTax.totalLabel : "Catalogue subtotal"}</Text>
          <Text style={styles.barValue}>{inr(payable)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkout, !canCheckout && styles.checkoutDisabled]}
          disabled={!canCheckout}
          onPress={handleCheckout}
        >
          {placing ? (
            <ActivityIndicator color={colors.onDark} />
          ) : (
            <>
              <Text style={styles.checkoutText}>{t("cart.placeOrder")}</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.onDark} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clear: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  stale: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  staleText: { flex: 1, fontSize: 12, color: "#8A6A12", fontWeight: "600", lineHeight: 17 },
  quoteStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
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
  quoteId: { color: colors.inkMuted, fontSize: 10.5, marginTop: spacing.sm, marginBottom: spacing.sm },

  line: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lineName: { fontSize: 15, fontWeight: "700", color: colors.ink },
  linePack: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  lineRate: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  lineRight: { alignItems: "flex-end", gap: spacing.sm },
  lineTotal: { fontSize: 15, fontWeight: "700", color: colors.ink, maxWidth: 110, textAlign: "right" },

  summary: {
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  sumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: spacing.sm, gap: spacing.md },
  sumLabel: { flex: 1, minWidth: 0, fontSize: 13.5, color: colors.inkMuted },
  sumValue: { flexShrink: 0, fontSize: 13.5, fontWeight: "600", color: colors.ink },
  totalLabel: { fontSize: 15, fontWeight: "700", color: colors.ink },
  totalValue: { fontSize: 18, fontWeight: "700", color: colors.ink, maxWidth: 140, textAlign: "right" },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  hintText: { flex: 1, fontSize: 11.5, color: colors.accentStrong, fontWeight: "600" },

  creditBand: {
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginTop: spacing.sm,
  },
  creditLabel: { fontSize: 13, color: colors.inkMuted },
  creditValue: { fontSize: 15, fontWeight: "700", color: colors.ink, maxWidth: 140, textAlign: "right" },
  creditTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.track,
    overflow: "hidden",
    marginTop: spacing.md,
  },
  creditFill: { height: "100%", borderRadius: 3 },
  creditAfter: { fontSize: 11.5, color: colors.inkMuted, marginTop: spacing.sm },

  warn: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  warnText: { flex: 1, fontSize: 12, color: colors.danger, lineHeight: 17, fontWeight: "600" },

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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  barLabel: { fontSize: 11.5, color: colors.inkMuted },
  barValue: { fontSize: 19, fontWeight: "700", color: colors.ink },
  checkout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.greenDeep,
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  checkoutDisabled: { opacity: 0.4 },
  checkoutText: { color: colors.onDark, fontWeight: "700", fontSize: 14.5 },
});
