import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { tokensFor } from "../theme";

export default function PlaceholderScreen({ title, body }: { title: string; body: string }) {
  const colors = tokensFor(useColorScheme());
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: colors.canvas, paddingTop: insets.top + 8 }]}>
      <Text style={[styles.title, { color: colors.label }]}>{title}</Text>
      <Text style={[styles.body, { color: colors.secondary }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 34, fontWeight: "700", letterSpacing: 0.3 },
  body: { marginTop: 12, fontSize: 17, lineHeight: 24 },
});
