import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { otpErrorCode } from "../auth/otpErrors";
import { colors } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";
import type { TranslationKey } from "../i18n/translations";
import { RETAILER_LOGIN_ARTWORK } from "./loginBranding";

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
    default: {
      const code = otpErrorCode(error);
      if (code && /^[a-z_]+$/.test(code)) return fallback;
      return error instanceof ApiError ? error.message : fallback;
    }
  }
}

const ARTWORK = require("../../assets/auth/gagan-retailer-login.png");
const BRAND_INK = "#0D3821";
const BRAND_GREEN = "#165A31";
const CARD = "#FCFBF6";

export default function LoginScreen() {
  const auth = useAuth();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);

  const handleRequestOtp = async () => {
    if (phone.length < 10) return Alert.alert(t("auth.validPhone"));
    setBusy(true);
    try {
      await auth.requestOtp(phone);
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
      await auth.verifyOtp(phone, otp);
    } catch (e) {
      Alert.alert(t("auth.invalidOtp"), loginAlertMessage(e, t("errors.generic"), t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 18) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.artCanvas}>
          <Image
            source={ARTWORK}
            style={StyleSheet.absoluteFill}
            resizeMode="stretch"
            accessibilityIgnoresInvertColors
          />

          <View style={styles.card} accessibilityLabel="GAGAN retailer sign in">
            {stage === "phone" ? (
              <>
                <Text style={styles.cardTitle}>Welcome to GAGAN</Text>
                <Text style={styles.cardSubtitle}>Quality grains. Stronger communities.</Text>

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
                  New to GAGAN? <Text style={styles.supportLink}>Contact your distributor</Text>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  scrollContent: { flexGrow: 1 },
  artCanvas: {
    width: "100%",
    aspectRatio: RETAILER_LOGIN_ARTWORK.width / RETAILER_LOGIN_ARTWORK.height,
    position: "relative",
    overflow: "hidden",
    backgroundColor: colors.cream,
  },
  card: {
    position: "absolute",
    top: RETAILER_LOGIN_ARTWORK.cardTopPercent,
    height: RETAILER_LOGIN_ARTWORK.cardHeightPercent,
    left: RETAILER_LOGIN_ARTWORK.cardSidePercent,
    right: RETAILER_LOGIN_ARTWORK.cardSidePercent,
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
    fontSize: 22,
    lineHeight: 27,
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
