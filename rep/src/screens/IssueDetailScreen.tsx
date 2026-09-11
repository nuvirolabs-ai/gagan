import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { AppScreen, Banner, EmptyState, SectionTitle, Surface, Tag } from "../components/ui";
import { repApi } from "../api/repClient";
import { colors, spacing } from "../theme";
import { ISSUE_TYPES } from "./IssuesScreen";

const STATUS_TONE: Record<string, "green" | "gold" | "danger" | "neutral"> = {
  open: "gold",
  in_progress: "gold",
  resolved: "green",
  closed: "neutral",
  rejected: "danger",
};

export default function IssueDetailScreen({ route }: any) {
  const issueId = route?.params?.issueId as string;
  const [issue, setIssue] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const response = await repApi.issues();
    setIssue((response.issues ?? []).find((item: any) => item.id === issueId) ?? null);
  }, [issueId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().catch(() => Alert.alert("Could not load the issue", "Try again when you have a connection.")).finally(() => setLoading(false));
    }, [load])
  );

  if (loading) {
    return <AppScreen><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View></AppScreen>;
  }
  if (!issue) {
    return <AppScreen><EmptyState icon="alert-circle-outline" title="Issue not found" body="It may have been closed or is no longer in your assigned list." /></AppScreen>;
  }

  const typeLabel = ISSUE_TYPES.find((option) => option.value === issue.type)?.label ?? issue.type;
  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
      >
        <Surface>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>SERVICE ISSUE</Text>
              <Text style={styles.title}>{issue.retailer?.name ?? "Customer issue"}</Text>
              <Text style={styles.muted}>{typeLabel}</Text>
            </View>
            <Tag label={String(issue.status).replace(/_/g, " ")} tone={STATUS_TONE[issue.status] ?? "neutral"} />
          </View>
          {issue.retailer?.shopAddress ? <Text style={styles.address}>{issue.retailer.shopAddress}</Text> : null}
          <View style={styles.metaRow}>
            <Tag label={`${issue.priority ?? "normal"} priority`} tone={issue.priority === "urgent" || issue.priority === "high" ? "danger" : "neutral"} />
            {issue.assignedTeam ? <Text style={styles.muted}>Assigned to {issue.assignedTeam}</Text> : <Text style={styles.muted}>Awaiting assignment</Text>}
          </View>
        </Surface>

        <Surface>
          <SectionTitle title="What needs attention" />
          <Text style={styles.body}>{issue.description}</Text>
          {issue.resolutionNote ? <Banner tone="active" title="Resolution note" body={issue.resolutionNote} /> : null}
        </Surface>

        <Surface>
          <SectionTitle title="Activity" />
          <Text style={styles.muted}>Raised {new Date(issue.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</Text>
          {issue.updatedAt ? <Text style={styles.muted}>Updated {new Date(issue.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</Text> : null}
          {issue.resolvedAt ? <Text style={styles.muted}>Resolved {new Date(issue.resolvedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</Text> : null}
        </Surface>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.xl, gap: spacing.section, paddingBottom: spacing.xxl },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  kicker: { color: colors.inkMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1.1 },
  title: { color: colors.ink, fontSize: 23, lineHeight: 28, fontWeight: "700", marginTop: 5 },
  muted: { color: colors.inkMuted, fontSize: 13, lineHeight: 19 },
  address: { color: colors.inkMuted, fontSize: 13, lineHeight: 19, marginTop: spacing.md },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.lg },
  body: { color: colors.ink, fontSize: 16, lineHeight: 24 },
});
