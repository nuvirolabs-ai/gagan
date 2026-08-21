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

export default function ProfileScreen({ navigation }: any) {
  const { logout } = useAuth();
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
    if (!phone) return Alert.alert("No number available");
    Linking.openURL(`tel:${phone}`);
  };

  const whatsapp = (phone?: string | null) => {
    if (!phone) return Alert.alert("No number available");
    Linking.openURL(`https://wa.me/${phone.replace(/[^0-9]/g, "")}`).catch(() =>
      Alert.alert("WhatsApp isn't available on this device")
    );
  };

  const confirmLogout = () =>
    Alert.alert("Log out?", "You'll need your phone number and an OTP to sign back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: logout },
    ]);

  const retailer = data?.retailer;
  const credit = data?.credit;
  const rep = data?.salesRep;

  const MENU = [
    {
      icon: "file-document-outline",
      label: "Ledger & statements",
      hint: "Invoices, payments, balance",
      onPress: () => navigation.navigate("Ledger"),
    },
    {
      icon: "cash-multiple",
      label: "Pay dues",
      hint: credit?.overdue > 0 ? `${inr(credit.overdue)} overdue` : "Clear your balance",
      onPress: () => navigation.navigate("Pay"),
    },
    {
      icon: "receipt",
      label: "My orders",
      hint: "Track and reorder",
      onPress: () => navigation.navigate("Orders"),
    },
    {
      icon: "map-marker-radius-outline",
      label: "Store location",
      hint: "Confirm where Gagan delivers",
      onPress: () => navigation.navigate("StoreLocation"),
    },
    {
      icon: "tag-outline",
      label: "Offers & schemes",
      hint: `${data?.badges?.activeOffers ?? 0} active`,
      onPress: () => Alert.alert("Offers", "Scheme details are coming in a later release."),
    },
    {
      icon: "bell-outline",
      label: "Notifications",
      hint: `${data?.badges?.notifications ?? 0} unread`,
      onPress: () => Alert.alert("Notifications", "The notification centre is not built yet."),
    },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + spacing.xl }}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title="Account" />

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
            <Text style={styles.creditLabel}>Outstanding</Text>
            <Text style={styles.creditValue}>{inr(credit.outstanding)}</Text>
            {credit.overdue > 0 && (
              <Text style={styles.overdue}>{inr(credit.overdue)} overdue</Text>
            )}
          </View>
          <View style={styles.creditDivider} />
          <View style={styles.creditCol}>
            <Text style={styles.creditLabel}>Available credit</Text>
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
            <Text style={styles.repLabel}>Your salesman</Text>
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

      <Text style={styles.sectionTitle}>Support</Text>
      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuRow} onPress={() => call(data?.config?.supportPhone)}>
          <View style={styles.menuIcon}>
            <Feather name="phone" size={17} color={colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuLabel}>Call support</Text>
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
            <Text style={styles.menuLabel}>WhatsApp us</Text>
            <Text style={styles.menuHint}>Usually replies within an hour</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.inkFaint} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logout} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={17} color={colors.danger} />
        <Text style={styles.logoutText}>Log out</Text>
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
  version: { textAlign: "center", fontSize: 11, color: colors.inkFaint, marginTop: spacing.sm },
});
