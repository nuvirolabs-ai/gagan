import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useRep } from "../context/RepContext";
import { ApiError } from "../api/repClient";
import { otpErrorCode } from "../auth/otpErrors";
import { colors, radius, spacing } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";
import type { TranslationKey } from "../i18n/translations";

function loginAlertMessage(
  error: unknown,
  fallback: string,
  t: (key: TranslationKey) => string
) {
  switch (otpErrorCode(error)) {
    case "challenge_expired":
      return t("auth.challengeExpired");
    case "resend_cooldown":
      return t("auth.resendCooldown");
    case "incorrect_code":
      return t("auth.incorrectCode");
    case "invalid_challenge":
    case "challenge_used":
      return t("auth.invalidChallenge");
    default:
      return error instanceof ApiError ? error.message : fallback;
  }
}

export default function RepLoginScreen() {
  const { requestOtp, login } = useRep();
  const { t } = useLanguage();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);

  const handleRequestOtp = async () => {
    if (phone.length < 10) return Alert.alert("Enter a valid 10-digit phone number");
    setBusy(true);
    try {
      await requestOtp(phone);
      setStage("otp");
    } catch (e) {
      Alert.alert("Couldn't send OTP", loginAlertMessage(e, t("errors.generic"), t));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    try {
      await login(phone, otp);
    } catch (e) {
      Alert.alert("Couldn't sign in", loginAlertMessage(e, t("errors.generic"), t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>GAGAN</Text>
        <Text style={styles.tagline}>NUTRITION. DELIVERED.</Text>
        <View style={styles.roleChip}>
          <Ionicons name="briefcase-outline" size={13} color={colors.blue} />
          <Text style={styles.roleText}>SALES APP</Text>
        </View>

        {stage === "phone" ? (
          <>
            <Text style={styles.label}>{t("auth.signIn")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("auth.phone")}
              placeholderTextColor={colors.inkFaint}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
            />
            <TouchableOpacity style={styles.button} onPress={handleRequestOtp} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={colors.onDark} />
              ) : (
                <>
                <Text style={styles.buttonText}>{t("auth.sendOtp")}</Text>
                  <Ionicons name="arrow-forward" size={17} color={colors.onDark} />
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>
              Enter the code sent to {phone}
            </Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="000000"
              placeholderTextColor={colors.inkFaint}
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
            />
            <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={colors.onDark} />
              ) : (
                <Text style={styles.buttonText}>{t("auth.verify")}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRequestOtp} disabled={busy}>
              <Text style={styles.link}>{t("auth.resendOtp")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStage("phone")}>
              <Text style={styles.link}>{t("auth.changePhone")}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: "center", padding: spacing.xl },
  logo: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.navy,
    textAlign: "center",
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 9.5,
    fontWeight: "700",
    color: colors.blueInk,
    letterSpacing: 2,
    textAlign: "center",
    marginTop: 3,
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 5,
    backgroundColor: colors.blueSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
    marginBottom: spacing.block,
  },
  roleText: { fontSize: 10.5, fontWeight: "800", color: colors.blue, letterSpacing: 1 },

  label: { fontSize: 13.5, color: colors.inkMuted, marginBottom: spacing.md, lineHeight: 19 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  otpInput: { fontSize: 22, letterSpacing: 8, textAlign: "center", fontWeight: "700" },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.blue,
    borderRadius: radius.lg,
    minHeight: 50,
    paddingVertical: 15,
  },
  buttonText: { color: colors.onDark, fontWeight: "700", fontSize: 15.5 },
  link: { textAlign: "center", color: colors.blue, marginTop: spacing.lg, fontWeight: "600" },
});
