import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRep } from "../context/RepContext";
import { colors, radius, spacing, shadow } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";
import { initials } from "../home/format";

export default function RepAccountScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { staff, rep, logout } = useRep();
  const { language, t, setLanguage } = useLanguage();

  const confirmLogout = () =>
    Alert.alert(t("account.logoutTitle"), t("account.logoutBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("account.logout"), style: "destructive", onPress: logout },
    ]);

  return (
    <View style={styles.screen}>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
        {navigation?.canGoBack?.() ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: spacing.sm }} accessibilityLabel={t("common.back")}>
            <Ionicons name="chevron-back" size={22} color={colors.onDark} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.kicker}>{t("account.title")}</Text>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(staff?.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{staff?.name ?? "—"}</Text>
            <Text style={styles.sub}>{staff?.phone ?? ""}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{rep ? "SALES" : "STAFF"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.languageRow}>
        <Text style={styles.languageLabel}>{t("account.language")}</Text>
        <View style={styles.languageChoices}>
          <TouchableOpacity onPress={() => void setLanguage("en")} style={[styles.languageChoice, language === "en" && styles.languageChoiceActive]}>
            <Text style={[styles.languageChoiceText, language === "en" && styles.languageChoiceTextActive]}>English</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void setLanguage("hi")} style={[styles.languageChoice, language === "hi" && styles.languageChoiceActive]}>
            <Text style={[styles.languageChoiceText, language === "hi" && styles.languageChoiceTextActive]}>हिन्दी</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={16} color={colors.sky} />
        <Text style={styles.noteText}>
          {rep
            ? "Orders you place are recorded against your name and use each retailer's own pricing and credit limit."
            : "Your work areas are controlled by permissions assigned by your administrator."}
        </Text>
      </View>

      <TouchableOpacity style={styles.logout} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={17} color={colors.danger} />
        <Text style={styles.logoutText}>{t("account.logout")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  hero: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  kicker: { color: colors.onDarkMuted, fontWeight: "700", fontSize: 12, letterSpacing: 0.6, marginBottom: spacing.md },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.sky,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: colors.navy },
  name: { fontSize: 20, fontWeight: "800", color: colors.onDark },
  sub: { fontSize: 13, color: colors.onDarkMuted, marginTop: 2 },
  roleBadge: {
    backgroundColor: "rgba(91,159,212,0.2)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  roleText: { fontSize: 9.5, fontWeight: "800", color: colors.sky, letterSpacing: 0.5 },
  note: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.surfaceAlt,
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
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  languageLabel: { color: colors.ink, fontWeight: "700" },
  languageChoices: { flexDirection: "row", gap: spacing.xs },
  languageChoice: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.sm },
  languageChoiceActive: { backgroundColor: colors.surfaceAlt },
  languageChoiceText: { color: colors.inkMuted, fontSize: 12, fontWeight: "600" },
  languageChoiceTextActive: { color: colors.navy, fontWeight: "800" },
});
