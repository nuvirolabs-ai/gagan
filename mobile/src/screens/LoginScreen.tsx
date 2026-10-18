import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { otpErrorCode } from "../auth/otpErrors";
import { useLanguage } from "../i18n/LanguageContext";
import type { TranslationKey } from "../i18n/translations";
import { RETAILER_LOGIN_ARTWORK } from "./loginBranding";
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
    default: {
      const code = otpErrorCode(error);
      if (code && /^[a-z_]+$/.test(code)) return fallback;
      return error instanceof ApiError ? error.message : fallback;
    }
  }
}

const ARTWORK = require("../../assets/auth/gagan-retailer-login.png");
const BRAND_INK = RETAILER_LOGIN_ARTWORK.brandInk;
const BRAND_GREEN = RETAILER_LOGIN_ARTWORK.brandGreen;
const BG_YELLOW = RETAILER_LOGIN_ARTWORK.bgYellow;

export default function LoginScreen() {
  const auth = useAuth();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showMsg91, setShowMsg91] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

  const handleMsg91Success = async (token: string) => {
    setShowMsg91(false);
    setBusy(true);
    try {
      await auth.verifyMsg91Token(token, phone.length === 10 ? phone : undefined);
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
    <View style={styles.screen}>
      <View style={[styles.canvas, { height: windowHeight }]}>
        <Image
          source={ARTWORK}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />

        <View
          style={[
            styles.formContainer,
            {
              bottom: keyboardHeight,
              paddingBottom: Math.max(insets.bottom + 16, 28),
            },
          ]}
          accessibilityLabel="GAGAN retailer sign in"
        >
          {stage === "phone" ? (
                <>
                  <View style={styles.field}>
                    <Ionicons name="call" size={19} color={BRAND_GREEN} style={styles.fieldIcon} />
                    <Text style={styles.countryCode}>+91</Text>
                    <View style={styles.fieldDivider} />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="Enter mobile number"
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
                    accessibilityLabel="Login"
                    activeOpacity={0.88}
                  >
                    {busy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={styles.buttonInner}>
                        <Text style={styles.primaryText}>Login with OTP</Text>
                        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={styles.buttonIcon} />
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
                    <Ionicons name="shield-checkmark" size={16} color={BRAND_GREEN} style={styles.msg91ButtonIcon} />
                    <Text style={styles.msg91ButtonText}>Login with MSG91 OTP</Text>
                  </TouchableOpacity>

                  <Text style={styles.supportText}>
                    New to GAGAN?{" "}
                    <Text style={styles.supportLink}>Contact your distributor</Text>
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.otpTitle}>Enter OTP</Text>
                  <Text style={styles.otpSubtitle}>Sent to +91 {phone}</Text>

                  <View style={styles.field}>
                    <Ionicons name="keypad" size={19} color={BRAND_GREEN} style={styles.fieldIcon} />
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
                    activeOpacity={0.88}
                  >
                    {busy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={styles.buttonInner}>
                        <Text style={styles.primaryText}>Verify & sign in</Text>
                        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.otpActions}>
                    <TouchableOpacity
                      onPress={() => void handleRequestOtp()}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel="Resend OTP"
                      style={styles.resendBtn}
                    >
                      <Ionicons name="refresh" size={16} color={BRAND_INK} />
                      <Text style={styles.resendText}>Resend OTP</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setShowMsg91(true)}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel="Verify via MSG91 OTP"
                      style={styles.msg91Link}
                    >
                      <Ionicons name="shield-checkmark-outline" size={15} color={BRAND_GREEN} />
                      <Text style={styles.msg91LinkText}>Verify via MSG91 OTP</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setStage("phone")} accessibilityRole="button">
                      <Text style={styles.changePhone}>Change mobile number</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
        <Msg91OtpModal
          visible={showMsg91}
          onClose={() => setShowMsg91(false)}
          phone={phone}
          onSuccess={handleMsg91Success}
          onFailure={handleMsg91Failure}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_YELLOW,
  },
  canvas: {
    width: "100%",
    position: "relative",
    backgroundColor: BG_YELLOW,
  },
  formContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: "stretch",
  },
  field: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: "rgba(0, 0, 0, 0.08)",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fieldIcon: {
    marginRight: 6,
  },
  countryCode: {
    color: "#16241B",
    fontSize: 16,
    fontWeight: "700",
    marginRight: 8,
  },
  fieldDivider: {
    width: 1,
    height: 22,
    backgroundColor: "#DCD8C5",
    marginRight: 10,
  },
  fieldInput: {
    flex: 1,
    color: "#16241B",
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 12,
  },
  otpInput: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 6,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: BRAND_GREEN,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0D3821",
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonIcon: {
    marginLeft: 8,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 16.5,
    fontWeight: "800",
  },
  supportText: {
    color: "#4A4016",
    fontSize: 13.5,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 14,
    fontWeight: "600",
  },
  supportLink: {
    color: BRAND_GREEN,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  otpTitle: {
    color: BRAND_INK,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
  },
  otpSubtitle: {
    color: "#4A4016",
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "600",
  },
  otpActions: {
    marginTop: 14,
    alignItems: "center",
    gap: 10,
  },
  resendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resendText: {
    color: BRAND_INK,
    fontSize: 14,
    fontWeight: "700",
  },
  changePhone: {
    color: BRAND_GREEN,
    fontSize: 13.5,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  disabled: {
    opacity: 0.72,
  },
  msg91Button: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "rgba(22, 90, 49, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(22, 90, 49, 0.22)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  msg91ButtonIcon: {
    marginRight: 6,
  },
  msg91ButtonText: {
    color: BRAND_GREEN,
    fontSize: 15,
    fontWeight: "700",
  },
  msg91Link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  msg91LinkText: {
    color: BRAND_GREEN,
    fontSize: 13.5,
    fontWeight: "700",
  },
});
