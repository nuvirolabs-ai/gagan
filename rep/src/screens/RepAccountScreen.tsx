import React from "react";
import { View, Text, StyleSheet, Alert, ScrollView } from "react-native";

import { useRep } from "../context/RepContext";
import { useField } from "../context/FieldContext";
import { staffCapabilities } from "../auth/staffCapabilities";
import { colors, spacing, TAB_BAR_SPACE } from "../theme";
import {
  AppScreen,
  Banner,
  FilterChip,
  InitialsBadge,
  ListRow,
  OfflineBanner,
  ScreenHeader,
  SecondaryButton,
  SectionHeader,
  StatusChip,
  Surface,
  TextButton,
} from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";

export default function RepAccountScreen({ navigation }: any) {
  const { staff, rep, logout } = useRep();
  const { today, outbox, flushOutbox } = useField();
  const { language, t, setLanguage } = useLanguage();
  const capabilities = staffCapabilities(staff?.permissions ?? []);
  const onDuty = today?.attendance?.status === "open";

  const confirmLogout = () =>
    Alert.alert(t("account.logoutTitle"), t("account.logoutBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("account.logout"), style: "destructive", onPress: logout },
    ]);

  const work = [
    capabilities.canManageAttendance && {
      icon: "calendar-outline",
      label: t("more.myDay"),
      subtitle: t("more.dayHistory"),
      screen: "MyDay",
    },
    capabilities.canRunFieldDay && {
      icon: "navigate-outline",
      label: t("route.title"),
      subtitle: t("more.routeSubtitle"),
      screen: "Route",
    },
    capabilities.canRunFieldDay && {
      icon: "bulb-outline",
      label: t("opportunities.title"),
      subtitle: t("more.attentionSubtitle"),
      screen: "Opportunities",
    },
  ].filter(Boolean) as Array<{ icon: string; label: string; subtitle: string; screen: string }>;

  const grow = [
    capabilities.canRunFieldDay && {
      icon: "ribbon-outline",
      label: t("more.performance"),
      subtitle: t("more.performanceSubtitle"),
      screen: "Activity",
    },
    capabilities.canProposeRetailers && {
      icon: "add-circle-outline",
      label: t("addRetailer.title"),
      subtitle: t("more.addStoreSubtitle"),
      screen: "AddRetailer",
    },
    capabilities.canSeeCustomerMap && {
      icon: "map-outline",
      label: t("more.customerMap"),
      subtitle: t("more.mapSubtitle"),
      screen: "CustomerMap",
    },
  ].filter(Boolean) as Array<{ icon: string; label: string; subtitle: string; screen: string }>;

  const operations = [
    capabilities.canSubmitExpenses && {
      icon: "receipt-outline",
      label: t("more.expenses"),
      subtitle: t("more.expensesSubtitle"),
      screen: "Expenses",
    },
    capabilities.canRaiseIssues && {
      icon: "alert-circle-outline",
      label: t("more.issues"),
      subtitle: t("more.issuesSubtitle"),
      screen: "Issues",
    },
    (capabilities.canCollect || staff?.permissions.includes("collection.confirm")) && {
      icon: "wallet-outline",
      label: t("more.collections"),
      subtitle: t("more.collectionsSubtitle"),
      screen: "Collections",
    },
  ].filter(Boolean) as Array<{ icon: string; label: string; subtitle: string; screen: string }>;

  const renderGroup = (title: string, links: typeof work) =>
    links.length === 0 ? null : (
      <View>
        <SectionHeader title={title} />
        <Surface>
          {links.map((link, index) => (
            <ListRow
              key={link.screen}
              first={index === 0}
              icon={link.icon}
              title={link.label}
              subtitle={link.subtitle}
              onPress={() =>
                navigation.navigate(link.screen, link.screen === "Activity" ? { tab: "performance" } : undefined)
              }
            />
          ))}
        </Surface>
      </View>
    );

  return (
    <AppScreen>
      <ScreenHeader title={t("more.title")} />
      <ScrollView contentContainerStyle={styles.content}>
        <Surface>
          <View style={styles.profile}>
            <InitialsBadge name={staff?.name ?? "?"} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{staff?.name ?? "—"}</Text>
              <Text style={styles.sub}>{rep ? t("more.sales") : "Staff"}</Text>
              {staff?.phone ? <Text style={styles.sub}>{staff.phone}</Text> : null}
            </View>
            <StatusChip label={onDuty ? t("more.onDuty") : t("more.offDuty")} tone={onDuty ? "green" : "neutral"} />
          </View>
        </Surface>

        {outbox.pending > 0 || outbox.failed > 0 ? (
          <Surface>
            <SectionHeader title={t("more.offlineQueue")} />
            {outbox.failed > 0 ? (
              <Banner
                tone="attention"
                icon="cloud-upload-outline"
                title={t(
                  outbox.pending + outbox.failed === 1 ? "more.offlineQueueBody" : "more.offlineQueueBodyPlural",
                  { count: outbox.pending + outbox.failed }
                )}
                body={`${outbox.failed} update${outbox.failed === 1 ? "" : "s"} could not be sent after several tries.`}
              />
            ) : (
              <OfflineBanner
                title={t(
                  outbox.pending + outbox.failed === 1 ? "more.offlineQueueBody" : "more.offlineQueueBodyPlural",
                  { count: outbox.pending + outbox.failed }
                )}
                body="Changes will sync when you're connected."
              />
            )}
            <SecondaryButton
              label={t("more.syncNow")}
              icon="refresh-outline"
              onPress={() => void flushOutbox({ retryFailed: true })}
            />
          </Surface>
        ) : null}

        {renderGroup(t("more.myWork"), work)}
        {renderGroup(t("more.grow"), grow)}
        {renderGroup(t("more.operations"), operations)}

        <View>
          <SectionHeader title={t("more.accountGroup")} />
          <Surface>
            <Text style={styles.langLabel}>{t("more.settings")}</Text>
            <View style={styles.langRow}>
              <FilterChip label="English" active={language === "en"} onPress={() => void setLanguage("en")} />
              <FilterChip label="हिन्दी" active={language === "hi"} onPress={() => void setLanguage("hi")} />
            </View>
            <Text style={styles.note}>
              {rep
                ? "Location is only recorded while you're on duty."
                : "Your work areas are controlled by permissions assigned by your administrator."}
            </Text>
            <TextButton label={t("account.logout")} onPress={confirmLogout} />
          </Surface>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, gap: spacing.section, paddingBottom: TAB_BAR_SPACE + spacing.xl },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { fontSize: 18, fontWeight: "600", color: colors.ink },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  langLabel: { fontSize: 15, fontWeight: "600", color: colors.ink, marginBottom: spacing.sm },
  langRow: { flexDirection: "row", gap: spacing.sm },
  note: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginTop: spacing.md },
});
