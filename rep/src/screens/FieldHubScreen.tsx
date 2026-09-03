import React from "react";
import { useLanguage } from "../i18n/LanguageContext";
import FieldPlaceholderScreen from "./FieldPlaceholderScreen";

export default function FieldHubScreen({ route }: { route: { params?: { kind?: "leave" | "expenses" | "salesKit" } } }) {
  const { t } = useLanguage();
  const kind = route.params?.kind ?? "leave";
  return <FieldPlaceholderScreen title={t(`more.${kind}`)} body={t(`more.${kind}Empty`)} />;
}
