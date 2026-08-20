import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../components/ui";
import { useRep } from "../context/RepContext";
import { staffCapabilities } from "../auth/staffCapabilities";
import { colors, radius, spacing } from "../theme";

export default function StaffHomeScreen() {
  const { staff } = useRep();
  const capabilities = staffCapabilities(staff?.permissions ?? []);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Work" subtitle={`Hi ${staff?.name ?? ""}`} />
      <View style={styles.card}>
        <View style={styles.icon}><Ionicons name="shield-checkmark-outline" size={24} color={colors.green} /></View>
        <Text style={styles.title}>
          {capabilities.canCollect ? "Field collection access is active" : "Your staff access is active"}
        </Text>
        <Text style={styles.copy}>
          {capabilities.canCollect
            ? "You can sign in securely. Collection assignments will appear here when the collection workflow is enabled."
            : "No operational workspace has been assigned yet. Ask your administrator if you need another role."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { margin: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl },
  icon: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink, marginBottom: spacing.sm },
  copy: { fontSize: 13.5, lineHeight: 20, color: colors.inkMuted },
});
