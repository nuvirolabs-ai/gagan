import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { repApi } from "../api/repClient";
import { captureForegroundLocation } from "../location/deviceLocation";
import { haptic } from "../feedback/haptics";
import { colors, radius, spacing } from "../theme";
import { Field, OptionGrid, PrimaryButton, SecondaryButton, inputStyle } from "./ui";

export const NO_ORDER_REASONS = [
  { value: "already_has_stock", label: "Already has stock" },
  { value: "price_issue", label: "Price issue" },
  { value: "not_interested", label: "Not interested" },
  { value: "outstanding_payment_issue", label: "Outstanding payment issue" },
  { value: "owner_unavailable", label: "Owner unavailable" },
  { value: "shop_closed", label: "Shop closed" },
  { value: "product_unavailable", label: "Product unavailable" },
  { value: "other", label: "Other" },
];

const FOLLOW_UP_OPTIONS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 Days", days: 3 },
  { label: "In 1 Week", days: 7 },
  { label: "No Follow-up", days: 0 },
];

export interface VisitFeedbackModalProps {
  visible: boolean;
  mode: "order_placed" | "no_order";
  visitId: string;
  retailerName?: string;
  onClose?: () => void;
  onSuccess: (result: any) => void;
  allowSkip?: boolean;
}

export default function VisitFeedbackModal({
  visible,
  mode,
  visitId,
  retailerName,
  onClose,
  onSuccess,
  allowSkip = true,
}: VisitFeedbackModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [noOrderReason, setNoOrderReason] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedFollowUpDays, setSelectedFollowUpDays] = useState<number>(0);

  const isOrderPlaced = mode === "order_placed";

  const handleCheckout = async (isSkipping = false) => {
    if (submitting) return;

    if (!isOrderPlaced && !noOrderReason) {
      haptic("warning");
      return Alert.alert("Select a reason", "Please select why the retailer is not ordering today.");
    }

    if (!isOrderPlaced && noOrderReason === "other" && notes.trim().length < 3) {
      haptic("warning");
      return Alert.alert("Add notes", "Please provide a brief explanation when selecting Other.");
    }

    setSubmitting(true);
    try {
      const reading = await captureForegroundLocation();
      if (reading.kind !== "captured") {
        haptic("warning");
        Alert.alert(
          "Location needed",
          reading.kind === "permission_denied"
            ? "Allow location while using the app to close the visit."
            : reading.message
        );
        setSubmitting(false);
        return;
      }

      let followUpAt: string | undefined;
      if (!isSkipping && selectedFollowUpDays > 0) {
        const d = new Date();
        d.setDate(d.getDate() + selectedFollowUpDays);
        d.setHours(10, 0, 0, 0);
        followUpAt = d.toISOString();
      }

      const payload = {
        latitude: reading.latitude,
        longitude: reading.longitude,
        accuracyMeters: reading.accuracyMeters,
        devicePlatform: reading.devicePlatform,
        outcomes: [mode],
        noOrderReason: !isOrderPlaced && noOrderReason ? noOrderReason : undefined,
        notes: isSkipping ? undefined : (notes.trim() || undefined),
        followUpAt,
      };

      const result = await repApi.checkOut(visitId, payload);
      haptic("success");
      onSuccess(result);
    } catch (err: any) {
      haptic("warning");
      Alert.alert(
        "Could not close visit",
        err?.message === "visit_already_checked_out"
          ? "This visit was already closed."
          : (err?.message ?? "Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {onClose && !isOrderPlaced ? (
          <Pressable style={styles.scrim} onPress={onClose} />
        ) : (
          <View style={styles.scrim} />
        )}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetContainer}
        >
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>
                  {isOrderPlaced ? "VISIT FEEDBACK" : "NOT ORDERING TODAY"}
                </Text>
                <Text style={styles.title}>
                  {isOrderPlaced ? "Order Visit Feedback" : "Record Visit Outcome"}
                </Text>
                {retailerName ? (
                  <Text style={styles.retailerName} numberOfLines={1}>
                    {retailerName}
                  </Text>
                ) : null}
              </View>
              {onClose && !isOrderPlaced ? (
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={22} color={colors.inkMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {!isOrderPlaced ? (
                <Field label="Why is the retailer not ordering today? *">
                  <OptionGrid
                    options={NO_ORDER_REASONS}
                    value={noOrderReason}
                    onChange={(val) => setNoOrderReason(val)}
                    disabled={submitting}
                  />
                </Field>
              ) : null}

              <Field
                label={
                  isOrderPlaced
                    ? "Feedback / Manager Notes (Optional)"
                    : "Additional Notes (Optional)"
                }
                hint="Add any comments, customer requests, or notes for the manager"
              >
                <TextInput
                  style={[inputStyle, styles.textArea]}
                  multiline
                  numberOfLines={3}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={
                    isOrderPlaced
                      ? "E.g. Retailer asked for delivery before 12 PM, interested in new SKU..."
                      : "E.g. Expecting stock arrival next week, will reconsider..."
                  }
                  placeholderTextColor={colors.inkMuted}
                  editable={!submitting}
                />
              </Field>

              <Field label="Next Follow-up Date (Optional)">
                <View style={styles.followUpRow}>
                  {FOLLOW_UP_OPTIONS.map((opt) => {
                    const isSelected = selectedFollowUpDays === opt.days;
                    return (
                      <TouchableOpacity
                        key={opt.label}
                        onPress={() => setSelectedFollowUpDays(opt.days)}
                        disabled={submitting}
                        style={[
                          styles.followUpChip,
                          isSelected && styles.followUpChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.followUpText,
                            isSelected && styles.followUpTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>

              <View style={styles.actionContainer}>
                {submitting ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingText}>Closing visit with verified GPS…</Text>
                  </View>
                ) : (
                  <>
                    <PrimaryButton
                      label={
                        isOrderPlaced
                          ? "Submit Feedback & Complete Visit"
                          : "Submit & Complete Visit"
                      }
                      icon="checkmark-circle-outline"
                      onPress={() => void handleCheckout(false)}
                      disabled={submitting}
                    />

                    {isOrderPlaced && allowSkip ? (
                      <SecondaryButton
                        label="Skip Feedback & Complete Visit"
                        icon="arrow-forward-outline"
                        onPress={() => void handleCheckout(true)}
                        disabled={submitting}
                      />
                    ) : null}

                    {!isOrderPlaced && onClose ? (
                      <SecondaryButton
                        label="Cancel"
                        onPress={onClose}
                        disabled={submitting}
                      />
                    ) : null}
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  scrim: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheetContainer: {
    maxHeight: "90%",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 2,
  },
  retailerName: {
    fontSize: 13.5,
    color: colors.inkMuted,
    marginTop: 2,
    fontWeight: "500",
  },
  closeBtn: {
    padding: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  followUpRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  followUpChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  followUpChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  followUpText: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: "500",
  },
  followUpTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  actionContainer: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  loadingText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
});
