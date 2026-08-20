import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useRep } from "../context/RepContext";
import { colors, radius, spacing, shadow, TAB_BAR_SPACE } from "../theme";
import { ScreenHeader } from "../components/ui";

export default function RepAccountScreen() {
  const { rep, logout } = useRep();

  const confirmLogout = () =>
    Alert.alert("Log out?", "You'll need your phone number and an OTP to sign back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: logout },
    ]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Account" />

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(rep?.name ?? "?")
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{rep?.name ?? "—"}</Text>
          <Text style={styles.sub}>{rep?.phone ?? ""}</Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>SALES REP</Text>
        </View>
      </View>

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={16} color={colors.green} />
        <Text style={styles.noteText}>
          Orders you place are recorded against your name and use each retailer's own tier pricing
          and credit limit.
        </Text>
      </View>

      <TouchableOpacity style={styles.logout} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={17} color={colors.danger} />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingBottom: TAB_BAR_SPACE },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 17, fontWeight: "800", color: colors.green },
  name: { fontSize: 17, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 12.5, color: colors.inkMuted, marginTop: 2 },
  roleBadge: {
    backgroundColor: colors.greenSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  roleText: { fontSize: 9.5, fontWeight: "800", color: colors.green, letterSpacing: 0.5 },

  note: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.greenSoft,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  noteText: { flex: 1, fontSize: 12.5, color: colors.ink, lineHeight: 18 },

  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  logoutText: { color: colors.danger, fontWeight: "700", fontSize: 14.5 },
});
