import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { repApi } from "../api/repClient";
import { captureForegroundLocation } from "../location/deviceLocation";
import { useRep } from "../context/RepContext";
import { staffCapabilities } from "../auth/staffCapabilities";
import { colors, inr, spacing } from "../theme";
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
} from "../components/ui";
import ActivityComposer, { ACTIVITY_LABELS } from "../components/ActivityComposer";
import { haptic } from "../feedback/haptics";
import { useLanguage } from "../i18n/LanguageContext";

const LEDGER_LABELS: Record<string, string> = {
  invoice: "Invoice",
  payment: "Payment received",
  credit_note: "Credit note",
  payment_reversal: "Payment reversed",
};

export default function RepRetailerDetailScreen({ route, navigation }: any) {
  const { retailerId } = route.params;
  const { setActiveRetailer, staff } = useRep();
  const { t } = useLanguage();
  const capabilities = staffCapabilities(staff?.permissions ?? []);
  const [data, setData] = useState<any | null>(null);
  const [location, setLocation] = useState<any | null>(null);
  const [activeVisit, setActiveVisit] = useState<any | null>(null);
  const [recentVisits, setRecentVisits] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [composing, setComposing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [retailerData, locationData, visitData, activityData] = await Promise.all([
      repApi.retailer(retailerId),
      repApi.getLocation(retailerId),
      repApi.visits(),
      capabilities.canLogActivity
        ? repApi.customerActivities(retailerId).catch(() => ({ activities: [] }))
        : Promise.resolve({ activities: [] }),
    ]);
    const visits = (visitData.visits ?? []).filter((visit: any) => visit.retailerId === retailerId);
    setData(retailerData);
    setLocation(locationData.location);
    setActiveVisit(visits.find((visit: any) => !visit.checkedOutAt) ?? null);
    setRecentVisits(visits.slice(0, 5));
    setActivities(activityData.activities ?? []);
  }, [retailerId, capabilities.canLogActivity]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => {
          setData(null);
          setLocation(null);
        })
        .finally(() => setLoading(false));
    }, [load])
  );

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

  const { retailer, credit, recentOrders, recentLedger, kyc } = data;
  const kycApproved = retailer.lifecycle === "active" && (kyc?.status === "approved" || kyc?.legacyVerified === true);
  const blocked = credit.available <= 0 || !kycApproved;
  const visiting = Boolean(activeVisit && !activeVisit.checkedOutAt);
  const lastOrder = recentOrders[0];

  const startKyc = async () => {
    navigation.navigate("KycCapture", { retailerId: retailer.id, retailerName: retailer.name });
  };

  const startOrder = () => {
    setActiveRetailer(retailer.id);
    navigation.navigate("RepCatalog", { retailerId: retailer.id, retailerName: retailer.name });
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
    try {
      const result = await repApi.checkIn(retailer.id, reading);
      haptic("medium");
      setActiveVisit(result.visit);
      openVisit(result.visit);
    } catch {
      Alert.alert("Couldn't check in", "Try again when you're online.");
    }
  };

  const openVisit = (visit: any) =>
    navigation.navigate("Visit", {
      visitId: visit.id,
      retailerId: retailer.id,
      retailerName: retailer.name,
    });

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
          : "Location needed";

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <InitialsBadge name={retailer.name} size={56} tone={credit.overdue > 0 ? "danger" : "green"} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{retailer.name}</Text>
            <Text style={styles.address} numberOfLines={2}>
              {retailer.shopAddress}
            </Text>
            <View style={styles.chips}>
              {retailer.tier ? (
                <StatusChip label={`${retailer.tier} retailer`} tone={retailer.tier.toLowerCase() === "gold" ? "gold" : "neutral"} />
              ) : null}
              <StatusChip
                label={locationLabel}
                tone={location?.status === "VERIFIED" ? "green" : location?.status === "NEEDS_REVIEW" ? "warning" : "neutral"}
              />
            </View>
          </View>
        </View>

        <Surface>
          <View style={styles.moneyRow}>
            <View style={styles.moneyCell}>
              <Text style={styles.moneyLabel}>{t("profile.outstanding")}</Text>
              <Text style={styles.moneyValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {inr(credit.outstanding)}
              </Text>
            </View>
            <View style={styles.moneyCell}>
              <Text style={styles.moneyLabel}>{t("profile.availableCredit")}</Text>
              <Text
                style={[styles.moneyValue, { color: blocked ? colors.danger : colors.primary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {inr(credit.available)}
              </Text>
            </View>
          </View>
        </Surface>

        {credit.overdue > 0 ? (
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

        {visiting ? (
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
                <SecondaryButton
                  label={t("customer.collect")}
                  icon="wallet-outline"
                  onPress={() => navigation.navigate("Collections")}
                />
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
            {location?.status === "VERIFIED" ? (
              <PrimaryButton label={t("retailer.checkIn")} icon="locate-outline" onPress={() => void checkIn()} />
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

        {kyc?.status !== "approved" ? (
          <Surface>
            <SectionHeader title={t("retailer.kycVerification")} />
            <Text style={styles.muted}>{kyc?.status ? `Case ${kyc.status.replace("_", " ")}` : t("kyc.title")}</Text>
            <TextButton
              label={kyc ? t("retailer.continueKyc") : t("retailer.startKyc")}
              onPress={() => void startKyc()}
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
              activities.slice(0, 8).map((activity: any, index: number, list: any[]) => (
                <TimelineEvent
                  key={activity.id}
                  icon="clipboard-outline"
                  title={ACTIVITY_LABELS[activity.type] ?? activity.type}
                  context={[activity.salesperson?.name, activity.notes].filter(Boolean).join(" · ")}
                  time={new Date(activity.occurredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  last={index === list.length - 1}
                />
              ))
            )}
            {!visiting && !composing ? (
              <TextButton label={t("customer.logActivity")} onPress={() => setComposing(true)} />
            ) : null}
            {!visiting && composing ? (
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
          {recentOrders.length === 0 ? (
            <Text style={styles.muted}>{t("retailer.noOrders")}</Text>
          ) : (
            recentOrders.map((o: any, index: number) => (
              <View key={o.id} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineTitle}>
                    GGN-{String(o.orderNo).padStart(5, "0")}
                    {o.placedBy === "rep" ? "  · by you" : ""}
                  </Text>
                  <Text style={styles.muted}>
                    {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {o.items.length}{" "}
                    item{o.items.length > 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={styles.lineValue}>{inr(Number(o.orderTotal))}</Text>
                  <StatusPill status={o.status} />
                </View>
              </View>
            ))
          )}
        </View>

        <View>
          <SectionHeader title={t("retailer.recentLedger")} />
          {recentLedger.length === 0 ? (
            <Text style={styles.muted}>{t("retailer.noTransactions")}</Text>
          ) : (
            recentLedger.map((e: any) => (
              <View key={e.id} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineTitle}>{LEDGER_LABELS[e.type] ?? "Ledger entry"}</Text>
                  <Text style={styles.muted}>
                    {new Date(e.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </Text>
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
      </ScrollView>

      {!visiting ? (
        <View style={styles.bar}>
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
  name: { fontSize: 22, fontWeight: "600", color: colors.ink, letterSpacing: -0.3 },
  address: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  moneyRow: { flexDirection: "row", gap: spacing.lg },
  moneyCell: { flex: 1 },
  moneyLabel: { fontSize: 12, color: colors.textSecondary },
  moneyValue: { fontSize: 22, fontWeight: "600", color: colors.ink, marginTop: 4 },
  insight: { fontSize: 17, fontWeight: "600", color: colors.danger },
  insightBody: { fontSize: 13, color: colors.textSecondary },
  insightQuiet: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  visitEyebrow: { fontSize: 12, fontWeight: "600", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.4 },
  visitTime: { fontSize: 15, color: colors.ink },
  actions: { flexDirection: "row", gap: spacing.sm },
  muted: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  lineTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  lineValue: { fontSize: 14, fontWeight: "600", color: colors.ink },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.section,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
});
