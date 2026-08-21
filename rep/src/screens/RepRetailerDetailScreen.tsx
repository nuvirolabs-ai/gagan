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
import { colors, radius, spacing, shadow, inr } from "../theme";
import { StatusPill } from "../components/ui";

const LEDGER_LABELS: Record<string, string> = {
  invoice: "Invoice",
  payment: "Payment received",
  credit_note: "Credit note",
  payment_reversal: "Payment reversed",
};

export default function RepRetailerDetailScreen({ route, navigation }: any) {
  const { retailerId } = route.params;
  const { setActiveRetailer } = useRep();
  const [data, setData] = useState<any | null>(null);
  const [location, setLocation] = useState<any | null>(null);
  const [activeVisit, setActiveVisit] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([repApi.retailer(retailerId), repApi.getLocation(retailerId), repApi.visits()])
        .then(([retailerData, locationData, visitData]) => {
          setData(retailerData);
          setLocation(locationData.location);
          setActiveVisit((visitData.visits ?? []).find((visit: any) => visit.retailerId === retailerId && !visit.checkedOutAt) ?? null);
        })
        .catch(() => { setData(null); setLocation(null); })
        .finally(() => setLoading(false));
    }, [retailerId])
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
        <Text style={styles.muted}>Couldn't load this retailer.</Text>
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
      const message = result.visit.verificationStatus === "VERIFIED" ? "Visit verified." : result.visit.verificationStatus === "OUTSIDE_STORE_AREA" ? "You're outside the registered store area. You can try again or leave this visit for review." : "Location captured. This visit is available for review.";
      Alert.alert("Check-in recorded", message);
    } catch { Alert.alert("Couldn't check in", "Try again when you're online."); }
  };

  const checkOut = async () => {
    if (!activeVisit) return;
    const reading = await captureForegroundLocation();
    if (reading.kind !== "captured") return Alert.alert("Location needed", "Allow location while using the app to check out.");
    try { const result = await repApi.checkOut(activeVisit.id, reading); setActiveVisit(result.visit); Alert.alert("Checked out", "Your visit time has been recorded."); } catch { Alert.alert("Couldn't check out", "Try again when you're online."); }
  };

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
            <View><Text style={styles.creditTitle}>KYC verification</Text><Text style={styles.rowSub}>{kyc?.status ? `Case ${kyc.status.replace("_", " ")}` : "No case started"}</Text></View>
            <StatusPill status={kyc?.status === "approved" ? "active" : "pending"} />
          </View>
          {kyc?.status !== "approved" ? <><Text style={styles.warnText}>Complete and submit the three required documents before dispatch.</Text><TouchableOpacity style={styles.kycButton} onPress={() => void startKyc()}><Text style={styles.kycButtonText}>{kyc ? "Continue KYC" : "Start KYC case"}</Text></TouchableOpacity></> : <Text style={styles.successText}>Documents approved. Dispatch is enabled.</Text>}
        </View>

        <View style={styles.locationCard}>
          <View style={styles.between}>
            <View><Text style={styles.creditTitle}>Store location</Text><Text style={styles.rowSub}>{location?.status === "VERIFIED" ? "✓ Verified" : location?.status === "CAPTURED" ? "Captured — verify while at the store" : location?.status === "NEEDS_REVIEW" ? "Needs review" : "Not set"}</Text></View>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={22} color={colors.green} />
          </View>
          <View style={styles.locationActions}>
            {location?.status === "VERIFIED" ? <TouchableOpacity style={styles.visitButton} onPress={() => void checkIn()}><Ionicons name="locate-outline" size={16} color={colors.onDark} /><Text style={styles.visitButtonText}>{activeVisit ? "Checked in" : "Check in"}</Text></TouchableOpacity> : <TouchableOpacity style={styles.locationButton} onPress={() => void captureStoreLocation(location?.status === "CAPTURED" ? "verify" : "capture")}><Text style={styles.locationButtonText}>{location?.status === "CAPTURED" ? "Verify store location" : "Set store location"}</Text></TouchableOpacity>}
            {activeVisit && !activeVisit.checkedOutAt ? <TouchableOpacity style={styles.locationButton} onPress={() => void checkOut()}><Text style={styles.locationButtonText}>Check out</Text></TouchableOpacity> : null}
          </View>
          {activeVisit?.verificationStatus ? <Text style={styles.rowSub}>Visit: {activeVisit.verificationStatus === "VERIFIED" ? "Verified" : activeVisit.verificationStatus === "OUTSIDE_STORE_AREA" ? "Outside store area" : "Needs review"}{activeVisit.distanceFromStoreMeters != null ? ` · ${Math.round(Number(activeVisit.distanceFromStoreMeters))} m` : ""}</Text> : null}
        </View>

        <View style={styles.creditCard}>
          <View style={styles.between}>
            <Text style={styles.creditTitle}>Credit position</Text>
            <View style={styles.tierBadge}>
              <MaterialCommunityIcons name="crown" size={11} color={colors.gold} />
              <Text style={styles.tierText}>{retailer.tier}</Text>
            </View>
          </View>

          <View style={styles.creditRow}>
            <View style={styles.creditCell}>
              <Text style={styles.creditLabel}>Outstanding</Text>
              <Text style={styles.creditBig}>{inr(credit.outstanding)}</Text>
            </View>
            <View style={styles.creditCell}>
              <Text style={styles.creditLabel}>Available</Text>
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

        <Text style={styles.sectionTitle}>Recent orders</Text>
        <View style={styles.card}>
          {recentOrders.length === 0 ? (
            <Text style={styles.muted}>No orders yet.</Text>
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

        <Text style={styles.sectionTitle}>Recent ledger</Text>
        <View style={styles.card}>
          {recentLedger.length === 0 ? (
            <Text style={styles.muted}>No transactions yet.</Text>
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
