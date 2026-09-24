import React, { useCallback, useEffect, useRef, useState } from "react";
import { checkoutCommercialReference, openCreatedOrder } from "./sellingFlow";
import { Alert, AppState, AppStateStatus, ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { ApiError, repApi } from "../api/repClient";
import { useRep } from "../context/RepContext";
import CommercialBreakdown from "../components/CommercialBreakdown";
import { commercialTaxPresentation } from "../lib/commercialTaxPresentation";
import { AppScreen, KeyboardSafeScrollView, PrimaryButton, SectionHeader, SecondaryButton, Surface } from "../components/ui";
import { haptic } from "../feedback/haptics";
import { canSubmitQuote, classifyQuoteRefresh } from "../lib/commercialQuoteState";
import { catalogGroups } from "../lib/catalogSelection";
import { colors, inr, spacing } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * The explicit review checkpoint for salesperson orders. Pricing, GST,
 * freight and entity ownership are shown from the backend commercial quote;
 * this screen only presents that snapshot and sends the canonical order
 * request once the salesperson confirms it.
 */
export default function RepReviewOrderScreen({ route, navigation }: any) {
  const { retailerId, retailerName, intentId } = route.params ?? {};
  const proposalDemandMode = Boolean(intentId);
  const { lines, cartTotal, clearCart } = useRep();
  const { t } = useLanguage();
  const [proposalIntent, setProposalIntent] = useState<any>(null);
  const [intentLoading, setIntentLoading] = useState(Boolean(intentId));
  const [standardPrices, setStandardPrices] = useState<Record<string, number>>({});
  const [quote, setQuote] = useState<any>(null);
  const [quoteReady, setQuoteReady] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [refreshingQuote, setRefreshingQuote] = useState(false);
  const [rateApprovalSubmitting, setRateApprovalSubmitting] = useState(false);
  const [placing, setPlacing] = useState(false);
  const quoteRef = useRef<any>(null);
  const refreshInFlight = useRef(false);
  const checkoutKey = useRef<string | null>(null);
  const submitLock = useRef(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const replaceExpiredIntentQuote = useRef(false);
  const demandLines = (proposalIntent?.items ?? []).map((line: any) => ({
    variantId: line.variantId,
    productName: line.productName,
    packSize: `${line.unitSize} × ${line.unitsPerCase}`,
    qty: line.qty,
    unitPrice: 0,
  }));
  const activeLines = proposalDemandMode ? demandLines : lines;
  const displayLines = activeLines.map((line: any) => {
    const quoteLine = quote?.snapshot?.lines?.find((candidate: any) => candidate.variantId === line.variantId);
    const quoteCasePrice = quoteLine
      ? Number(quoteLine.rate) * (quoteLine.rateBasis === "quintal" ? Number(quoteLine.caseWeightKg) / 100 : 1)
      : undefined;
    return { ...line, unitPrice: quoteCasePrice ?? standardPrices[line.variantId] ?? line.unitPrice };
  });
  const displayTotal = proposalDemandMode
    ? displayLines.reduce((total: number, line: any) => total + line.unitPrice * line.qty, 0)
    : cartTotal;
  const demandPricesReady = !proposalDemandMode || displayLines.every((line: any) => Number.isFinite(line.unitPrice) && line.unitPrice > 0);
  const basket = JSON.stringify(activeLines.map((line: any) => ({ variantId: line.variantId, qty: line.qty })));
  const basketRef = useRef(basket);
  basketRef.current = basket;

  const applyQuote = useCallback((nextQuote: any) => {
    quoteRef.current = nextQuote;
    setQuote(nextQuote);
    setQuoteReady(true);
    setQuoteError("");
  }, []);

  useEffect(() => {
    if (!intentId) return;
    let active = true;
    setIntentLoading(true);
    repApi.proposalOrderIntent(intentId)
      .then(({ intent: nextIntent }) => {
        if (!active) return;
        setProposalIntent(nextIntent);
        if (nextIntent.demandState !== "ready_for_official_order" && nextIntent.demandState !== "converted") {
          Alert.alert("Retailer approval required", "This demand can be converted only after the retailer is approved.", [
            { text: "OK", onPress: () => navigation.goBack() },
          ], { cancelable: false });
        }
      })
      .catch(() => {
        if (active) Alert.alert("Could not load punched demand", "Refresh the retailer request and try again.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ], { cancelable: false });
      })
      .finally(() => { if (active) setIntentLoading(false); });
    return () => { active = false; };
  }, [intentId, navigation]);

  const requestQuote = useCallback(async () => {
    const requestedBasket = basket;
    const requestedItems = JSON.parse(requestedBasket);
    if (requestedItems.length === 0) return;
    quoteRef.current = null;
    setQuote(null);
    setQuoteReady(false);
    setQuoteError("");
    try {
      const pinnedQuoteId = proposalIntent?.conversionCommercialQuoteId;
      const result = pinnedQuoteId && !replaceExpiredIntentQuote.current
        ? await repApi.refreshCommercialQuote(pinnedQuoteId)
        : await repApi.commercialQuote(retailerId, requestedItems);
      if (basketRef.current !== requestedBasket) return;
      applyQuote(result.quote);
      if (proposalDemandMode && !result.quote) {
        const catalog = await repApi.catalogFor(retailerId);
        if (basketRef.current !== requestedBasket) return;
        const prices: Record<string, number> = {};
        for (const group of catalogGroups(catalog)) {
          for (const sku of group.skus) if (sku.price != null) prices[sku.id] = Number(sku.price);
        }
        setStandardPrices(prices);
      }
      replaceExpiredIntentQuote.current = false;
    } catch {
      if (basketRef.current === requestedBasket) setQuoteError("Unable to price this basket. Return to products and retry.");
    }
  }, [applyQuote, basket, proposalDemandMode, proposalIntent?.conversionCommercialQuoteId, retailerId]);

  useEffect(() => {
    void requestQuote();
  }, [requestQuote]);

  const refreshQuote = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    const currentQuote = quoteRef.current;
    if (!currentQuote || refreshInFlight.current) return "noop";
    refreshInFlight.current = true;
    setRefreshingQuote(true);
    try {
      const result = await repApi.refreshCommercialQuote(currentQuote.id);
      if (quoteRef.current?.id !== currentQuote.id) return "stale";
      const classification = classifyQuoteRefresh(result.quote);
      if (classification.kind === "accepted") {
        applyQuote(result.quote);
        if (!silent && !proposalDemandMode) Alert.alert("Order already placed", "Check this retailer's recent orders before starting another checkout.");
        return "accepted";
      }
      if (classification.kind === "expired") {
        if (proposalDemandMode) replaceExpiredIntentQuote.current = true;
        void requestQuote();
        if (!silent) Alert.alert("Quote expired", "Review the fresh quote and ask the manager to confirm freight again.");
        return "expired";
      }
      applyQuote(result.quote);
      return "updated";
    } catch {
      if (!silent) Alert.alert("Could not refresh quote", "Your basket is preserved. Retry when connected.");
      return "failed";
    } finally {
      refreshInFlight.current = false;
      setRefreshingQuote(false);
    }
  }, [applyQuote, proposalDemandMode, requestQuote]);

  useFocusEffect(useCallback(() => {
    if (quote) void refreshQuote({ silent: true });
  }, [quote, refreshQuote]));

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasAway = appState.current === "background" || appState.current === "inactive";
      appState.current = nextState;
      if (wasAway && nextState === "active" && quote) void refreshQuote({ silent: true });
    });
    return () => subscription.remove();
  }, [quote, refreshQuote]);

  const sendRateForApproval = useCallback(async () => {
    if (!quote?.id || rateApprovalSubmitting) return;
    setRateApprovalSubmitting(true);
    try {
      await repApi.requestRateApproval(quote.id);
      Alert.alert("Rate sent for approval", "🍓 Rate Sent for Approval");
    } catch (error) {
      Alert.alert("Could not send rate", error instanceof Error ? error.message : "Please retry when connected.");
    } finally {
      setRateApprovalSubmitting(false);
    }
  }, [quote, rateApprovalSubmitting]);

  const submit = useCallback(async () => {
    if (submitLock.current || activeLines.length === 0) return;
    if (proposalIntent?.demandState === "converted" && proposalIntent.convertedOrderId) {
      navigation.replace("OrderDetail", { orderId: proposalIntent.convertedOrderId });
      return;
    }
    const replayAcceptedConversion = proposalDemandMode
      && Boolean(proposalIntent?.conversionCommercialQuoteId)
      && Boolean(quote?.acceptedAt);
    const canSubmit = replayAcceptedConversion || canSubmitQuote({ lineCount: activeLines.length, quoteReady, placing, quote });
    if (!canSubmit) {
      Alert.alert("Quote needs attention", quoteError || "Wait for the manager-confirmed quote before placing this order.");
      return;
    }
    submitLock.current = true;
    setPlacing(true);
    try {
      let result: any;
      if (proposalDemandMode) {
        result = await repApi.convertProposalOrderIntent(intentId, checkoutCommercialReference(quote));
      } else {
        checkoutKey.current ??= `rep-checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        result = await repApi.createOrder(
          retailerId,
          activeLines.map((line: any) => ({ variantId: line.variantId, qty: line.qty })),
          checkoutKey.current,
          checkoutCommercialReference(quote),
        );
      }
      if (!result.order?.id) throw new Error("order_response_missing_id");
      if (!proposalDemandMode) clearCart();
      checkoutKey.current = null;
      haptic("success");
      openCreatedOrder(result, (screen, params) => navigation.replace(screen, params), openOrder => {
        Alert.alert("Order sent for approval", "❤️ Sales Order Sent for Approval", [{ text: "View order", onPress: openOrder }], { cancelable: false });
      });
    } catch (error) {
      if (error instanceof ApiError && error.body?.error === "idempotency_key_conflict") {
        Alert.alert("Check your previous order", "This checkout already belongs to another basket. Review this retailer's orders before submitting again.");
      } else if (error instanceof ApiError && error.body?.error === "quote_changed_or_expired") {
        await refreshQuote({ silent: true });
        Alert.alert("Quote updated", "The manager's latest freight and total are now shown. Review the updated quote before placing the order.");
      } else if (error instanceof ApiError && (error.status === 402 || error.body?.error === "credit_blocked")) {
        Alert.alert("Order needs review", `Please review ${retailerName}'s outstanding dues and commercial eligibility before placing this order.`);
      } else {
        Alert.alert(t("errors.generic"), error instanceof ApiError ? error.message : t("errors.generic"));
      }
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.body?.error !== "idempotency_key_conflict") checkoutKey.current = null;
    } finally {
      submitLock.current = false;
      setPlacing(false);
    }
  }, [activeLines, clearCart, intentId, navigation, proposalDemandMode, proposalIntent, quote, quoteError, quoteReady, refreshQuote, retailerId, retailerName, t, placing]);

  if (proposalDemandMode && intentLoading) {
    return <AppScreen><View style={styles.empty}><ActivityIndicator color={colors.blue} /></View></AppScreen>;
  }

  if (activeLines.length === 0) {
    return (
      <AppScreen>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Your order is empty</Text>
          <SecondaryButton label="Back to products" onPress={() => navigation.goBack()} />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <KeyboardSafeScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity accessibilityRole="button" style={styles.back} onPress={() => navigation.goBack()} disabled={placing}>
          <Text style={styles.backText}>‹ Back to products</Text>
        </TouchableOpacity>
        <View style={styles.context}>
          <Text style={styles.kicker}>REVIEW ORDER</Text>
          <Text style={styles.title}>{retailerName ?? "Retailer"}</Text>
          <Text style={styles.muted}>{proposalDemandMode
            ? "This demand was punched before retailer approval. Confirm the current tier pricing and continue through the normal order checks."
            : "Check quantities and the manager-confirmed commercial quote before placing."}</Text>
        </View>

        <Surface>
          <SectionHeader title={`${activeLines.length} line${activeLines.length === 1 ? "" : "s"}`} />
          {displayLines.map((line: any, index: number) => (
            <View key={line.variantId} style={[styles.line, index > 0 && styles.divider]}>
              <View style={styles.lineNumber}><Text style={styles.lineNumberText}>{index + 1}</Text></View>
              <View style={styles.lineBody}>
                <Text style={styles.lineName}>{line.productName}</Text>
                <Text style={styles.meta}>{line.packSize} · Qty {line.qty}</Text>
              </View>
              <Text style={styles.lineAmount}>{line.unitPrice > 0 ? inr(line.unitPrice * line.qty) : "Price pending"}</Text>
            </View>
          ))}
        </Surface>

        <Surface style={styles.quoteSurface}>
          <View style={styles.quoteHeader}>
            <View style={styles.quoteCopy}>
              <Text style={styles.quoteTitle}>{quote?.acceptedAt ? "Order already placed" : quote?.freightConfirmedByStaffId ? "Manager freight confirmed" : quote ? "Waiting for manager freight" : quoteReady ? "Standard case pricing" : "Checking pricing"}</Text>
              <Text style={styles.muted}>{refreshingQuote ? "Checking the latest quote…" : quoteReady && !quote ? "This basket uses existing catalogue prices. The backend validates the order before submission." : quote && commercialTaxPresentation(quote.snapshot).pending ? "GST pending — final tax will be applied before invoicing." : "The backend quote is the source of truth for GST, freight and the final total."}</Text>
            </View>
            {quote ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh manager freight" style={styles.refreshButton} disabled={placing || refreshingQuote} onPress={() => void refreshQuote()}>
              {refreshingQuote ? <ActivityIndicator size="small" color={colors.onDark} /> : <Text style={styles.refreshText}>Refresh</Text>}
            </TouchableOpacity> : null}
          </View>
          {!quoteReady && !quoteError ? <ActivityIndicator color={colors.blue} /> : null}
          {quoteError ? <Text style={styles.error}>{quoteError}</Text> : null}
          {quote ? <CommercialBreakdown value={quote.snapshot} /> : quoteReady ? <Text style={styles.muted}>{proposalDemandMode && !demandPricesReady
            ? "Current retailer tier has no price for every punched item. Ask a manager to configure pricing before continuing."
            : `${proposalDemandMode ? "Current catalogue subtotal " : "Catalogue subtotal "}${inr(displayTotal)}`}</Text> : null}
          {quote ? <TouchableOpacity accessibilityRole="button" style={styles.rateButton} disabled={rateApprovalSubmitting || !!quote.acceptedAt} onPress={() => void sendRateForApproval()}><Text style={styles.rateButtonText}>{rateApprovalSubmitting ? "Sending…" : "Send rate for approval"}</Text></TouchableOpacity> : null}
        </Surface>

        <View style={styles.actions}>
          <SecondaryButton label="Back to products" onPress={() => navigation.goBack()} disabled={placing} />
          <PrimaryButton label={placing ? "Placing…" : proposalDemandMode ? "Complete order" : "Place order"} icon={placing ? undefined : "checkmark-circle-outline"} disabled={placing || !demandPricesReady || !(proposalDemandMode && proposalIntent?.conversionCommercialQuoteId && quote?.acceptedAt) && !canSubmitQuote({ lineCount: activeLines.length, quoteReady, placing, quote })} onPress={() => void submit()} />
        </View>
      </KeyboardSafeScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.section, paddingBottom: spacing.xxl },
  back: { minHeight: 40, justifyContent: "center" },
  backText: { color: colors.blueInk, fontSize: 14, fontWeight: "700" },
  context: { gap: spacing.xs },
  kicker: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 26, fontWeight: "700" },
  muted: { color: colors.inkMuted, fontSize: 13, lineHeight: 18 },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.separator },
  lineNumber: { width: 30, height: 30, borderRadius: 999, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  lineNumberText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  lineBody: { flex: 1, minWidth: 0, gap: 2 },
  lineName: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  meta: { color: colors.inkMuted, fontSize: 12, lineHeight: 17 },
  lineAmount: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  quoteSurface: { gap: spacing.md },
  quoteHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  quoteCopy: { flex: 1, minWidth: 0, gap: 3 },
  quoteTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  refreshButton: { minHeight: 42, minWidth: 76, paddingHorizontal: spacing.md, borderRadius: spacing.sm, backgroundColor: colors.greenDeep, alignItems: "center", justifyContent: "center" },
  refreshText: { color: colors.onDark, fontSize: 12.5, fontWeight: "700" },
  rateButton: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: spacing.md, backgroundColor: colors.navy },
  rateButtonText: { color: colors.onDark, fontSize: 13, fontWeight: "700" },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  actions: { gap: spacing.sm },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "700" },
});
