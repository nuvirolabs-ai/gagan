import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";

import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, shadow, inr, TAB_BAR_SPACE } from "../theme";
import { ScreenHeader } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";

export default function ProfileScreen({ navigation }: any) {
  const { logout } = useAuth();
  const { language, t, setLanguage } = useLanguage();
  const [data, setData] = useState<any | null>(null);

  useFocusEffect(
    useCallback(() => {
      api
        .getHome()
        .then(setData)
        .catch(() => setData(null));
    }, [])
  );

  const call = (phone?: string | null) => {
    if (!phone) return Alert.alert(t("errors.generic"));
    Linking.openURL(`tel:${phone}`);
  };

  const whatsapp = (phone?: string | null) => {
    if (!phone) return Alert.alert(t("errors.generic"));
    Linking.openURL(`https://wa.me/${phone.replace(/[^0-9]/g, "")}`).catch(() =>
      Alert.alert(t("errors.generic"))
    );
  };

  const confirmLogout = () =>
    Alert.alert(t("profile.logoutTitle"), t("profile.logoutBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("profile.logout"), style: "destructive", onPress: logout },
    ]);

  const retailer = data?.retailer;
  const credit = data?.credit;
  const rep = data?.salesRep;

  const MENU = [
    {
      icon: "file-document-outline",
      label: t("profile.ledger"),
      hint: t("profile.ledgerHint"),
      onPress: () => navigation.navigate("Ledger"),
    },
    {
      icon: "cash-multiple",
      label: t("profile.payDues"),
      hint: credit?.overdue > 0 ? `${inr(credit.overdue)} ${t("ledger.overdue")}` : t("profile.payDuesClear"),
      onPress: () => navigation.navigate("Pay"),
    },
    {
      icon: "receipt",
      label: t("profile.myOrders"),
      hint: t("profile.myOrdersHint"),
      onPress: () => navigation.navigate("Orders"),
    },
    {
      icon: "map-marker-radius-outline",
      label: t("profile.storeLocation"),
      hint: t("profile.storeLocationHint"),
      onPress: () => navigation.navigate("StoreLocation"),
    },
    {
      icon: "tag-outline",
      label: t("profile.offers"),
      hint: `${data?.badges?.activeOffers ?? 0} active`,
      onPress: () => Alert.alert(t("profile.offers"), t("profile.offersComing")),
    },
    {
      icon: "bell-outline",
      label: t("profile.notifications"),
      hint: `${data?.badges?.notifications ?? 0} unread`,
      onPress: () => Alert.alert(t("profile.notifications"), t("profile.notificationsComing")),
    },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title={t("profile.title")} />

      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(retailer?.name ?? "?")
              .split(" ")
              .map((p: string) => p[0])
              .slice(0, 2)
              .join("")}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.shopName} numberOfLines={1}>
            {retailer?.name ?? "—"}
          </Text>
          <Text style={styles.phone}>{retailer?.phone ?? ""}</Text>
        </View>
        {retailer?.tier && (
          <View style={styles.tierBadge}>
            <MaterialCommunityIcons name="crown" size={12} color={colors.gold} />
            <Text style={styles.tierText}>{retailer.tier}</Text>
          </View>
        )}
      </View>

      {credit && (
        <TouchableOpacity style={styles.creditCard} onPress={() => navigation.navigate("Ledger")}>
          <View style={styles.creditCol}>
            <Text style={styles.creditLabel}>{t("profile.outstanding")}</Text>
            <Text style={styles.creditValue}>{inr(credit.outstanding)}</Text>
            {credit.overdue > 0 && (
              <Text style={styles.overdue}>{inr(credit.overdue)} {t("ledger.overdue")}</Text>
            )}
          </View>
          <View style={styles.creditDivider} />
          <View style={styles.creditCol}>
            <Text style={styles.creditLabel}>{t("profile.availableCredit")}</Text>
            <Text style={[styles.creditValue, { color: colors.green }]}>{inr(credit.available)}</Text>
            <Text style={styles.creditSub}>of {inr(credit.creditLimit)} limit</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
        </TouchableOpacity>
      )}

      {rep && (
        <View style={styles.repCard}>
          <View style={styles.repAvatar}>
            <Text style={styles.repInitials}>
              {rep.name
                .split(" ")
                .map((p: string) => p[0])
                .slice(0, 2)
                .join("")}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.repLabel}>{t("profile.salesman")}</Text>
            <Text style={styles.repName}>{rep.name}</Text>
          </View>
          <TouchableOpacity style={styles.repBtn} onPress={() => call(rep.phone)}>
            <Ionicons name="call" size={16} color={colors.onDark} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.repBtn, { backgroundColor: "#25D366" }]}
            onPress={() => whatsapp(rep.phone)}
          >
            <MaterialCommunityIcons name="whatsapp" size={17} color={colors.onDark} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.menu}>
        {MENU.map((m, i) => (
          <TouchableOpacity
            key={m.label}
            style={[styles.menuRow, i > 0 && styles.menuRowBorder]}
            onPress={m.onPress}
          >
            <View style={styles.menuIcon}>
              <MaterialCommunityIcons name={m.icon as any} size={18} color={colors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>{m.label}</Text>
              <Text style={styles.menuHint}>{m.hint}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.inkFaint} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t("profile.support")}</Text>
      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuRow} onPress={() => call(data?.config?.supportPhone)}>
          <View style={styles.menuIcon}>
            <Feather name="phone" size={17} color={colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuLabel}>{t("profile.callSupport")}</Text>
            <Text style={styles.menuHint}>Mon–Sat, 9am to 7pm</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.inkFaint} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.menuRow, styles.menuRowBorder]}
          onPress={() => whatsapp(data?.config?.supportPhone)}
        >
          <View style={styles.menuIcon}>
            <MaterialCommunityIcons name="whatsapp" size={18} color={colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuLabel}>{t("profile.whatsapp")}</Text>
            <Text style={styles.menuHint}>Usually replies within an hour</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.inkFaint} />
        </TouchableOpacity>
      </View>

      <View style={styles.languageRow}>
        <Text style={styles.languageLabel}>{t("profile.language")}</Text>
        <View style={styles.languageChoices}>
          <TouchableOpacity onPress={() => void setLanguage("en")} style={[styles.languageChoice, language === "en" && styles.languageChoiceActive]}>
            <Text style={[styles.languageChoiceText, language === "en" && styles.languageChoiceTextActive]}>English</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void setLanguage("hi")} style={[styles.languageChoice, language === "hi" && styles.languageChoiceActive]}>
            <Text style={[styles.languageChoiceText, language === "hi" && styles.languageChoiceTextActive]}>हिन्दी</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.logout} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={17} color={colors.danger} />
        <Text style={styles.logoutText}>{t("profile.logout")}</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Gagan Retailer · v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  profile: {
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
  shopName: { fontSize: 17, fontWeight: "700", color: colors.ink },
  phone: { fontSize: 12.5, color: colors.inkMuted, marginTop: 2 },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  tierText: { fontSize: 11, fontWeight: "800", color: "#8A6A12" },

  creditCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  creditCol: { flex: 1 },
  creditDivider: { width: 1, height: 40, backgroundColor: colors.border, marginHorizontal: spacing.md },
  creditLabel: { fontSize: 11.5, color: colors.inkMuted },
  creditValue: { fontSize: 17, fontWeight: "700", color: colors.ink, marginTop: 3 },
  creditSub: { fontSize: 10.5, color: colors.inkFaint, marginTop: 2 },
  overdue: { fontSize: 10.5, color: colors.danger, fontWeight: "700", marginTop: 2 },

  repCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.greenSoft,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  repAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  repInitials: { fontSize: 13, fontWeight: "800", color: colors.green },
  repLabel: { fontSize: 10.5, color: colors.greenMid },
  repName: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  repBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.greenDeep,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.inkMuted,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menu: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  menuRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { fontSize: 14.5, fontWeight: "600", color: colors.ink },
  menuHint: { fontSize: 11.5, color: colors.inkMuted, marginTop: 1 },

  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  logoutText: { color: colors.danger, fontWeight: "700", fontSize: 14.5 },
  languageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  languageLabel: { color: colors.ink, fontWeight: "700" },
  languageChoices: { flexDirection: "row", gap: spacing.xs },
  languageChoice: { paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.sm },
  languageChoiceActive: { backgroundColor: colors.greenSoft },
  languageChoiceText: { color: colors.inkMuted, fontSize: 12, fontWeight: "600" },
  languageChoiceTextActive: { color: colors.greenDeep },
  version: { textAlign: "center", fontSize: 11, color: colors.inkFaint, marginTop: spacing.sm },
});
