import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { SCREEN_PAD_TOP, tokensFor } from "../theme";
import { useColorScheme } from "react-native";
import { SessionFetchError } from "../auth/sessionFetch";

export default function LoginScreen() {
  const scheme = useColorScheme();
  const colors = tokensFor(scheme);
  const insets = useSafeAreaInsets();
  const { requestOtp, verifyOtp, denied } = useAuth();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const result = await requestOtp(phone.trim());
      setChallengeId(result.challengeId ?? "challenge-1");
    } catch {
      setError("We could not send a code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!challengeId) return;
    setBusy(true);
    setError(null);
    try {
      await verifyOtp({ challengeId, phone: phone.trim(), otp: otp.trim() });
    } catch (caught) {
      if (caught instanceof SessionFetchError && caught.status === 403) {
        setError("This account is not authorised for Founder.");
      } else {
        setError("That code did not match. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.canvas, paddingTop: insets.top + SCREEN_PAD_TOP }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={[styles.kicker, { color: colors.secondary }]}>FOUNDER</Text>
      <Text style={[styles.title, { color: colors.label }]}>Sign In</Text>
      <Text style={[styles.lede, { color: colors.secondary }]}>
        Executive access is limited to founder accounts.
      </Text>

      <View style={[styles.group, { backgroundColor: colors.surface }]}>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Mobile number"
          placeholderTextColor={colors.tertiary}
          keyboardType="phone-pad"
          autoCorrect={false}
          style={[styles.input, { color: colors.label, borderBottomColor: colors.separator }]}
        />
        {challengeId ? (
          <TextInput
            value={otp}
            onChangeText={setOtp}
            placeholder="One-time code"
            placeholderTextColor={colors.tertiary}
            keyboardType="number-pad"
            style={[styles.input, { color: colors.label, borderBottomColor: "transparent" }]}
          />
        ) : null}
      </View>

      {denied || error ? (
        <Text style={[styles.error, { color: colors.negative }]}>{error ?? "This account is not authorised for Founder."}</Text>
      ) : null}

      <Pressable
        onPress={challengeId ? confirm : sendCode}
        disabled={busy || phone.trim().length < 10}
        style={[styles.button, { backgroundColor: colors.label, opacity: busy ? 0.6 : 1 }]}
      >
        {busy ? (
          <ActivityIndicator color={colors.canvas} />
        ) : (
          <Text style={[styles.buttonLabel, { color: colors.canvas }]}>
            {challengeId ? "Continue" : "Send code"}
          </Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  kicker: { fontSize: 13, fontWeight: "600", letterSpacing: 1.4, marginTop: 24 },
  title: { fontSize: 34, fontWeight: "700", marginTop: 6, letterSpacing: 0.3 },
  lede: { fontSize: 17, marginTop: 8, lineHeight: 24 },
  group: { marginTop: 32, borderRadius: 12, overflow: "hidden" },
  input: { fontSize: 17, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  error: { marginTop: 16, fontSize: 15 },
  button: { marginTop: 24, borderRadius: 12, minHeight: 50, alignItems: "center", justifyContent: "center" },
  buttonLabel: { fontSize: 17, fontWeight: "600" },
});
