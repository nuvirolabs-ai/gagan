import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { repApi } from "../api/repClient";
import { useLanguage } from "../i18n/LanguageContext";
import { colors, radius, spacing, type } from "../theme";
import { PrimaryButton, SecondaryButton } from "./ui";

type Evidence = {
  id: string;
  signedUrl: string | null;
  createdAt: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

export default function TaskEvidenceSheet({
  visible,
  task,
  onClose,
  onChanged,
}: {
  visible: boolean;
  task: any | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useLanguage();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    if (!task?.id) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const result = await repApi.taskEvidence(task.id);
      setEvidence(result.evidence ?? []);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [task?.id]);

  useEffect(() => {
    if (visible) void refresh();
  }, [visible, refresh]);

  const choosePhoto = async (source: "camera" | "library") => {
    if (!task?.id || saving) return;
    setSaving(true);
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t("taskEvidence.title"), t("taskEvidence.cameraPermission"));
          return;
        }
      }
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.75 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            base64: true,
            quality: 0.75,
            preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          });
      if (result.canceled) return;

      const asset = result.assets[0];
      const contentType = asset.mimeType === "image/jpg" ? "image/jpeg" : asset.mimeType ?? "image/jpeg";
      if (!asset.base64 || asset.base64.length > 6_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
        Alert.alert(t("taskEvidence.title"), t("taskEvidence.invalidPhoto"));
        return;
      }

      const location = await locationIfAlreadyGranted();
      await repApi.uploadTaskEvidence(task.id, {
        contentType,
        bodyBase64: asset.base64,
        ...(location ?? {}),
      });
      await refresh();
      onChanged();
    } catch {
      Alert.alert(t("taskEvidence.title"), t("taskEvidence.uploadError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("taskEvidence.close")} onPress={onClose} style={styles.scrim} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{t("taskEvidence.title")}</Text>
              <Text style={styles.taskTitle} numberOfLines={2}>{task?.title}</Text>
              {task?.retailer?.name ? <Text style={styles.retailer}>{task.retailer.name}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("taskEvidence.close")}
              hitSlop={10}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={21} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.evidenceHeader}>
            <Text style={styles.sectionLabel}>{t("taskEvidence.savedPhotos")}</Text>
            {!loading && evidence.length > 0 ? <Text style={styles.count}>{evidence.length}</Text> : null}
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : loadFailed ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t("taskEvidence.loadError")}</Text>
              <SecondaryButton label={t("taskEvidence.retry")} icon="refresh-outline" onPress={() => void refresh()} />
            </View>
          ) : evidence.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={24} color={colors.textTertiary} />
              <Text style={styles.emptyText}>{t("taskEvidence.empty")}</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.evidenceList}>
              {evidence.map((item) => (
                <View key={item.id} style={styles.evidenceItem}>
                  {item.signedUrl ? (
                    <Image source={{ uri: item.signedUrl }} style={styles.photo} accessibilityLabel={t("taskEvidence.title")} />
                  ) : (
                    <View style={[styles.photo, styles.missingPhoto]}>
                      <Ionicons name="image-outline" size={25} color={colors.textTertiary} />
                    </View>
                  )}
                  <Text style={styles.date} numberOfLines={2}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                  {item.latitude != null && item.longitude != null ? (
                    <View style={styles.locationLabel}>
                      <Ionicons name="location-outline" size={13} color={colors.green} />
                      <Text style={styles.locationText}>{Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.actions}>
            <PrimaryButton
              label={t("taskEvidence.camera")}
              icon="camera-outline"
              onPress={() => void choosePhoto("camera")}
              disabled={saving || loading}
            />
            <SecondaryButton
              label={t("taskEvidence.library")}
              icon="images-outline"
              onPress={() => void choosePhoto("library")}
              disabled={saving || loading}
            />
            {saving ? <ActivityIndicator color={colors.primary} /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

async function locationIfAlreadyGranted() {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let reading;
    try {
      reading = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => { timeout = setTimeout(() => resolve(null), 4_000); }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    if (!reading) return undefined;
    const accuracyMeters = reading.coords.accuracy;
    if (!accuracyMeters || accuracyMeters <= 0) return undefined;
    return {
      latitude: reading.coords.latitude,
      longitude: reading.coords.longitude,
      accuracyMeters,
    };
  } catch {
    return undefined;
  }
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.38)" },
  scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  sheet: {
    maxHeight: "86%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { ...type.sectionTitle, color: colors.textSecondary, letterSpacing: 0 },
  taskTitle: { ...type.cardTitle, letterSpacing: 0, marginTop: spacing.xs },
  retailer: { ...type.caption, marginTop: 2 },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  evidenceHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionLabel: { ...type.bodyStrong },
  count: { ...type.micro, color: colors.textSecondary },
  loading: { minHeight: 100 },
  emptyState: { minHeight: 115, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  emptyText: { ...type.caption, textAlign: "center" },
  evidenceList: { gap: spacing.md, paddingBottom: spacing.xs },
  evidenceItem: { width: 142, minWidth: 142 },
  photo: { width: 142, aspectRatio: 1, borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary },
  missingPhoto: { alignItems: "center", justifyContent: "center" },
  date: { ...type.micro, marginTop: spacing.xs, minHeight: 28 },
  locationLabel: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  locationText: { ...type.micro, color: colors.green },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});
