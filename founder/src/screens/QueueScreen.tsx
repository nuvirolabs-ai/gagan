import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, type as typeScale } from "../theme";
import { PulseHeader } from "../components/PulseHeader";
import { Panel } from "../components/ui";

/** Queue is out of this pass — pending chairman lock. */
export default function QueueScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <PulseHeader brand="Gagan · Founders" title="Queue" />
      <Panel>
        <Text style={typeScale.title}>Coming soon</Text>
        <Text style={styles.body}>
          Queue (issues / decisions) is not in this pass. Today and Series are locked to Quiet Instrument; Queue
          waits on a chairman lock before UI lands.
        </Text>
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  body: { ...typeScale.meta, marginTop: spacing.md, lineHeight: 18 },
});
