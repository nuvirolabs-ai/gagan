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

const ARTWORK = require("../../assets/auth/gagan-sales-login.png");
const BRAND_INK = "#0D3821";
const BRAND_GREEN = "#165A31";
const CARD = "#FCFBF6";

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
    <KeyboardSafeScrollView
      containerStyle={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.artCanvas}>
        <Image
          source={ARTWORK}
          style={StyleSheet.absoluteFill}
          resizeMode="stretch"
          accessibilityIgnoresInvertColors
        />

        <View style={styles.card} accessibilityLabel="GAGAN Sales sign in">
          {stage === "phone" ? (
            <>
              <Text style={styles.cardTitle}>Welcome to GAGAN SALES</Text>
              <Text style={styles.cardSubtitle}>Serve better. Grow together.</Text>

              <View style={styles.field}>
                <Ionicons name="call-outline" size={21} color="#3E4540" />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Mobile number"
                  placeholderTextColor="#717873"
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
                accessibilityLabel="Login"
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Login</Text>}
              </TouchableOpacity>

              <View style={styles.separator}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorText}>OR</Text>
                <View style={styles.separatorLine} />
              </View>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => void handleRequestOtp()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Login with OTP"
              >
                <Ionicons name="qr-code-outline" size={21} color={BRAND_INK} />
                <Text style={styles.secondaryText}>Login with OTP</Text>
              </TouchableOpacity>

              <Text style={styles.supportText}>
                New to GAGAN SALES? <Text style={styles.supportLink}>Contact your manager</Text>
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Enter the code</Text>
              <Text style={styles.cardSubtitle}>Sent to {phone}</Text>

              <View style={styles.field}>
                <Ionicons name="keypad-outline" size={21} color="#3E4540" />
                <TextInput
                  style={[styles.fieldInput, styles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor="#717873"
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
                <Ionicons name="refresh-outline" size={21} color={BRAND_INK} />
                <Text style={styles.secondaryText}>Resend OTP</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStage("phone")} accessibilityRole="button">
                <Text style={styles.changePhone}>Change mobile number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  scrollContent: { flexGrow: 1, paddingBottom: 18 },
  artCanvas: {
    width: "100%",
    aspectRatio: SALESPERSON_LOGIN_ARTWORK.width / SALESPERSON_LOGIN_ARTWORK.height,
    position: "relative",
    overflow: "hidden",
    backgroundColor: colors.cream,
  },
  card: {
    position: "absolute",
    top: SALESPERSON_LOGIN_ARTWORK.cardTopPercent,
    height: SALESPERSON_LOGIN_ARTWORK.cardHeightPercent,
    left: SALESPERSON_LOGIN_ARTWORK.cardSidePercent,
    right: SALESPERSON_LOGIN_ARTWORK.cardSidePercent,
    paddingHorizontal: 23,
    paddingTop: 20,
    paddingBottom: 14,
    borderRadius: 18,
    backgroundColor: CARD,
    shadowColor: "#241C0C",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    alignItems: "stretch",
  },
  cardTitle: {
    color: BRAND_INK,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  cardSubtitle: {
    color: "#5D625E",
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 5,
    marginBottom: 16,
  },
  field: {
    minHeight: 51,
    borderWidth: 1,
    borderColor: "#D7D8D1",
    backgroundColor: "#FFFFFFA8",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  fieldInput: {
    flex: 1,
    color: "#202A24",
    fontSize: 16,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  otpInput: { fontSize: 20, fontWeight: "700", letterSpacing: 4 },
  primaryButton: {
    minHeight: 49,
    borderRadius: 14,
    backgroundColor: BRAND_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  secondaryButton: {
    minHeight: 49,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: BRAND_INK,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  secondaryText: { color: BRAND_INK, fontSize: 15.5, fontWeight: "800" },
  separator: { flexDirection: "row", alignItems: "center", marginVertical: 9 },
  separatorLine: { height: 1, backgroundColor: "#D7D8D1", flex: 1 },
  separatorText: { color: "#606762", fontSize: 14, marginHorizontal: 13 },
  supportText: { color: "#5D625E", fontSize: 13.5, lineHeight: 18, textAlign: "center", marginTop: 15 },
  supportLink: { color: BRAND_INK, fontWeight: "800" },
  changePhone: { color: BRAND_INK, fontSize: 14, fontWeight: "700", textAlign: "center", marginTop: 13 },
  disabled: { opacity: 0.72 },
});
