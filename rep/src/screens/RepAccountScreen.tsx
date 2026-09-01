import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useRep } from "../context/RepContext";
import { useField } from "../context/FieldContext";
import { staffCapabilities } from "../auth/staffCapabilities";
import { colors, radius, spacing, shadow, TAB_BAR_SPACE } from "../theme";
import { Banner, Card, ListRow, ScreenHeader, SecondaryButton, SectionTitle } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";

/**
 * The "More" hub: who you are, plus the parts of the day that do not belong on
 * Today — attendance history, expenses, issues, the customer map and, for a
 * collector, the collections workspace.
 */
export default function RepAccountScreen({ navigation }: any) {
  const { staff, rep, logout } = useRep();
  const { outbox, flushOutbox } = useField();
  const { language, t, setLanguage } = useLanguage();
  const capabilities = staffCapabilities(staff?.permissions ?? []);

  const confirmLogout = () =>
    Alert.alert(t("account.logoutTitle"), t("account.logoutBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("account.logout"), style: "destructive", onPress: logout },
    ]);

  const links = [
    capabilities.canManageAttendance && {
      icon: "calendar-outline",
      label: t("more.myDay"),
      subtitle: "Attendance history and leave requests",
      screen: "MyDay",
    },
    capabilities.canRunFieldDay && {
      icon: "map-outline",
      label: t("route.title"),
      subtitle: "Today's planned stops",
      screen: "Route",
    },
    capabilities.canProposeRetailers && {
      icon: "add-circle-outline",
      label: t("addRetailer.title"),
      subtitle: "Send a new shop for your manager to approve",
      screen: "AddRetailer",
    },
    capabilities.canRunFieldDay && {
      icon: "bulb-outline",
      label: t("opportunities.title"),
      subtitle: "Stores worth chasing today, and why",
      screen: "Opportunities",
    },
    capabilities.canSeeCustomerMap && {
      icon: "location-outline",
      label: t("more.customerMap"),
      subtitle: "Your customers by distance and geotag state",
      screen: "CustomerMap",
    },
    capabilities.canSubmitExpenses && {
      icon: "wallet-outline",
      label: t("more.expenses"),
      subtitle: "Field expense claims",
      screen: "Expenses",
    },
    capabilities.canRaiseIssues && {
      icon: "alert-circle-outline",
      label: t("more.issues"),
      subtitle: "Customer complaints and service requests",
      screen: "Issues",
    },
    (capabilities.canCollect || staff?.permissions.includes("collection.confirm")) && {
      icon: "cash-outline",
      label: t("more.collections"),
      subtitle: "Submit a collection for Accounts to verify",
      screen: "Collections",
    },
  ].filter(Boolean) as Array<{ icon: string; label: string; subtitle: string; screen: string }>;

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t("more.title")} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(staff?.name ?? "?")
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{staff?.name ?? "—"}</Text>
            <Text style={styles.sub}>{staff?.phone ?? ""}</Text>
          </View>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{rep ? "SALES" : "STAFF"}</Text>
          </View>
        </View>

        {outbox.pending > 0 || outbox.failed > 0 ? (
          <Card>
            <SectionTitle title={t("more.offlineQueue")} />
            <Banner
              tone={outbox.failed > 0 ? "attention" : "idle"}
              icon="cloud-upload-outline"
              title={t(
                outbox.pending + outbox.failed === 1
                  ? "more.offlineQueueBody"
                  : "more.offlineQueueBodyPlural",
                { count: outbox.pending + outbox.failed }
              )}
              body={
                outbox.failed > 0
                  ? `${outbox.failed} update${outbox.failed === 1 ? "" : "s"} could not be sent after several tries. ${
                      outbox.failed === 1 ? "It stays" : "They stay"
                    } on this phone until ${outbox.failed === 1 ? "it goes" : "they go"} through.`
                  : "These are saved on this phone and will be sent as soon as you have a connection."
              }
            />
            <SecondaryButton
              label={t("more.syncNow")}
              icon="refresh-outline"
              onPress={() => void flushOutbox({ retryFailed: true })}
            />
          </Card>
        ) : null}

        {links.length > 0 ? (
          <Card>
            {links.map((link, index) => (
              <ListRow
                key={link.screen}
                first={index === 0}
                icon={link.icon}
                title={link.label}
                subtitle={link.subtitle}
                onPress={() => navigation.navigate(link.screen)}
              />
            ))}
          </Card>
        ) : null}

        <View style={styles.languageRow}>
          <Text style={styles.languageLabel}>{t("account.language")}</Text>
          <View style={styles.languageChoices}>
            <TouchableOpacity
              onPress={() => void setLanguage("en")}
              style={[styles.languageChoice, language === "en" && styles.languageChoiceActive]}
            >
              <Text
                style={[
                  styles.languageChoiceText,
                  language === "en" && styles.languageChoiceTextActive,
                ]}
              >
                English
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void setLanguage("hi")}
              style={[styles.languageChoice, language === "hi" && styles.languageChoiceActive]}
            >
              <Text
                style={[
                  styles.languageChoiceText,
                  language === "hi" && styles.languageChoiceTextActive,
                ]}
              >
                हिन्दी
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={16} color={colors.green} />
          <Text style={styles.noteText}>
            {rep
              ? "Orders you place are recorded against your name and use each retailer's own pricing and credit limit. Your location is only recorded while your day is running."
              : "Your work areas are controlled by permissions assigned by your administrator."}
          </Text>
        </View>

        <TouchableOpacity style={styles.logout} onPress={confirmLogout}>
          <Ionicons name="log-out-outline" size={17} color={colors.danger} />
          <Text style={styles.logoutText}>{t("account.logout")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: TAB_BAR_SPACE + spacing.xl },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
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
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  noteText: { flex: 1, fontSize: 12.5, color: colors.ink, lineHeight: 18 },

  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: spacing.md,
  },
  logoutText: { color: colors.danger, fontWeight: "700", fontSize: 14.5 },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  languageLabel: { color: colors.ink, fontWeight: "700" },
  languageChoices: { flexDirection: "row", gap: spacing.xs },
  languageChoice: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.sm },
  languageChoiceActive: { backgroundColor: colors.greenSoft },
  languageChoiceText: { color: colors.inkMuted, fontSize: 12, fontWeight: "600" },
  languageChoiceTextActive: { color: colors.greenDeep },
});
