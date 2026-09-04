import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../i18n/LanguageContext";
import type { LanguageCode } from "../i18n/languageState";
import { colors, radius, spacing } from "../theme";
import { TactilePressable } from "../components/ui";

export default function LanguageSelectionScreen() {
  const { language, t, completeLanguageSelection } = useLanguage();
  const [selected, setSelected] = useState<LanguageCode>(language);
  const [saving, setSaving] = useState(false);

  const continueToApp = async () => {
    setSaving(true);
    try {
      await completeLanguageSelection(selected);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.logo}>GAGAN</Text>
        <Text style={styles.title}>{t("language.chooseTitle")}</Text>
        <Text style={styles.subtitle}>{t("language.chooseSubtitle")}</Text>
        <View style={styles.options} accessibilityRole="radiogroup">
          {(["en", "hi"] as const).map((code) => {
            const active = selected === code;
            return (
              <TactilePressable
                key={code}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(code)}
                style={[styles.option, active && styles.optionActive]}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>
                  {code === "en" ? t("language.english") : t("language.hindi")}
                </Text>
                <View style={[styles.radio, active && styles.radioActive]} />
              </TactilePressable>
            );
          })}
        </View>
        <TactilePressable style={styles.continue} onPress={() => void continueToApp()} disabled={saving}>
          <Text style={styles.continueText}>{saving ? t("common.loading") : t("language.continue")}</Text>
        </TactilePressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border },
  logo: { color: colors.primary, fontSize: 26, fontWeight: "800", letterSpacing: 2, textAlign: "center", marginBottom: spacing.xl },
  title: { color: colors.ink, fontSize: 24, fontWeight: "800", textAlign: "center" },
  subtitle: { color: colors.inkMuted, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xl },
  options: { gap: spacing.sm },
  option: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  optionTextActive: { color: colors.primaryDeep },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
  radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  continue: { backgroundColor: colors.primaryDeep, borderRadius: radius.md, minHeight: 54, paddingVertical: 15, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  continueText: { color: colors.onDark, fontWeight: "800", fontSize: 15 },
});
