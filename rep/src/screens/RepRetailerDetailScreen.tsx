import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  View,
  Text,
  StyleSheet,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { repApi } from "../api/repClient";
import { captureForegroundLocation } from "../location/deviceLocation";
import { useRep } from "../context/RepContext";
import { useField } from "../context/FieldContext";
import { staffCapabilities } from "../auth/staffCapabilities";
import { colors, inr, spacing } from "../theme";
import { formatOrderRef } from "../lib/orderRef";
import {
  AppScreen,
  FocusCard,
  InitialsBadge,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  Skeleton,
  StatusChip,
  StatusPill,
  Surface,
  TextButton,
  TimelineEvent,
  KeyboardSafeScrollView,
} from "../components/ui";
import ActivityComposer, { ACTIVITY_LABELS } from "../components/ActivityComposer";
import TaskEvidenceSheet from "../components/TaskEvidenceSheet";
import EntityAttribution from "../components/EntityAttribution";
import { haptic } from "../feedback/haptics";
import { useLanguage } from "../i18n/LanguageContext";
import { checkInErrorKey } from "../location/checkInErrors";
import { activeRetailerVisit } from "./activeRetailerVisit";

const LEDGER_LABELS: Record<string, string> = {
  invoice: "Invoice",
  payment: "Payment received",
  credit_note: "Credit note",
  payment_reversal: "Payment reversed",
};

const DETAIL_CACHE_MS = 45_000;
const detailCache = new Map<string, { data: any; at: number; complete: boolean }>();

function saveDetailCache(key: string, data: any, complete: boolean) {
  const now = Date.now();
  for (const [cachedKey, entry] of detailCache) {
    if (now - entry.at >= DETAIL_CACHE_MS) detailCache.delete(cachedKey);
  }
  detailCache.delete(key);
  detailCache.set(key, { data, at: now, complete });
  if (detailCache.size > 30) detailCache.delete(detailCache.keys().next().value!);
}

function previewDetail(preview: any, retailerId: string) {
  if (!preview || preview.id !== retailerId) return null;
  return {
    retailer: {
      id: retailerId, name: preview.name, phone: preview.phone,
      shopAddress: preview.shopAddress, tier: preview.tier,
      internalSegment: preview.internalSegment, lifecycle: null,
    },
    credit: {
      outstanding: preview.outstanding, overdue: preview.overdue,
      available: preview.available, creditLimit: preview.creditLimit,
    },
    financialSummary: { reconciliationRequired: preview.financialSummary?.reconciliationRequired === true },
    kyc: null, recentOrders: [], recentLedger: [],
  };
}

export default function RepRetailerDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { retailerId } = route.params;
  const { setActiveRetailer, staff } = useRep();
  const { today } = useField();
  const cacheKey = `${staff?.id ?? ""}:${retailerId}`;
  const stored = detailCache.get(cacheKey);
  const cached = stored && Date.now() - stored.at < DETAIL_CACHE_MS ? stored : null;
  const { t } = useLanguage();
  const capabilities = staffCapabilities(staff?.permissions ?? []);
  const [data, setData] = useState<any | null>(() => cached?.data ?? previewDetail(route.params?.retailerPreview, retailerId));
  const [location, setLocation] = useState<any | null>(null);
  const [activeVisit, setActiveVisit] = useState<any | null>(null);
  const [activeVisitElsewhere, setActiveVisitElsewhere] = useState<any | null>(null);
  const [recentVisits, setRecentVisits] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [marketingHistory, setMarketingHistory] = useState<any[]>([]);
  const [storeTasks, setStoreTasks] = useState<any[]>([]);
  const [evidenceTask, setEvidenceTask] = useState<any | null>(null);
  const [startingExecution, setStartingExecution] = useState(false);
  const startingExecutionRef = useRef(false);
  const [marketingHistoryExpanded, setMarketingHistoryExpanded] = useState(false);
  const [marketingHistoryLoaded, setMarketingHistoryLoaded] = useState(false);
  const [marketingHistoryLoading, setMarketingHistoryLoading] = useState(false);
  const [marketingHistoryFailed, setMarketingHistoryFailed] = useState(false);
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);
  const marketingHistoryRequest = useRef(0);
  const [baseline, setBaseline] = useState<any | null>(null);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [todayField, setTodayField] = useState<any | null>(null);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [composing, setComposing] = useState(false);
  const [loading, setLoading] = useState(!cached && !route.params?.retailerPreview);
  const autoStartAttempted = useRef(false);
  const checkInPending = useRef(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const requestId = useRef(0);
  const fullDetailRequest = useRef(0);
  const [criticalReady, setCriticalReady] = useState(Boolean(cached));
  const [visitReady, setVisitReady] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [historyReady, setHistoryReady] = useState(Boolean(cached?.complete));
  const [historyFailed, setHistoryFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const firstUsefulLogged = useRef(false);
  const criticalLogged = useRef(false);
  const openedAt = useRef(typeof route.params?.openedAt === "number" ? route.params.openedAt : Date.now());
  const trackedRetailerId = useRef(retailerId);
  const logOpenTiming = (phase: string) => {
    if (process.env.EXPO_PUBLIC_BUILD_CHANNEL === "gagan-staging-review") {
      console.info(`retailer_detail_${phase}_ms=${Date.now() - openedAt.current}`);
    }
  };

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    const isCurrent = () => requestId.current === currentRequest;
    const critical = repApi.retailerSummary(retailerId).then((summary) => {
      if (!isCurrent() || fullDetailRequest.current === currentRequest) return;
      setData((existing: any) => ({ ...summary, recentOrders: existing?.recentOrders ?? [], recentLedger: existing?.recentLedger ?? [] }));
      saveDetailCache(cacheKey, summary, false);
      setCriticalReady(true);
      if (!criticalLogged.current) { criticalLogged.current = true; logOpenTiming("critical_ready"); }
      setLoading(false);
    }).catch(() => undefined);
    const visits = repApi.retailerVisits(retailerId).then((result) => {
      if (!isCurrent()) return;
      const selected = result.visits ?? [];
      const active = activeRetailerVisit(selected, retailerId);
      setActiveVisit(active.activeVisit);
      setActiveVisitElsewhere(result.activeVisitElsewhere ?? null);
      setRecentVisits(selected);
      setVisitReady(true);
    }).catch(() => { if (isCurrent()) setVisitReady(false); });
    const secondary = [
      repApi.retailer(retailerId).then((result) => {
        if (!isCurrent()) return;
        fullDetailRequest.current = currentRequest;
        setData(result);
        saveDetailCache(cacheKey, result, true);
        setCriticalReady(true);
        setHistoryReady(true);
        setHistoryFailed(false);
        setLoading(false);
      }).catch(() => { if (isCurrent()) setHistoryFailed(true); }),
      repApi.getLocation(retailerId).then((result) => { if (isCurrent()) { setLocation(result.location); setLocationReady(true); } }),
      repApi.retailerBaseline(retailerId).then((result) => { if (isCurrent()) setBaseline(result.baseline ?? null); }),
      repApi.schemes(retailerId).then((result) => { if (isCurrent()) setSchemes(result.schemes ?? []); }),
      ...(capabilities.canLogActivity ? [repApi.customerActivities(retailerId).then((result) => { if (isCurrent()) setActivities(result.activities ?? []); })] : []),
      ...(capabilities.canCompleteTasks ? [repApi.tasks(retailerId).then((result) => { if (isCurrent()) setStoreTasks((result.tasks ?? []).filter((task: any) => task.retailerId === retailerId && task.status !== "cancelled")); })] : []),
    ];
    await Promise.allSettled([critical, visits, ...secondary]);
    if (isCurrent()) { setLoading(false); logOpenTiming("secondary_ready"); }
  }, [retailerId, cacheKey, capabilities.canLogActivity, capabilities.canCompleteTasks]);

  useEffect(() => {
    const entry = detailCache.get(cacheKey);
    const saved = entry && Date.now() - entry.at < DETAIL_CACHE_MS ? entry : null;
    if (trackedRetailerId.current !== retailerId) {
      trackedRetailerId.current = retailerId;
      openedAt.current = typeof route.params?.openedAt === "number" ? route.params.openedAt : Date.now();
      firstUsefulLogged.current = false;
      criticalLogged.current = Boolean(saved);
    }
    setData(saved?.data ?? previewDetail(route.params?.retailerPreview, retailerId));
    setCriticalReady(Boolean(saved));
    setVisitReady(false);
    setLocationReady(false);
    setHistoryReady(Boolean(saved?.complete));
    setHistoryFailed(false);
    setActiveVisit(null);
    setActiveVisitElsewhere(null);
    setLocation(null);
    setLoading(!saved && !route.params?.retailerPreview);
  }, [retailerId, cacheKey]);

  useEffect(() => {
    marketingHistoryRequest.current += 1;
    setMarketingHistory([]);
    setMarketingHistoryExpanded(false);
    setMarketingHistoryLoaded(false);
    setMarketingHistoryLoading(false);
    setMarketingHistoryFailed(false);
    setExpandedExecutionId(null);
  }, [retailerId]);

  const toggleMarketingHistory = async () => {
    if (marketingHistoryExpanded) {
      setMarketingHistoryExpanded(false);
      return;
    }
    setMarketingHistoryExpanded(true);
    if (marketingHistoryLoaded || marketingHistoryLoading) return;
    const requestId = ++marketingHistoryRequest.current;
    setMarketingHistoryLoading(true);
    setMarketingHistoryFailed(false);
    try {
      const result = await repApi.marketingHistory(retailerId);
      if (marketingHistoryRequest.current === requestId) {
        setMarketingHistory(result.executions ?? []);
        setMarketingHistoryLoaded(true);
      }
    } catch {
      if (marketingHistoryRequest.current === requestId) setMarketingHistoryFailed(true);
    } finally {
      if (marketingHistoryRequest.current === requestId) setMarketingHistoryLoading(false);
    }
  };

  const startExecution = async () => {
    if (startingExecutionRef.current) return;
    startingExecutionRef.current = true;
    setStartingExecution(true);
    try {
      const result = await repApi.startStoreExecution(retailerId);
      setStoreTasks((current) => current.some((task) => task.id === result.task.id) ? current : [result.task, ...current]);
      setEvidenceTask(result.task);
    } catch {
      Alert.alert("Could not start execution", "Check that this store is assigned to you and try again online.");
    } finally {
      startingExecutionRef.current = false;
      setStartingExecution(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const entry = detailCache.get(cacheKey);
      const saved = entry && Date.now() - entry.at < DETAIL_CACHE_MS ? entry : null;
      if (saved && Date.now() - saved.at < DETAIL_CACHE_MS) {
        setData(saved.data);
        setCriticalReady(true);
        setLoading(false);
      }
      void load();
      return () => { requestId.current += 1; };
    }, [load, cacheKey])
  );

  useEffect(() => {
    setTodayField(today);
    setOpportunities((today?.opportunities?.actions ?? []).filter((item: any) => item.retailerId === retailerId));
  }, [today, retailerId]);

  // Home's next-visit action can take the salesperson straight into the
  // existing, location-verified check-in flow. If the store still needs a
  // location, the normal detail screen remains the honest recovery path.
  useEffect(() => {
    if (
      !route.params?.startVisit ||
      !visitReady ||
      !data ||
      location?.status !== "VERIFIED" ||
      activeVisit ||
      activeVisitElsewhere ||
      autoStartAttempted.current ||
      checkInPending.current
    ) return;
    autoStartAttempted.current = true;
    checkInPending.current = true;
    setCheckingIn(true);
    void captureForegroundLocation().then(async (reading) => {
      if (reading.kind !== "captured") {
        Alert.alert("Location needed", reading.kind === "permission_denied" ? "Allow location while using the app to start this visit." : reading.message);
        return;
      }
      try {
        const result = await repApi.checkIn(retailerId, reading);
        if (!result.visit?.id) throw new Error("visit_response_missing_id");
        haptic("medium");
        setActiveVisit(result.visit);
        setActiveRetailer(retailerId);
        navigation.navigate("RepCatalog", { visitId: result.visit.id, retailerId, retailerName: data.retailer.name });
      } catch (error) {
        if (error instanceof Error && error.message === "visit_already_open") void load().catch(() => undefined);
        Alert.alert("Couldn't start visit", t(checkInErrorKey(error)));
      }
    }).catch((error) => {
      if (error instanceof Error && error.message === "visit_already_open") void load().catch(() => undefined);
      Alert.alert("Couldn't start visit", t(checkInErrorKey(error)));
    })
      .finally(() => {
        checkInPending.current = false;
        setCheckingIn(false);
      });
  }, [activeVisit, activeVisitElsewhere, data, load, location?.status, navigation, retailerId, route.params?.startVisit, t, visitReady]);

  if (loading) {
    return (
      <AppScreen>
        <View style={styles.pad}>
          <Skeleton height={88} radius={22} />
          <View style={{ height: 16 }} />
          <Skeleton height={120} radius={16} />
        </View>
      </AppScreen>
    );
  }
  if (!data) {
    return (
      <AppScreen>
        <Text style={styles.muted}>{t("errors.generic")}</Text>
      </AppScreen>
    );
  }

  const { retailer, credit, recentOrders, recentLedger, kyc, financialSummary } = data;
  const reviewRequired = financialSummary?.reconciliationRequired === true;
  const kycApproved = retailer.lifecycle === "active" && (kyc?.status === "approved" || kyc?.legacyVerified === true);
  const blocked = !criticalReady || !visitReady || credit.available <= 0 || !kycApproved;
  const visiting = Boolean(activeVisit && !activeVisit.checkedOutAt);
  const lastOrder = recentOrders[0] ?? data.lastOrderSummary;
  const todayStop = todayField?.route?.stops?.find((stop: any) => stop.retailer?.id === retailer.id);

  const startKyc = async () => {
    navigation.navigate("KycCapture", { retailerId: retailer.id, retailerName: retailer.name });
  };

  const startOrder = () => {
    if (blocked || activeVisitElsewhere) return;
    setActiveRetailer(retailer.id);
    navigation.navigate("RepCatalog", { retailerId: retailer.id, retailerName: retailer.name, visitId: activeVisit?.id });
  };

  const captureStoreLocation = async (mode: "capture" | "verify") => {
    const reading = await captureForegroundLocation();
    if (reading.kind === "permission_denied")
      return Alert.alert(
        "Location permission needed",
        reading.canAskAgain
          ? "Allow while using the app so you can verify this store."
          : "Turn on location access in Settings."
      );
    if (reading.kind === "unavailable") return Alert.alert("Location unavailable", reading.message);
    try {
      const result =
        mode === "verify"
          ? await repApi.verifyLocation(retailer.id, reading)
          : await repApi.captureLocation(retailer.id, reading);
      setLocation(result.location);
      Alert.alert(
        result.location.status === "VERIFIED" ? "Store verified" : "Location captured",
        result.location.status === "VERIFIED"
          ? "This store location is now verified."
          : "A second reading will verify this location."
      );
    } catch (error: any) {
      Alert.alert(
        "Couldn't save location",
        error?.message === "location_accuracy_too_low"
          ? "The GPS reading isn't accurate enough. Move near the storefront and try again."
          : "Try again when you're online."
      );
    }
  };

  const checkIn = async () => {
    if (activeVisitElsewhere) {
      return Alert.alert(t("visit.activeVisitElsewhere"), t("visit.finishBeforeAnother"));
    }
    if (checkInPending.current) return;
    checkInPending.current = true;
    setCheckingIn(true);
    try {
      const reading = await captureForegroundLocation();
      if (reading.kind !== "captured") {
        haptic("warning");
        return Alert.alert(
          "Location needed",
          reading.kind === "permission_denied"
            ? "Allow location while using the app to check in."
            : reading.message
        );
      }
      const result = await repApi.checkIn(retailer.id, reading);
      if (!result.visit?.id) throw new Error("visit_response_missing_id");
      haptic("medium");
      setActiveVisit(result.visit);
      setActiveRetailer(retailer.id);
      navigation.navigate("RepCatalog", { retailerId: retailer.id, retailerName: retailer.name, visitId: result.visit.id });
    } catch (error) {
      if (error instanceof Error && error.message === "visit_already_open") void load().catch(() => undefined);
      Alert.alert("Couldn't check in", t(checkInErrorKey(error)));
    } finally {
      checkInPending.current = false;
      setCheckingIn(false);
    }
  };

  const openVisit = (visit: any) =>
    navigation.navigate("Visit", {
      visitId: visit.id,
      retailerId: retailer.id,
      retailerName: retailer.name,
    });

  const resumeActiveVisitElsewhere = () => {
    if (!activeVisitElsewhere) return;
    navigation.navigate("Visit", {
      visitId: activeVisitElsewhere.id,
      retailerId: activeVisitElsewhere.retailerId,
      retailerName: activeVisitElsewhere.retailer?.name ?? t("retailer.title"),
    });
  };

  const openMaps = () => {
    if (location?.latitude == null || location?.longitude == null) {
      return Alert.alert("No saved location", "Capture the store location first.");
    }
    const { latitude, longitude } = location;
    Linking.openURL(
      `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(retailer.name)})`
    ).catch(() => Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`));
  };

  const locationLabel =
    location?.status === "VERIFIED"
      ? "Location verified"
      : location?.status === "CAPTURED"
        ? "Location captured"
        : location?.status === "NEEDS_REVIEW"
          ? "Location needs review"
      : locationReady ? "Location needed" : "Checking location";

  return (
    <AppScreen>
      <KeyboardSafeScrollView contentContainerStyle={[styles.content, { paddingBottom: 140 + insets.bottom }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} />}>
        <View style={styles.head} onLayout={() => {
          if (!firstUsefulLogged.current) { firstUsefulLogged.current = true; logOpenTiming("first_useful"); }
        }}>
          <InitialsBadge name={retailer.name} size={56} tone={reviewRequired || credit.overdue > 0 ? "danger" : "green"} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{retailer.name}</Text>
            <Text style={styles.address} numberOfLines={2}>
              {retailer.shopAddress}
            </Text>
            <View style={styles.chips}>
              {retailer.tier ? (
                <StatusChip label={`${retailer.tier} retailer`} tone={retailer.tier.toLowerCase() === "gold" ? "gold" : "neutral"} />
              ) : null}
              {retailer.internalSegment ? (
                <StatusChip label={`Internal segment ${retailer.internalSegment}`} tone="neutral" />
              ) : null}
              <StatusChip
                label={locationLabel}
                tone={location?.status === "VERIFIED" ? "green" : location?.status === "NEEDS_REVIEW" ? "warning" : "neutral"}
              />
            </View>
          </View>
        </View>

        {activeVisitElsewhere ? (
          <FocusCard tone="gold">
            <Text style={styles.visitEyebrow}>{t("visit.activeVisitElsewhere")}</Text>
            <Text style={styles.visitTime}>{activeVisitElsewhere.retailer?.name ?? t("retailer.title")}</Text>
            <Text style={styles.muted}>{t("visit.finishBeforeAnother")}</Text>
            <SecondaryButton label={t("visit.resumeActiveVisit")} icon="exit-outline" onPress={resumeActiveVisitElsewhere} />
          </FocusCard>
        ) : visiting ? (
          <FocusCard>
            <Text style={styles.visitEyebrow}>{t("customer.visitInProgress")}</Text>
            <Text style={styles.visitTime}>
              {new Date(activeVisit.checkedInAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
              {activeVisit.distanceFromStoreMeters != null
                ? ` · ${Math.round(Number(activeVisit.distanceFromStoreMeters))} m`
                : ""}
            </Text>
            <PrimaryButton label={t("customer.takeOrder")} icon="cart-outline" disabled={blocked} onPress={startOrder} />
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                {capabilities.canCollect && !reviewRequired && (Number(credit.outstanding) > 0 || Number(credit.overdue) > 0) ? (
                  <SecondaryButton
                    label={t("customer.collect")}
                    icon="wallet-outline"
                    onPress={() => navigation.navigate("Collections", { retailerId: retailer.id })}
                  />
                ) : <View />}
              </View>
              <View style={{ flex: 1 }}>
                <SecondaryButton label={t("visit.finish")} icon="exit-outline" onPress={() => openVisit(activeVisit)} />
              </View>
            </View>
            {capabilities.canLogActivity ? (
              composing ? (
                <ActivityComposer
                  retailerId={retailer.id}
                  visitId={activeVisit.id}
                  onCancel={() => setComposing(false)}
                  onLogged={() => {
                    setComposing(false);
                    void load();
                  }}
                />
              ) : (
                <TextButton label={t("customer.logActivity")} onPress={() => setComposing(true)} />
              )
            ) : null}
          </FocusCard>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {!locationReady ? <PrimaryButton label="Checking location…" icon="location-outline" disabled onPress={() => undefined} /> : location?.status === "VERIFIED" ? (
              <PrimaryButton label={!visitReady ? "Checking visit…" : checkingIn ? "Checking in…" : t("retailer.checkIn")} disabled={checkingIn || !visitReady} icon="locate-outline" onPress={() => void checkIn()} />
            ) : (
              <PrimaryButton
                label={location?.status === "CAPTURED" ? t("retailer.verifyStore") : t("retailer.setStore")}
                icon="location-outline"
                onPress={() => void captureStoreLocation(location?.status === "CAPTURED" ? "verify" : "capture")}
              />
            )}
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <SecondaryButton label={t("customer.navigate")} icon="navigate-outline" onPress={openMaps} />
              </View>
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  label={t("customer.call")}
                  icon="call-outline"
                  onPress={() => Linking.openURL(`tel:${retailer.phone}`)}
                />
              </View>
            </View>
          </View>
        )}

        {baseline ? (
          <Surface>
            <SectionHeader title="Store intelligence" />
            <View style={styles.intelligenceGrid}>
              <View style={styles.intelligenceCell}><Text style={styles.moneyLabel}>Last order</Text><Text style={styles.intelligenceValue}>{baseline.lastOrderAt ? new Date(baseline.lastOrderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "No order yet"}</Text></View>
              <View style={styles.intelligenceCell}><Text style={styles.moneyLabel}>Days since order</Text><Text style={styles.intelligenceValue}>{baseline.daysSinceLastOrder ?? "—"}</Text></View>
              <View style={styles.intelligenceCell}><Text style={styles.moneyLabel}>Average order</Text><Text style={styles.intelligenceValue}>{baseline.averageOrderValue == null ? "—" : inr(baseline.averageOrderValue)}</Text></View>
              <View style={styles.intelligenceCell}><Text style={styles.moneyLabel}>Usual cycle</Text><Text style={styles.intelligenceValue}>{baseline.medianIntervalDays == null ? "Building" : `${baseline.medianIntervalDays} days`}</Text></View>
              <View style={styles.intelligenceCell}><Text style={styles.moneyLabel}>Last visit</Text><Text style={styles.intelligenceValue}>{baseline.lastVisitAt ? new Date(baseline.lastVisitAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</Text></View>
              <View style={styles.intelligenceCell}><Text style={styles.moneyLabel}>Route today</Text><Text style={styles.intelligenceValue}>{todayStop ? (todayStop.status === "visited" ? "Visited" : "Planned") : "Not planned"}</Text></View>
            </View>
            <Text style={styles.intelligenceFoot}>Regular categories: {baseline.regularCategories?.length ? baseline.regularCategories.join(", ") : "Building from order history"}</Text>
            {baseline.trend !== "unknown" ? <StatusChip label={`Recent order trend ${baseline.trend}`} tone={baseline.trend === "rising" ? "green" : baseline.trend === "falling" ? "warning" : "neutral"} /> : null}
            {opportunities.filter((item) => !reviewRequired || item.type !== "COLLECTION_DUE").length > 0 ? (
              <View style={styles.attentionBox}><Text style={styles.attentionTitle}>Needs attention</Text>{opportunities.filter((item) => !reviewRequired || item.type !== "COLLECTION_DUE").slice(0, 2).map((item) => <Text key={item.id ?? item.headline} style={styles.muted}>• {item.headline}</Text>)}</View>
            ) : null}
          </Surface>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("retailer.openOutstandingLedger", { name: retailer.name })}
          onPress={() => navigation.navigate("RepRetailerOutstanding", { retailerId: retailer.id, retailerName: retailer.name })}
          style={({ pressed }) => [pressed && { opacity: 0.82 }]}
        >
          <Surface>
            <View style={styles.moneyRow}>
              <View style={styles.moneyCell}>
                <Text style={styles.moneyLabel}>{t("profile.outstanding")}</Text>
                <Text style={styles.moneyValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {reviewRequired ? "—" : inr(credit.outstanding)}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.primary} />
            </View>
            {reviewRequired ? <Text style={styles.muted}>{t("finance.reviewTitle")}. {t("finance.reviewBody")}</Text> : <EntityAttribution
              amounts={financialSummary?.entityBalances?.outstanding}
              overdue={financialSummary?.entityBalances?.overdue}
              expectedOverdue={Number(credit.overdue)}
              status={financialSummary?.entityBalances?.attributionStatus}
              expectedTotal={Number(credit.outstanding)}
            />}
          </Surface>
        </Pressable>

        {schemes.length > 0 ? (
          <Surface>
            <SectionHeader title="Schemes for this store" />
            {schemes.map((scheme) => (
              <View key={scheme.id} style={styles.schemeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineTitle}>{scheme.name}</Text>
                  <Text style={styles.muted}>{scheme.headline} · Benefit {inr(scheme.discountAmount)}</Text>
                  {scheme.progressPct != null ? <Text style={styles.muted}>{inr(scheme.progress)} of {inr(scheme.targetAmount)} delivered · {scheme.progressPct}%</Text> : <Text style={styles.muted}>Progress is calculated from delivered orders.</Text>}
                </View>
                {scheme.remaining != null ? <StatusChip label={scheme.remaining > 0 ? `${inr(scheme.remaining)} to go` : "Unlocked"} tone={scheme.remaining > 0 ? "gold" : "green"} /> : null}
              </View>
            ))}
          </Surface>
        ) : null}

        {recentOrders.length >= 3 ? (
          <Surface>
            <SectionHeader title="Last 6 orders" />
            <Text style={styles.muted}>A small view of this store's recent order value.</Text>
            <View style={styles.orderBars}>
              {recentOrders.slice(0, 6).map((order: any) => {
                const value = Number(order.orderTotal) || 0;
                const max = Math.max(...recentOrders.slice(0, 6).map((item: any) => Number(item.orderTotal) || 0), 1);
                return <View key={order.id} style={styles.orderBarRow}><Text style={styles.orderBarDate}>{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text><View style={styles.orderBarTrack}><View style={[styles.orderBarFill, { width: `${Math.max(5, (value / max) * 100)}%` }]} /></View><Text style={styles.orderBarValue}>{inr(value)}</Text></View>;
              })}
            </View>
          </Surface>
        ) : null}

        {!reviewRequired && credit.overdue > 0 ? (
          <FocusCard tone="danger">
            <Text style={styles.insight}>{inr(credit.overdue)} overdue</Text>
            <Text style={styles.insightBody}>Collect before taking a large order.</Text>
          </FocusCard>
        ) : lastOrder ? (
          <Text style={styles.insightQuiet}>
            Last order {new Date(lastOrder.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ·{" "}
            {inr(Number(lastOrder.orderTotal))}
          </Text>
        ) : null}

        {criticalReady && kyc?.status !== "approved" ? (
          <Surface>
            <SectionHeader title={t("retailer.kycVerification")} />
            <Text style={styles.muted}>{kyc?.status ? `Case ${kyc.status.replace("_", " ")}` : t("kyc.title")}</Text>
            <TextButton
              label={kyc ? t("retailer.continueKyc") : t("retailer.startKyc")}
              onPress={() => void startKyc()}
            />
          </Surface>
        ) : null}

        {staff?.permissions.includes("survey.respond") ? (
          <Surface level={1}>
            <SectionHeader title="Market survey" />
            <Text style={styles.muted}>Capture this store's current view while you are here.</Text>
            <TextButton
              label="Open store surveys"
              onPress={() => navigation.navigate("MarketSurveys", { retailerId: retailer.id, retailerName: retailer.name })}
            />
          </Surface>
        ) : null}

        {capabilities.canLogActivity ? (
          <View>
            <SectionHeader
              title={t("customer.activityTimeline")}
              action={
                capabilities.canRaiseIssues ? (
                  <TextButton
                    label={t("customer.raiseIssue")}
                    onPress={() =>
                      navigation.navigate("Issues", { retailerId: retailer.id, retailerName: retailer.name })
                    }
                  />
                ) : undefined
              }
            />
            {activities.length === 0 ? (
              <Text style={styles.muted}>{t("customer.noActivity")}</Text>
            ) : (
              activities.slice(0, 8).map((activity: any, index: number, list: any[]) => {
                const event = <TimelineEvent
                  icon="clipboard-outline"
                  title={ACTIVITY_LABELS[activity.type] ?? activity.type}
                  context={[activity.salesperson?.name, activity.notes, activity.followUpAt ? `Follow-up ${new Date(activity.followUpAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : null].filter(Boolean).join(" · ")}
                  time={new Date(activity.occurredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  last={index === list.length - 1}
                />;
                return activity.orderId ? <Pressable key={activity.id} accessibilityRole="button" onPress={() => navigation.navigate("OrderDetail", { orderId: activity.orderId })}>{event}</Pressable> : <View key={activity.id}>{event}</View>;
              })
            )}
            {!visiting && !activeVisitElsewhere && !composing ? (
              <TextButton label={t("customer.logActivity")} onPress={() => setComposing(true)} />
            ) : null}
            {!visiting && !activeVisitElsewhere && composing ? (
              <ActivityComposer
                retailerId={retailer.id}
                visitId={undefined}
                onCancel={() => setComposing(false)}
                onLogged={() => {
                  setComposing(false);
                  void load();
                }}
              />
            ) : null}
          </View>
        ) : null}

        {capabilities.canCompleteTasks ? (
          <View>
            <View style={styles.historyHeader}>
              <Text style={styles.lineTitle}>{t("customer.marketingHistory")}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: marketingHistoryExpanded }}
                onPress={() => void toggleMarketingHistory()}
                style={styles.historyToggle}
              >
                <Text style={styles.historyToggleText}>
                  {marketingHistoryExpanded
                    ? t("customer.closeMarketingHistory")
                    : t("customer.openMarketingHistory")}
                </Text>
                <MaterialCommunityIcons
                  name={marketingHistoryExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.primary}
                />
              </Pressable>
            </View>
            <View style={{ gap: spacing.sm, marginVertical: spacing.md }}>
              <PrimaryButton label={startingExecution ? "Opening…" : "Add execution photos"} icon="camera-outline" onPress={() => void startExecution()} disabled={startingExecution} />
              {storeTasks.map((task: any) => <SecondaryButton
                key={task.id}
                label={`Add photos · ${task.title}`}
                icon="camera-outline"
                onPress={() => setEvidenceTask(task)}
              />)}
            </View>
            {marketingHistoryExpanded ? (
              marketingHistoryLoading ? (
                <Text style={styles.muted}>{t("common.loading")}</Text>
              ) : marketingHistoryFailed ? (
                <Text style={styles.muted}>{t("customer.marketingHistoryLoadFailed")}</Text>
              ) : marketingHistory.length === 0 ? (
                <Text style={styles.muted}>{t("customer.marketingHistoryEmpty")}</Text>
              ) : (
                marketingHistory.map((execution: any, index: number) => {
                  const executionId = execution.task.id;
                  const photosExpanded = expandedExecutionId === executionId;
                  const recordedAt = execution.task.completedAt ?? execution.evidence[0]?.createdAt;
                  return (
                    <View key={executionId}>
                      <TimelineEvent
                        icon="image-multiple-outline"
                        title={execution.task.title}
                        context={[execution.salesperson?.name, execution.task.status.replace(/_/g, " ")].filter(Boolean).join(" · ")}
                        time={recordedAt
                          ? new Date(recordedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          : undefined}
                        last={index === marketingHistory.length - 1}
                      />
                      <View style={styles.historyEvidenceAction}>
                        <TextButton
                          label={t(photosExpanded ? "customer.hideEvidence" : "customer.viewEvidence", { count: execution.evidence.length })}
                          onPress={() => setExpandedExecutionId(photosExpanded ? null : executionId)}
                        />
                      </View>
                      {photosExpanded ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyPhotos}>
                          {execution.evidence.map((item: any) => item.signedUrl ? (
                            <Image
                              key={item.id}
                              source={{ uri: item.signedUrl }}
                              style={styles.historyPhoto}
                              resizeMode="contain"
                              accessibilityLabel={`${execution.task.title} evidence`}
                            />
                          ) : null)}
                        </ScrollView>
                      ) : null}
                    </View>
                  );
                })
              )
            ) : null}
          </View>
        ) : null}

        {recentVisits.length > 0 ? (
          <View>
            <SectionHeader title="Recent visits" />
            {recentVisits.map((visit: any, index: number) => (
              <TimelineEvent
                key={visit.id}
                icon="location-outline"
                title={new Date(visit.checkedInAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                context={[
                  visit.outcome ? visit.outcome.replace(/_/g, " ") : "In progress",
                  visit.verificationStatus === "VERIFIED" ? "Verified" : "Needs review",
                ]
                  .filter(Boolean)
                  .join(" · ")}
                last={index === recentVisits.length - 1}
              />
            ))}
          </View>
        ) : null}

        <View>
          <SectionHeader title={t("retailer.recentOrders")} />
          {historyFailed && !historyReady ? <Text style={styles.muted}>Could not load recent history. Pull down to retry.</Text> : !historyReady ? <Skeleton height={66} radius={8} /> : recentOrders.length === 0 ? (
            <Text style={styles.muted}>{t("retailer.noOrders")}</Text>
          ) : (
            recentOrders.map((o: any, index: number) => (
              <Pressable key={o.id} style={({ pressed }) => [styles.line, pressed && { opacity: 0.72 }]} onPress={() => navigation.navigate("OrderDetail", { orderId: o.id })} accessibilityRole="button" accessibilityLabel={`Open ${formatOrderRef(o)}`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineTitle}>
                    {formatOrderRef(o)}
                    {o.placedBy === "rep" ? "  · by you" : ""}
                  </Text>
                  <Text style={styles.muted}>
                    {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {o.items.length}{" "}
                    item{o.items.length > 1 ? "s" : ""}
                  </Text>
                  {o.commercialStatus?.currentLabel ? <Text style={styles.internalStatus}>{o.commercialStatus.currentLabel}</Text> : null}
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={styles.lineValue}>{inr(Number(o.orderTotal))}</Text>
                  <StatusPill status={o.status} />
                </View>
              </Pressable>
            ))
          )}
        </View>

        <View>
          <SectionHeader title={t("retailer.recentLedger")} />
          {historyFailed && !historyReady ? <Text style={styles.muted}>Recent transactions unavailable.</Text> : !historyReady ? <Skeleton height={66} radius={8} /> : recentLedger.length === 0 ? (
            <Text style={styles.muted}>{t("retailer.noTransactions")}</Text>
          ) : (
            recentLedger.map((e: any) => (
              <View key={e.id} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineTitle}>{LEDGER_LABELS[e.type] ?? "Ledger entry"}</Text>
                  <Text style={styles.muted}>
                    {new Date(e.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </Text>
                  <EntityAttribution
                    amounts={e.entityBreakdown}
                    status={e.entityBreakdown?.attributionStatus}
                    expectedTotal={Number(e.amount)}
                    compact
                  />
                </View>
                <Text
                  style={[
                    styles.lineValue,
                    {
                      color: (e.direction ? e.direction === "debit" : e.type === "invoice") ? colors.danger : colors.primary,
                    },
                  ]}
                >
                  {e.direction ? (e.direction === "debit" ? "+" : "−") : e.type === "invoice" ? "+" : "−"}
                  {inr(Number(e.amount))}
                </Text>
              </View>
            ))
          )}
        </View>
      </KeyboardSafeScrollView>
      <TaskEvidenceSheet visible={Boolean(evidenceTask)} task={evidenceTask} onClose={() => setEvidenceTask(null)} onChanged={() => {
        const requestId = ++marketingHistoryRequest.current;
        setMarketingHistoryExpanded(true);
        setMarketingHistoryLoading(true);
        void repApi.marketingHistory(retailerId).then((result) => {
          if (marketingHistoryRequest.current !== requestId) return;
          setMarketingHistory(result.executions ?? []);
          setMarketingHistoryLoaded(true);
          setMarketingHistoryFailed(false);
        }).catch(() => {
          if (marketingHistoryRequest.current === requestId) setMarketingHistoryFailed(true);
        }).finally(() => {
          if (marketingHistoryRequest.current === requestId) setMarketingHistoryLoading(false);
        });
      }} />

      {!visiting && !activeVisitElsewhere ? (
        <View style={[styles.bar, { paddingBottom: spacing.section + insets.bottom }]}>
          <PrimaryButton
            label={
              credit.available <= 0
                ? "No credit available"
                : !kycApproved
                  ? "KYC approval required"
                  : t("orders.place")
            }
            icon="cart-outline"
            disabled={blocked}
            onPress={startOrder}
          />
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.xl },
  content: { padding: spacing.xl, gap: spacing.section, paddingBottom: 140 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  name: { fontSize: 26, fontWeight: "700", color: colors.ink, letterSpacing: -0.6 },
  address: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  moneyRow: { flexDirection: "row", gap: spacing.lg },
  moneyCell: { flex: 1 },
  moneyLabel: { fontSize: 12, color: colors.textSecondary },
  moneyValue: { fontSize: 24, fontWeight: "700", color: colors.ink, marginTop: 4 },
  insight: { fontSize: 17, fontWeight: "600", color: colors.danger },
  insightBody: { fontSize: 13, color: colors.textSecondary },
  insightQuiet: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  visitEyebrow: { fontSize: 12, fontWeight: "600", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.4 },
  visitTime: { fontSize: 15, color: colors.ink },
  actions: { flexDirection: "row", gap: spacing.sm },
  muted: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" },
  historyToggle: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 40 },
  historyToggleText: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  historyEvidenceAction: { marginLeft: 46, marginTop: -spacing.sm },
  historyPhotos: { gap: spacing.sm, paddingLeft: 46, paddingVertical: spacing.sm },
  historyPhoto: { width: 112, height: 88, borderRadius: 4, backgroundColor: colors.track },
  internalStatus: { fontSize: 11.5, color: colors.blueInk, fontWeight: "600", marginTop: 3 },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  lineTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  lineValue: { fontSize: 14, fontWeight: "600", color: colors.ink },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.section,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  intelligenceGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  intelligenceCell: { width: "46%" },
  intelligenceValue: { fontSize: 15, fontWeight: "600", color: colors.ink, marginTop: 3 },
  intelligenceFoot: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: spacing.md },
  attentionBox: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.separator, gap: 4 },
  attentionTitle: { fontSize: 13, fontWeight: "600", color: colors.danger },
  orderBars: { marginTop: spacing.md, gap: spacing.sm },
  orderBarRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  orderBarDate: { width: 42, fontSize: 11, color: colors.textSecondary },
  orderBarTrack: { flex: 1, height: 8, borderRadius: 99, backgroundColor: colors.track, overflow: "hidden" },
  orderBarFill: { height: "100%", borderRadius: 99, backgroundColor: colors.blue },
  orderBarValue: { width: 64, textAlign: "right", fontSize: 11, color: colors.ink },
  schemeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.separator },
});
