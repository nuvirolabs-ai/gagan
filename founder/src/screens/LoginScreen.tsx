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
import { useFounder } from "../context/FounderContext";
import { ApiError, DEMO_OTP, DEMO_PHONE } from "../api/founder";
import { colors, radius, spacing, type as typeScale } from "../theme";

export default function LoginScreen() {
  const { requestOtp, login } = useFounder();
  const [phone, setPhone] = useState(__DEV__ ? DEMO_PHONE : "");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);

  const handleRequestOtp = async () => {
    if (phone.replace(/\D/g, "").length < 10) {
      return Alert.alert("Enter a valid 10-digit phone number");
    }
    setBusy(true);
    try {
      await requestOtp(phone);
      setStage("otp");
    } catch (e) {
      Alert.alert("Couldn't send OTP", e instanceof ApiError ? e.message : "Try again, or use the fixture demo phone.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    try {
      await login(phone, otp);
    } catch (e) {
      Alert.alert("Couldn't sign in", e instanceof ApiError ? e.message : "Check the code and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.inner}>
        <Text style={styles.brand}>GAGAN · FOUNDERS</Text>
        <Text style={styles.logo}>Pulse</Text>
        <Text style={styles.tag}>Quiet instrument · CEO board</Text>

        {stage === "phone" ? (
          <>
            <Text style={styles.label}>Sign in with your staff phone</Text>
            <TextInput
              style={styles.input}
              placeholder="Phone"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
              autoFocus
            />
            <TouchableOpacity style={styles.button} onPress={handleRequestOtp} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <>
                  <Text style={styles.buttonText}>Send OTP</Text>
                  <Ionicons name="arrow-forward" size={17} color={colors.ink} />
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.hint}>
              Demo fixture: {DEMO_PHONE} / {DEMO_OTP}. Live staff OTP uses the existing identity API; CEO KPI
              aggregates still map from the pulse fixture until GET /founder/pulse exists.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.label}>Enter the code sent to {phone}</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="000000"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
            />
            <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.buttonText}>Verify</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStage("phone")}>
              <Text style={styles.link}>Change phone</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: "center", padding: spacing.xxl },
  brand: { ...typeScale.brand, textAlign: "center" },
  logo: { ...typeScale.display, textAlign: "center", marginTop: 8 },
  tag: { ...typeScale.meta, textAlign: "center", marginTop: 6, marginBottom: spacing.xxl },
  label: { ...typeScale.meta, marginBottom: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
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
    backgroundColor: colors.panelAlt,
    borderRadius: radius.md,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonText: { color: colors.ink, fontWeight: "700", fontSize: 15.5 },
  link: { textAlign: "center", color: colors.accent, marginTop: spacing.lg, fontWeight: "600" },
  hint: { ...typeScale.micro, marginTop: spacing.xl, lineHeight: 16, textAlign: "center" },
});
