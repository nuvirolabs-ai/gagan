import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { repApi } from "../api/repClient";
import { captureForegroundLocation } from "../location/deviceLocation";
import { useRep } from "../context/RepContext";
import { staffCapabilities } from "../auth/staffCapabilities";
import { colors, radius, spacing, shadow, inr } from "../theme";
import { ListRow, SecondaryButton, StatusPill, Tag } from "../components/ui";
import ActivityComposer, { ACTIVITY_LABELS } from "../components/ActivityComposer";
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
        .catch(() => { setData(null); setLocation(null); })
        .finally(() => setLoading(false));
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t("errors.generic")}</Text>
      </View>
    );
  }

  const { retailer, credit, recentOrders, recentLedger, kyc } = data;
  const kycApproved = retailer.lifecycle === "active" && (kyc?.status === "approved" || kyc?.legacyVerified === true);
  const blocked = credit.available <= 0 || !kycApproved;

  const startKyc = async () => {
    navigation.navigate("KycCapture", { retailerId: retailer.id, retailerName: retailer.name });
  };

  const startOrder = () => {
    setActiveRetailer(retailer.id);
    navigation.navigate("RepCatalog", { retailerId: retailer.id, retailerName: retailer.name });
  };

  const captureStoreLocation = async (mode: "capture" | "verify") => {
    const reading = await captureForegroundLocation();
    if (reading.kind === "permission_denied") return Alert.alert("Location permission needed", reading.canAskAgain ? "Allow while using the app so you can verify this store." : "Turn on location access in Settings.");
    if (reading.kind === "unavailable") return Alert.alert("Location unavailable", reading.message);
    try {
      const result = mode === "verify"
        ? await repApi.verifyLocation(retailer.id, reading)
        : await repApi.captureLocation(retailer.id, reading);
      setLocation(result.location);
      Alert.alert(result.location.status === "VERIFIED" ? "Store verified" : "Location captured", result.location.status === "VERIFIED" ? "This store location is now verified." : "A second reading will verify this location.");
    } catch (error: any) {
      Alert.alert("Couldn't save location", error?.message === "location_accuracy_too_low" ? "The GPS reading isn't accurate enough. Move near the storefront and try again." : "Try again when you're online.");
    }
  };

  const checkIn = async () => {
    const reading = await captureForegroundLocation();
    if (reading.kind !== "captured") return Alert.alert("Location needed", reading.kind === "permission_denied" ? "Allow location while using the app to check in." : reading.message);
    try {
      const result = await repApi.checkIn(retailer.id, reading);
      setActiveVisit(result.visit);
      // Check-in opens the visit workspace, where the salesperson logs what
      // happened and closes the visit out with an outcome.
      openVisit(result.visit);
    } catch { Alert.alert("Couldn't check in", "Try again when you're online."); }
  };

  const openVisit = (visit: any) =>
    navigation.navigate("Visit", {
      visitId: visit.id,
      retailerId: retailer.id,
      retailerName: retailer.name,
    });

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {retailer.name
                .split(" ")
                .map((p: string) => p[0])
                .slice(0, 2)
                .join("")}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{retailer.name}</Text>
            <Text style={styles.sub}>{retailer.shopAddress}</Text>
          </View>
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${retailer.phone}`)}
          >
            <Ionicons name="call" size={17} color={colors.onDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.kycCard}>
          <View style={styles.between}>
            <View><Text style={styles.creditTitle}>{t("retailer.kycVerification")}</Text><Text style={styles.rowSub}>{kyc?.status ? `Case ${kyc.status.replace("_", " ")}` : t("common.retry")}</Text></View>
            <Tag
              label={kyc?.status === "approved" ? t("status.verified") : t("status.pending")}
              tone={kyc?.status === "approved" ? "green" : "gold"}
            />
          </View>
          {kyc?.status !== "approved" ? <><Text style={styles.warnText}>{t("kyc.title")}</Text><TouchableOpacity style={styles.kycButton} onPress={() => void startKyc()}><Text style={styles.kycButtonText}>{kyc ? t("retailer.continueKyc") : t("retailer.startKyc")}</Text></TouchableOpacity></> : <Text style={styles.successText}>{t("retailer.documentsApproved")}</Text>}
        </View>

        <View style={styles.locationCard}>
          <View style={styles.between}>
            <View><Text style={styles.creditTitle}>{t("retailer.storeLocation")}</Text><Text style={styles.rowSub}>{location?.status === "VERIFIED" ? "✓ Verified" : location?.status === "CAPTURED" ? "Captured — verify while at the store" : location?.status === "NEEDS_REVIEW" ? "Needs review" : "Not set"}</Text></View>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={22} color={colors.green} />
          </View>
          <View style={styles.locationActions}>
            {location?.status === "VERIFIED" ? <TouchableOpacity style={styles.visitButton} onPress={() => void checkIn()}><Ionicons name="locate-outline" size={16} color={colors.onDark} /><Text style={styles.visitButtonText}>{activeVisit ? t("retailer.checkIn") : t("retailer.checkIn")}</Text></TouchableOpacity> : <TouchableOpacity style={styles.locationButton} onPress={() => void captureStoreLocation(location?.status === "CAPTURED" ? "verify" : "capture")}><Text style={styles.locationButtonText}>{location?.status === "CAPTURED" ? t("retailer.verifyStore") : t("retailer.setStore")}</Text></TouchableOpacity>}
            {activeVisit && !activeVisit.checkedOutAt ? <TouchableOpacity style={styles.locationButton} onPress={() => openVisit(activeVisit)}><Text style={styles.locationButtonText}>Open visit</Text></TouchableOpacity> : null}
          </View>
          {activeVisit?.verificationStatus ? <Text style={styles.rowSub}>Visit: {activeVisit.verificationStatus === "VERIFIED" ? "Verified" : activeVisit.verificationStatus === "OUTSIDE_STORE_AREA" ? "Outside store area" : "Needs review"}{activeVisit.distanceFromStoreMeters != null ? ` · ${Math.round(Number(activeVisit.distanceFromStoreMeters))} m` : ""}</Text> : null}
        </View>

        <View style={styles.creditCard}>
          <View style={styles.between}>
            <Text style={styles.creditTitle}>{t("retailer.creditPosition")}</Text>
            <View style={styles.tierBadge}>
              <MaterialCommunityIcons name="crown" size={11} color={colors.gold} />
              <Text style={styles.tierText}>{retailer.tier}</Text>
            </View>
          </View>

          <View style={styles.creditRow}>
            <View style={styles.creditCell}>
              <Text style={styles.creditLabel}>{t("profile.outstanding")}</Text>
              <Text style={styles.creditBig}>{inr(credit.outstanding)}</Text>
            </View>
            <View style={styles.creditCell}>
              <Text style={styles.creditLabel}>{t("profile.availableCredit")}</Text>
              <Text style={[styles.creditBig, { color: blocked ? colors.danger : colors.green }]}>
                {inr(credit.available)}
              </Text>
            </View>
          </View>

          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.min(100, credit.utilisationPct)}%`,
                  backgroundColor: credit.utilisationPct >= 90 ? colors.danger : colors.green,
                },
              ]}
            />
          </View>
          <Text style={styles.limitLine}>
            {credit.utilisationPct}% of {inr(credit.creditLimit)} limit used
          </Text>

          {credit.overdue > 0 && (
            <View style={styles.warn}>
              <Ionicons name="alert-circle" size={14} color={colors.danger} />
              <Text style={styles.warnText}>
                {inr(credit.overdue)} is overdue — collect before taking a large order.
              </Text>
            </View>
          )}
        </View>

        {capabilities.canLogActivity ? (
          <>
            <Text style={styles.sectionTitle}>{t("customer.activityTimeline")}</Text>
            <View style={styles.card}>
              {activities.length === 0 ? (
                <Text style={styles.muted}>{t("customer.noActivity")}</Text>
              ) : (
                activities.slice(0, 8).map((activity: any, index: number) => (
                  <ListRow
                    key={activity.id}
                    first={index === 0}
                    icon="clipboard-outline"
                    title={ACTIVITY_LABELS[activity.type] ?? activity.type}
                    subtitle={[
                      new Date(activity.occurredAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      }),
                      activity.salesperson?.name,
                      activity.notes,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ))
              )}
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                {composing ? (
                  <ActivityComposer
                    retailerId={retailer.id}
                    visitId={activeVisit && !activeVisit.checkedOutAt ? activeVisit.id : undefined}
                    onCancel={() => setComposing(false)}
                    onLogged={() => {
                      setComposing(false);
                      void load();
                    }}
                  />
                ) : (
                  <SecondaryButton
                    label={t("customer.logActivity")}
                    icon="add-circle-outline"
                    onPress={() => setComposing(true)}
                  />
                )}
                {capabilities.canRaiseIssues && !composing ? (
                  <SecondaryButton
                    label={t("customer.raiseIssue")}
                    icon="alert-circle-outline"
                    onPress={() =>
                      navigation.navigate("Issues", {
                        retailerId: retailer.id,
                        retailerName: retailer.name,
                      })
                    }
                  />
                ) : null}
              </View>
            </View>

            {recentVisits.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Recent visits</Text>
                <View style={styles.card}>
                  {recentVisits.map((visit: any, index: number) => (
                    <ListRow
                      key={visit.id}
                      first={index === 0}
                      icon="location-outline"
                      title={new Date(visit.checkedInAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      subtitle={[
                        visit.outcome ? visit.outcome.replace(/_/g, " ") : "In progress",
                        visit.verificationStatus === "VERIFIED" ? "Verified" : "Needs review",
                        visit.distanceFromStoreMeters != null
                          ? `${Math.round(Number(visit.distanceFromStoreMeters))} m`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      onPress={!visit.checkedOutAt ? () => openVisit(visit) : undefined}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}

        <Text style={styles.sectionTitle}>{t("retailer.recentOrders")}</Text>
        <View style={styles.card}>
          {recentOrders.length === 0 ? (
            <Text style={styles.muted}>{t("retailer.noOrders")}</Text>
          ) : (
            recentOrders.map((o: any, i: number) => (
              <View
                key={o.id}
                style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    GGN-{String(o.orderNo).padStart(5, "0")}
                    {o.placedBy === "rep" ? "  · by you" : ""}
                  </Text>
                  <Text style={styles.rowSub}>
                    {new Date(o.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {o.items.length} item{o.items.length > 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={styles.rowValue}>{inr(Number(o.orderTotal))}</Text>
                  <StatusPill status={o.status} />
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>{t("retailer.recentLedger")}</Text>
        <View style={styles.card}>
          {recentLedger.length === 0 ? (
            <Text style={styles.muted}>{t("retailer.noTransactions")}</Text>
          ) : (
            recentLedger.map((e: any, i: number) => (
              <View
                key={e.id}
                style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {LEDGER_LABELS[e.type] ?? "Ledger entry"}
                  </Text>
                  <Text style={styles.rowSub}>
                    {new Date(e.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.rowValue,
                    {
                      color:
                        (e.direction ? e.direction === "debit" : e.type === "invoice")
                          ? colors.danger
                          : colors.green,
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

      <View style={styles.bar}>
        <TouchableOpacity
          style={[styles.orderBtn, blocked && styles.orderBtnDisabled]}
          disabled={blocked}
          onPress={startOrder}
        >
          <Ionicons name="cart-outline" size={18} color={colors.onDark} />
          <Text style={styles.orderBtnText}>
            {credit.available <= 0 ? "No credit available" : !kycApproved ? "KYC approval required" : "Place order for this shop"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  muted: { color: colors.inkMuted, fontSize: 13 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  head: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "800", color: colors.green },
  name: { fontSize: 19, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 12.5, color: colors.inkMuted, marginTop: 2 },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.greenDeep,
    alignItems: "center",
    justifyContent: "center",
  },

  creditCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  kycCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  locationCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  locationActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  locationButton: { flex: 1, backgroundColor: colors.greenSoft, borderRadius: radius.sm, padding: spacing.md, alignItems: "center" },
  locationButtonText: { color: colors.green, fontWeight: "700", fontSize: 12 },
  visitButton: { flex: 1, backgroundColor: colors.greenDeep, borderRadius: radius.sm, padding: spacing.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  visitButtonText: { color: colors.onDark, fontWeight: "700", fontSize: 12 },
  kycButton: { marginTop: spacing.md, backgroundColor: colors.greenSoft, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  kycButtonText: { color: colors.green, fontWeight: "700" },
  successText: { color: colors.green, fontSize: 12, marginTop: spacing.sm },
  creditTitle: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tierText: { fontSize: 10.5, fontWeight: "800", color: "#8A6A12" },
  creditRow: { flexDirection: "row", marginTop: spacing.lg },
  creditCell: { flex: 1 },
  creditLabel: { fontSize: 11.5, color: colors.inkMuted },
  creditBig: { fontSize: 19, fontWeight: "700", color: colors.ink, marginTop: 3 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.track,
    overflow: "hidden",
    marginTop: spacing.lg,
  },
  fill: { height: "100%", borderRadius: 3 },
  limitLine: { fontSize: 11.5, color: colors.inkMuted, marginTop: spacing.sm },
  warn: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  warnText: { flex: 1, fontSize: 11.5, color: colors.danger, fontWeight: "600", lineHeight: 16 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  rowTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  rowSub: { fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  rowValue: { fontSize: 14, fontWeight: "700", color: colors.ink },

  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.greenDeep,
    borderRadius: radius.sm,
    paddingVertical: 15,
  },
  orderBtnDisabled: { opacity: 0.4 },
  orderBtnText: { color: colors.onDark, fontWeight: "700", fontSize: 15 },
});
