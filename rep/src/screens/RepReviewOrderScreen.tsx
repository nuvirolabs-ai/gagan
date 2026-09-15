import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, AppStateStatus, ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { ApiError, repApi } from "../api/repClient";
import { useRep } from "../context/RepContext";
import CommercialBreakdown from "../components/CommercialBreakdown";
import { AppScreen, KeyboardSafeScrollView, PrimaryButton, SectionHeader, SecondaryButton, Surface } from "../components/ui";
import { haptic } from "../feedback/haptics";
import { canSubmitQuote, classifyQuoteRefresh } from "../lib/commercialQuoteState";
import { colors, inr, spacing } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * The explicit review checkpoint for salesperson orders. Pricing, GST,
 * freight and entity ownership are shown from the backend commercial quote;
 * this screen only presents that snapshot and sends the canonical order
 * request once the salesperson confirms it.
 */
export default function RepReviewOrderScreen({ route, navigation }: any) {
  const { retailerId, retailerName } = route.params ?? {};
  const { lines, cartTotal, clearCart } = useRep();
  const { t } = useLanguage();
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
  const basket = JSON.stringify(lines.map((line) => ({ variantId: line.variantId, qty: line.qty })));
  const basketRef = useRef(basket);
  basketRef.current = basket;

  const applyQuote = useCallback((nextQuote: any) => {
    quoteRef.current = nextQuote;
    setQuote(nextQuote);
    setQuoteReady(true);
    setQuoteError("");
  }, []);

  const requestQuote = useCallback(async () => {
    const requestedBasket = basket;
    quoteRef.current = null;
    setQuote(null);
    setQuoteReady(false);
    setQuoteError("");
    try {
      const result = await repApi.commercialQuote(retailerId, JSON.parse(requestedBasket));
      if (basketRef.current === requestedBasket) applyQuote(result.quote);
    } catch {
      if (basketRef.current === requestedBasket) setQuoteError("Unable to price this basket. Return to products and retry.");
    }
  }, [applyQuote, basket, retailerId]);

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
        if (!silent) Alert.alert("Order already placed", "Check this retailer's recent orders before starting another checkout.");
        return "accepted";
      }
      if (classification.kind === "expired") {
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
  }, [applyQuote, requestQuote]);

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
    if (submitLock.current || lines.length === 0) return;
    const canSubmit = canSubmitQuote({ lineCount: lines.length, quoteReady, placing, quote });
    if (!canSubmit) {
      Alert.alert("Quote needs attention", quoteError || "Wait for the manager-confirmed quote before placing this order.");
      return;
    }
    submitLock.current = true;
    setPlacing(true);
    try {
      checkoutKey.current ??= `rep-checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await repApi.createOrder(
        retailerId,
        lines.map((line) => ({ variantId: line.variantId, qty: line.qty })),
        checkoutKey.current,
        { quoteId: quote.id, revision: quote.revision },
      );
      if (!result.order?.id) throw new Error("order_response_missing_id");
      clearCart();
      checkoutKey.current = null;
      haptic("success");
      const openOrder = () => navigation.replace("OrderDetail", { orderId: result.order.id });
      if (result.approvalRequest) {
        Alert.alert("Order sent for approval", "❤️ Sales Order Sent for Approval", [{ text: "View order", onPress: openOrder }], { cancelable: false });
      } else {
        openOrder();
      }
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
  }, [clearCart, lines, navigation, quote, quoteError, quoteReady, refreshQuote, retailerId, retailerName, t, placing]);

  if (lines.length === 0) {
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
          <Text style={styles.muted}>Check quantities and the manager-confirmed commercial quote before placing.</Text>
        </View>

        <Surface>
          <SectionHeader title={`${lines.length} line${lines.length === 1 ? "" : "s"}`} />
          {lines.map((line, index) => (
            <View key={line.variantId} style={[styles.line, index > 0 && styles.divider]}>
              <View style={styles.lineNumber}><Text style={styles.lineNumberText}>{index + 1}</Text></View>
              <View style={styles.lineBody}>
                <Text style={styles.lineName}>{line.productName}</Text>
                <Text style={styles.meta}>{line.packSize} · Qty {line.qty}</Text>
              </View>
              <Text style={styles.lineAmount}>{inr(line.unitPrice * line.qty)}</Text>
            </View>
          ))}
        </Surface>

        <Surface style={styles.quoteSurface}>
          <View style={styles.quoteHeader}>
            <View style={styles.quoteCopy}>
              <Text style={styles.quoteTitle}>{quote?.acceptedAt ? "Order already placed" : quote?.freightConfirmedByStaffId ? "Manager freight confirmed" : "Waiting for manager freight"}</Text>
              <Text style={styles.muted}>{refreshingQuote ? "Checking the latest quote…" : "The backend quote is the source of truth for GST, freight and the final total."}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh manager freight" style={styles.refreshButton} disabled={!quote || placing || refreshingQuote} onPress={() => void refreshQuote()}>
              {refreshingQuote ? <ActivityIndicator size="small" color={colors.onDark} /> : <Text style={styles.refreshText}>Refresh</Text>}
            </TouchableOpacity>
          </View>
          {!quoteReady && !quoteError ? <ActivityIndicator color={colors.blue} /> : null}
          {quoteError ? <Text style={styles.error}>{quoteError}</Text> : null}
          {quote ? <CommercialBreakdown value={quote.snapshot} /> : quoteReady ? <Text style={styles.muted}>Basket total {inr(cartTotal)}</Text> : null}
          {quote ? <TouchableOpacity accessibilityRole="button" style={styles.rateButton} disabled={rateApprovalSubmitting || !!quote.acceptedAt} onPress={() => void sendRateForApproval()}><Text style={styles.rateButtonText}>{rateApprovalSubmitting ? "Sending…" : "Send rate for approval"}</Text></TouchableOpacity> : null}
        </Surface>

        <View style={styles.actions}>
          <SecondaryButton label="Back to products" onPress={() => navigation.goBack()} disabled={placing} />
          <PrimaryButton label={placing ? "Placing…" : "Place order"} icon={placing ? undefined : "checkmark-circle-outline"} disabled={placing || !canSubmitQuote({ lineCount: lines.length, quoteReady, placing, quote })} onPress={() => void submit()} />
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
