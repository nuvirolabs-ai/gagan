import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import {
  Banner,
  Card,
  Field,
  ListRow,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  Tag,
  inputStyle,
} from "../components/ui";
import { repApi } from "../api/repClient";
import { captureForegroundLocation } from "../location/deviceLocation";
import { colors, spacing } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

const STATUS_TONE: Record<string, "green" | "gold" | "danger" | "neutral"> = {
  approved: "green",
  pending: "gold",
  rejected: "danger",
  withdrawn: "neutral",
};

/**
 * A salesperson putting a store forward for the customer master.
 *
 * This is a request, not a creation: the screen says so, and the store only
 * becomes a customer when a reviewer approves it. The salesperson can see
 * exactly where each of their requests stands.
 */
export default function AddRetailerScreen() {
  const { t } = useLanguage();
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracyMeters: number;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await repApi.retailerProposals();
      setProposals(response.proposals ?? []);
    } catch {
      setProposals([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const captureLocation = async () => {
    const reading = await captureForegroundLocation();
    if (reading.kind === "permission_denied") {
      return Alert.alert(
        "Location permission needed",
        reading.canAskAgain
          ? "Allow location while using the app to pin the shop."
          : "Turn on location access in Settings to pin the shop."
      );
    }
    if (reading.kind === "unavailable") return Alert.alert("Location unavailable", reading.message);
    setLocation({
      latitude: reading.latitude,
      longitude: reading.longitude,
      accuracyMeters: reading.accuracyMeters,
    });
  };

  const submit = async () => {
    if (businessName.trim().length < 2) {
      return Alert.alert("Add the shop name", "The reviewer needs to know which shop this is.");
    }
    if (phone.replace(/\D/g, "").length < 10) {
      return Alert.alert("Check the phone number", "Enter the shop's 10-digit number.");
    }
    if (shopAddress.trim().length < 4) {
      return Alert.alert("Add the address", "The reviewer needs to know where the shop is.");
    }
    setSaving(true);
    try {
      await repApi.proposeRetailer({
        businessName: businessName.trim(),
        ownerName: ownerName.trim() || undefined,
        phone: phone.trim(),
        shopAddress: shopAddress.trim(),
        notes: notes.trim() || undefined,
        ...(location ?? {}),
      });
      setBusinessName("");
      setOwnerName("");
      setPhone("");
      setShopAddress("");
      setNotes("");
      setLocation(null);
      await load();
      Alert.alert(t("addRetailer.sent"), t("addRetailer.sentBody"));
    } catch (error: any) {
      Alert.alert(
        "Could not send this",
        error?.message === "retailer_already_exists"
          ? "This shop is already on the customer list. Ask your manager to assign it to you."
          : error?.message === "proposal_already_pending"
            ? "You have already sent this shop for approval."
            : "Try again when you have a connection."
      );
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async (id: string) => {
    try {
      await repApi.withdrawRetailerProposal(id);
      await load();
    } catch {
      Alert.alert("Could not withdraw", "Only a request still waiting can be withdrawn.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.green}
          />
        }
      >
        <Card>
          <SectionTitle title={t("addRetailer.title")} />
          <Banner tone="idle" icon="information-circle-outline" title={t("addRetailer.intro")} />

          <Field label={t("addRetailer.businessName")}>
            <TextInput
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Sharma Stores"
              placeholderTextColor={colors.inkFaint}
              style={inputStyle}
            />
          </Field>
          <Field label={t("addRetailer.ownerName")} hint={t("common.optional")}>
            <TextInput
              value={ownerName}
              onChangeText={setOwnerName}
              placeholder="Ramesh Sharma"
              placeholderTextColor={colors.inkFaint}
              style={inputStyle}
            />
          </Field>
          <Field label={t("addRetailer.phone")}>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="9812345678"
              placeholderTextColor={colors.inkFaint}
              style={inputStyle}
            />
          </Field>
          <Field label={t("addRetailer.address")}>
            <TextInput
              value={shopAddress}
              onChangeText={setShopAddress}
              placeholder="12 Market Road, Pune"
              placeholderTextColor={colors.inkFaint}
              style={[inputStyle, { minHeight: 64, textAlignVertical: "top" }]}
              multiline
            />
          </Field>
          <SecondaryButton
            label={
              location
                ? `${t("addRetailer.locationCaptured")} · ${Math.round(location.accuracyMeters)} m`
                : t("addRetailer.captureLocation")
            }
            icon="locate-outline"
            onPress={() => void captureLocation()}
          />
          <Field label={t("addRetailer.notes")} hint={t("common.optional")}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Big shop near the bus stand, buys weekly"
              placeholderTextColor={colors.inkFaint}
              style={[inputStyle, { minHeight: 64, textAlignVertical: "top" }]}
              multiline
            />
          </Field>
          <PrimaryButton
            label={saving ? t("common.submitting") : t("addRetailer.submit")}
            icon="paper-plane-outline"
            disabled={saving}
            onPress={() => void submit()}
          />
        </Card>

        <Card>
          <SectionTitle title={t("addRetailer.myRequests")} />
          {proposals.length === 0 ? (
            <Text style={styles.muted}>{t("addRetailer.none")}</Text>
          ) : (
            proposals.map((proposal, index) => (
              <ListRow
                key={proposal.id}
                first={index === 0}
                icon="storefront-outline"
                title={proposal.businessName}
                subtitle={[
                  proposal.shopAddress,
                  proposal.rejectionReason,
                  proposal.status === "pending" ? "Tap to withdraw" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                right={
                  <Tag label={proposal.status} tone={STATUS_TONE[proposal.status] ?? "neutral"} />
                }
                onPress={
                  proposal.status === "pending" ? () => void withdraw(proposal.id) : undefined
                }
              />
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  muted: { fontSize: 12.5, color: colors.inkMuted, lineHeight: 18 },
});
