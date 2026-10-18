import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useRep } from "../context/RepContext";
import { ApiError } from "../api/repClient";
import { otpErrorCode } from "../auth/otpErrors";
import { colors } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";
import type { TranslationKey } from "../i18n/translations";
import { KeyboardSafeScrollView } from "../components/ui";
import { SALESPERSON_LOGIN_ARTWORK } from "./loginBranding";
import { Msg91OtpModal } from "../components/auth/Msg91OtpModal";

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

const HERO_ARTWORK = require("../../assets/auth/gagan-sales-hero.png");
const BRAND_INK = "#0D3821";
const BRAND_GREEN = "#165A31";

export default function RepLoginScreen() {
  const { requestOtp, login, verifyMsg91Token } = useRep();
  const { t } = useLanguage();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [showMsg91, setShowMsg91] = useState(false);

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

  const handleMsg91Success = async (token: string) => {
    setShowMsg91(false);
    setBusy(true);
    try {
      await verifyMsg91Token(token, phone.length === 10 ? phone : undefined);
    } catch (e) {
      Alert.alert("Couldn't sign in", loginAlertMessage(e, t("errors.generic"), t));
    } finally {
      setBusy(false);
    }
  };

  const handleMsg91Failure = (error: unknown) => {
    console.warn("MSG91 OTP failure:", error);
    Alert.alert(
      "Verification notice",
      "MSG91 OTP verification could not be completed. You can try again or use standard SMS OTP."
    );
  };

  return (
    <KeyboardSafeScrollView
      containerStyle={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={styles.heroContainer}>
        <Image
          source={HERO_ARTWORK}
          style={styles.heroImage}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={styles.card} accessibilityLabel="GAGAN Sales sign in">
        {stage === "phone" ? (
          <>
            <Text style={styles.cardTitle}>Welcome to GAGAN SALES</Text>
            <Text style={styles.cardSubtitle}>Serve better. Grow together.</Text>

            <View style={styles.field}>
              <Ionicons name="call-outline" size={20} color={BRAND_GREEN} style={styles.fieldIcon} />
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Mobile number"
                placeholderTextColor="#8C938E"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={() => void handleRequestOtp()}
                accessibilityLabel="Mobile number"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.disabled]}
              onPress={() => void handleRequestOtp()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Login with OTP"
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.buttonInner}>
                  <Text style={styles.primaryText}>Login with OTP</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.msg91Button}
              onPress={() => setShowMsg91(true)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Login with MSG91 OTP"
              activeOpacity={0.85}
            >
              <Ionicons name="shield-checkmark" size={16} color={BRAND_GREEN} style={{ marginRight: 6 }} />
              <Text style={styles.msg91ButtonText}>Login with MSG91 OTP</Text>
            </TouchableOpacity>

            <Text style={styles.supportText}>
              New to GAGAN SALES? <Text style={styles.supportLink}>Contact your manager</Text>
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.cardTitle}>Enter the code</Text>
            <Text style={styles.cardSubtitle}>Sent via SMS to +91 {phone}</Text>

            <View style={styles.field}>
              <Ionicons name="keypad-outline" size={20} color={BRAND_GREEN} style={styles.fieldIcon} />
              <TextInput
                style={[styles.fieldInput, styles.otpInput]}
                placeholder="000000"
                placeholderTextColor="#8C938E"
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={() => void handleVerify()}
                accessibilityLabel="One-time password"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.disabled]}
              onPress={() => void handleVerify()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Verify and sign in"
            >
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Verify & sign in</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => void handleRequestOtp()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Resend OTP"
            >
              <Ionicons name="refresh-outline" size={18} color={BRAND_INK} />
              <Text style={styles.secondaryText}>Resend OTP</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.msg91Link}
              onPress={() => setShowMsg91(true)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Verify via MSG91 OTP"
            >
              <Ionicons name="shield-checkmark-outline" size={15} color={BRAND_GREEN} style={{ marginRight: 4 }} />
              <Text style={styles.msg91LinkText}>Verify via MSG91 OTP</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStage("phone")} accessibilityRole="button">
              <Text style={styles.changePhone}>Change mobile number</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      <Msg91OtpModal
        visible={showMsg91}
        phone={phone}
        onClose={() => setShowMsg91(false)}
        onSuccess={handleMsg91Success}
        onFailure={handleMsg91Failure}
      />
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: "#FFFFFF",
    paddingBottom: 28,
  },
  heroContainer: {
    width: "100%",
    aspectRatio: 472 / 600,
    backgroundColor: "#FFFFFF",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  card: {
    paddingHorizontal: 24,
    marginTop: -20,
    backgroundColor: "transparent",
  },
  cardTitle: {
    color: BRAND_INK,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  cardSubtitle: {
    color: "#5D625E",
    fontSize: 14.5,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  field: {
    minHeight: 52,
    borderWidth: 1.2,
    borderColor: "#D7D8D1",
    backgroundColor: "#FAFAF8",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  fieldIcon: {
    marginRight: 6,
  },
  countryCode: {
    color: "#202A24",
    fontSize: 15.5,
    fontWeight: "700",
    marginRight: 8,
  },
  fieldInput: {
    flex: 1,
    color: "#202A24",
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 11,
  },
  otpInput: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 4,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: BRAND_GREEN,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BRAND_GREEN,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: BRAND_INK,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  secondaryText: {
    color: BRAND_INK,
    fontSize: 15,
    fontWeight: "800",
  },
  supportText: {
    color: "#5D625E",
    fontSize: 13.5,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 16,
  },
  supportLink: {
    color: BRAND_GREEN,
    fontWeight: "800",
  },
  changePhone: {
    color: BRAND_INK,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 14,
  },
  disabled: {
    opacity: 0.72,
  },
  msg91Button: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "rgba(22, 90, 49, 0.08)",
    borderWidth: 1.2,
    borderColor: "rgba(22, 90, 49, 0.25)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  msg91ButtonText: {
    color: BRAND_GREEN,
    fontSize: 15,
    fontWeight: "700",
  },
  msg91Link: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 4,
  },
  msg91LinkText: {
    color: BRAND_GREEN,
    fontSize: 14,
    fontWeight: "700",
  },
});
