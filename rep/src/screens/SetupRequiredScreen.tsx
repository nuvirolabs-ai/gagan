import React from "react";
import { View } from "react-native";
import { AppScreen, EmptyState } from "../components/ui";
import { useRep } from "../context/RepContext";
import { useLanguage } from "../i18n/LanguageContext";
import { spacing } from "../theme";

export default function SetupRequiredScreen() {
  const { staff } = useRep();
  const { t } = useLanguage();
  const detail = staff?.setupCode === "role_permission_mismatch"
    ? t("setup.permissions")
    : t("setup.salesRepLink");
  return (
    <AppScreen>
      <View style={{ padding: spacing.xl }}>
        <EmptyState icon="alert-circle-outline" title={t("setup.title")} body={detail} />
      </View>
    </AppScreen>
  );
}
