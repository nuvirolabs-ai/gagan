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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, spacing, inr, TAB_BAR_SPACE } from "../theme";
import { ScreenHeader, SectionTitle } from "../components/ui";
import AccountStrip from "../components/home/AccountStrip";
import { accountModel } from "../lib/homePresentation";
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
      <ScreenHeader
        title={retailer?.name ?? t("profile.title")}
        subtitle={retailer?.phone ? `${retailer.phone}${retailer?.tier ? ` · ${retailer.tier}` : ""}` : undefined}
      />

      {credit ? (
        <AccountStrip
          account={accountModel(credit)}
          onPay={() => navigation.navigate("Pay")}
          onLedger={() => navigation.navigate("Ledger")}
        />
      ) : null}

      {rep ? (
        <View style={styles.support}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.supportLabel}>{t("profile.salesman")}</Text>
            <Text style={styles.supportName} numberOfLines={1}>
              {rep.name}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.supportCall}
            accessibilityLabel={t("home.callSalesperson", { name: rep.name })}
            onPress={() => call(rep.phone)}
          >
            <Ionicons name="call" size={16} color={colors.onDark} />
            <Text style={styles.supportCallText}>{t("home.call")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.supportAlt}
            accessibilityLabel={t("profile.whatsapp")}
            onPress={() => whatsapp(rep.phone)}
          >
            <MaterialCommunityIcons name="whatsapp" size={16} color={colors.green} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.menu}>
        {MENU.map((m, i) => (
          <TouchableOpacity
            key={m.label}
            style={[styles.menuRow, i > 0 && styles.menuRowBorder]}
            onPress={m.onPress}
            accessibilityRole="button"
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.menuLabel}>{m.label}</Text>
              <Text style={styles.menuHint} numberOfLines={1}>
                {m.hint}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.inkFaint} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <SectionTitle>{t("profile.support")}</SectionTitle>
      </View>
      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuRow} onPress={() => call(data?.config?.supportPhone)}>
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

  support: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  supportLabel: { fontSize: 11, color: colors.inkMuted, fontWeight: "600" },
  supportName: { fontSize: 15, fontWeight: "700", color: colors.ink, marginTop: 1 },
  supportCall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.greenDeep,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
  },
  supportCallText: { color: colors.onDark, fontWeight: "700", fontSize: 13 },
  supportAlt: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  menu: { marginHorizontal: spacing.lg },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  menuRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  menuLabel: { fontSize: 14.5, fontWeight: "600", color: colors.ink },
  menuHint: { fontSize: 12, color: colors.inkMuted, marginTop: 1 },

  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  logoutText: { color: colors.danger, fontWeight: "700", fontSize: 14.5 },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  languageLabel: { color: colors.inkMuted, fontWeight: "700", fontSize: 13, letterSpacing: 0.6, textTransform: "uppercase" },
  languageChoices: { flexDirection: "row", gap: spacing.sm },
  languageChoice: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 36,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  languageChoiceActive: { backgroundColor: colors.greenDeep, borderColor: colors.greenDeep },
  languageChoiceText: { color: colors.inkMuted, fontSize: 13, fontWeight: "700" },
  languageChoiceTextActive: { color: colors.onDark },
  version: { textAlign: "center", fontSize: 11, color: colors.inkFaint, marginTop: spacing.sm },
});
