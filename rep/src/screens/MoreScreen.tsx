import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../components/ui";
import { useRep } from "../context/RepContext";
import { staffCapabilities } from "../auth/staffCapabilities";
import { useLanguage } from "../i18n/LanguageContext";
import { colors, radius, spacing, TAB_BAR_SPACE } from "../theme";

type MoreItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
  params?: Record<string, unknown>;
  show?: boolean;
  deferred?: boolean;
};

export default function MoreScreen({ navigation }: any) {
  const { staff } = useRep();
  const { t } = useLanguage();
  const capabilities = staffCapabilities(staff?.permissions ?? []);

  const items: MoreItem[] = [
    { key: "account", icon: "person-circle-outline", route: "Account" },
    { key: "retailers", icon: "storefront-outline", route: "Retailers", show: capabilities.canOrderForRetailers },
    { key: "addRetailer", icon: "add-circle-outline", route: "AddRetailer", show: capabilities.canOrderForRetailers },
    { key: "route", icon: "map-outline", route: "RoutePlan" },
    { key: "collections", icon: "cash-outline", route: "Collections", show: capabilities.canCollect || staff?.permissions.includes("collection.confirm") },
    { key: "approvals", icon: "shield-checkmark-outline", route: "Approvals", show: capabilities.canApprove },
    { key: "endDay", icon: "flag-outline", route: "EndDay" },
    { key: "leave", icon: "calendar-outline", route: "Leave" },
    { key: "expenses", icon: "receipt-outline", route: "Expenses" },
    { key: "salesKit", icon: "folder-open-outline", route: "SalesKit" },
    { key: "salesReturn", icon: "return-down-back-outline", deferred: true },
  ];

  return (
    <View style={styles.screen}>
      <ScreenHeader title={t("tabs.more")} subtitle={t("more.subtitle")} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE }}>
        {items.filter((item) => item.show !== false).map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.row, item.deferred && styles.rowDeferred]}
            disabled={item.deferred || !item.route}
            onPress={() => item.route && navigation.navigate(item.route, item.params)}
          >
            <View style={styles.icon}>
              <Ionicons name={item.icon} size={20} color={item.deferred ? colors.inkFaint : colors.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, item.deferred && styles.deferredText]}>{t(`more.${item.key}`)}</Text>
              <Text style={styles.sub}>{item.deferred ? t("more.deferred") : t(`more.${item.key}Hint`)}</Text>
            </View>
            {!item.deferred ? <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} /> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowDeferred: { opacity: 0.7 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  deferredText: { color: colors.inkMuted },
});
