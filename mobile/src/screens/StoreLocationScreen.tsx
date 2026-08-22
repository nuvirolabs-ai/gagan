import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "../api/client";
import { captureForegroundLocation } from "../location/deviceLocation";
import { colors, radius, spacing, shadow } from "../theme";
import { ScreenHeader } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";

const STATUS_LABEL: Record<string, string> = {
  NOT_SET: "Store location not set",
  CAPTURED: "Location captured",
  VERIFIED: "Verified",
  NEEDS_REVIEW: "Location needs review",
};

export default function StoreLocationScreen() {
  const { t } = useLanguage();
  const [location, setLocation] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [changeMode, setChangeMode] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.getLocation().then((result) => setLocation(result.location)).catch(() => setLocation(null)).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const capture = async () => {
    setMessage(null);
    setCapturing(true);
    const result = await captureForegroundLocation();
    if (result.kind === "permission_denied") {
      setMessage(result.canAskAgain ? "Gagan needs your location to confirm the store. You can allow it when prompted." : "Location permission is off. Open Settings to allow Gagan to verify your store.");
      setCapturing(false);
      return;
    }
    if (result.kind === "unavailable") {
      setMessage(result.message);
      setCapturing(false);
      return;
    }
    Alert.alert("Is this your store location?", `Accuracy ±${Math.round(result.accuracyMeters)} m`, [
      { text: "Try again", style: "cancel", onPress: () => setCapturing(false) },
      {
        text: "Confirm location",
        onPress: async () => {
          try {
            const body = { latitude: result.latitude, longitude: result.longitude, accuracyMeters: result.accuracyMeters, devicePlatform: result.devicePlatform };
            const response = location?.status === "CAPTURED" ? await api.verifyLocation(body) : await api.captureLocation(body);
            setLocation(response.location);
            setMessage("Location saved. A salesperson can verify it during a visit.");
          } catch (error: any) {
            setMessage(error?.message === "location_accuracy_too_low" ? "Your location isn't accurate enough yet. Move near the storefront or an open area and try again." : "We couldn't save the location. Try again when you're online.");
          } finally { setCapturing(false); }
        },
      },
    ]);
  };

  const submitChange = async () => {
    if (!reason.trim()) return setMessage("Tell us why the store location needs to change.");
    try {
      const response = await api.requestLocationChange(reason.trim());
      setLocation(response.location);
      setReason("");
      setChangeMode(false);
      setMessage("Change requested. A salesperson will verify the new location.");
    } catch { setMessage("We couldn't submit the change request. Try again when you're online."); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.green} /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <ScreenHeader title={t("location.title")} subtitle={t("location.subtitle")} />
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={styles.icon}><MaterialCommunityIcons name="map-marker-radius-outline" size={24} color={colors.green} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{STATUS_LABEL[location?.status ?? "NOT_SET"]}</Text>
            <Text style={styles.body}>{location?.accuracyMeters ? `Last reading ±${Math.round(Number(location.accuracyMeters))} m` : t("location.notSet")}</Text>
          </View>
        </View>
        {message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}
        {location?.status !== "VERIFIED" ? <TouchableOpacity style={styles.primary} onPress={() => void capture()} disabled={capturing}>
          {capturing ? <ActivityIndicator color={colors.onDark} /> : <><Ionicons name="locate-outline" size={18} color={colors.onDark} /><Text style={styles.primaryText}>{location?.status === "NOT_SET" ? t("location.atStore") : t("location.verify")}</Text></>}
        </TouchableOpacity> : null}
        {location?.status === "VERIFIED" ? (
          changeMode ? (
            <View style={styles.changeBox}>
              <Text style={styles.label}>{t("location.changeReason")}</Text>
              <TextInput value={reason} onChangeText={setReason} placeholder="Store moved, incorrect pin…" placeholderTextColor={colors.inkFaint} style={styles.input} />
              <View style={styles.actions}><TouchableOpacity onPress={() => setChangeMode(false)}><Text style={styles.cancel}>{t("common.cancel")}</Text></TouchableOpacity><TouchableOpacity onPress={() => void submitChange()}><Text style={styles.submit}>{t("location.submitRequest")}</Text></TouchableOpacity></View>
            </View>
          ) : <TouchableOpacity style={styles.secondary} onPress={() => setChangeMode(true)}><Text style={styles.secondaryText}>{t("location.requestChange")}</Text></TouchableOpacity>
        ) : null}
        {message?.includes("Open Settings") ? <TouchableOpacity style={styles.secondary} onPress={() => void Linking.openSettings()}><Text style={styles.secondaryText}>{t("location.openSettings")}</Text></TouchableOpacity> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.surface, margin: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  statusRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  icon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  body: { fontSize: 12.5, color: colors.inkMuted, marginTop: 4 },
  message: { backgroundColor: colors.goldSoft, padding: spacing.md, borderRadius: radius.sm, marginTop: spacing.lg },
  messageText: { color: colors.ink, fontSize: 12.5, lineHeight: 18 },
  primary: { marginTop: spacing.lg, backgroundColor: colors.greenDeep, borderRadius: radius.sm, minHeight: 48, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm },
  primaryText: { color: colors.onDark, fontWeight: "700", fontSize: 14 },
  secondary: { marginTop: spacing.md, alignItems: "center", padding: spacing.sm },
  secondaryText: { color: colors.green, fontWeight: "700", fontSize: 13 },
  changeBox: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  label: { color: colors.inkMuted, fontSize: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, marginTop: spacing.sm, padding: spacing.md, color: colors.ink },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.lg, marginTop: spacing.md },
  cancel: { color: colors.inkMuted, fontWeight: "600" },
  submit: { color: colors.green, fontWeight: "700" },
});
