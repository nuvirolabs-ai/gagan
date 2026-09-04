import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { repApi } from "../api/repClient";
import { captureForegroundLocation } from "../location/deviceLocation";
import { useRep } from "../context/RepContext";
import { colors, control, radius, spacing } from "../theme";
import { useLanguage } from "../i18n/LanguageContext";

const DRAFT_KEY = "gagan.new-retailer.v2-1.draft";
const STEPS = ["Business", "Address & Delivery", "Commercial", "Identity & Review"] as const;
const PIN_RE = /^\d{6}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const UPI_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,255}@[A-Za-z][A-Za-z0-9.-]{1,63}$/;

const STATUS_TONE: Record<string, { backgroundColor: string; color: string }> = {
  approved: { backgroundColor: colors.surfaceSecondary, color: colors.primary },
  pending: { backgroundColor: colors.surfaceSecondary, color: colors.textSecondary },
  rejected: { backgroundColor: colors.dangerSoft, color: colors.danger },
  withdrawn: { backgroundColor: colors.surfaceSecondary, color: colors.textSecondary },
};

type Draft = {
  businessName: string;
  groupName: string;
  ownerName: string;
  phone: string;
  telephone: string;
  transporter: string;
  shopAddress: string;
  pinCode: string;
  tehsil: string;
  district: string;
  state: string;
  deliveryCity: string;
  shopDurationYears: string;
  gstin: string;
  paymentTerms: string;
  upiId: string;
  notes: string;
};

type FieldKey = keyof Draft | "aadhaarNumber" | "aadhaarPhoto";
type Photo = { uri: string; contentType: string; name?: string; size?: number };

const EMPTY_DRAFT: Draft = {
  businessName: "",
  groupName: "",
  ownerName: "",
  phone: "",
  telephone: "",
  transporter: "",
  shopAddress: "",
  pinCode: "",
  tehsil: "",
  district: "",
  state: "",
  deliveryCity: "",
  shopDurationYears: "",
  gstin: "",
  paymentTerms: "",
  upiId: "",
  notes: "",
};

function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function mobileIsValid(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits);
}

export default function AddRetailerScreen() {
  const { t } = useLanguage();
  const { staff, rep } = useRep();
  const [form, setForm] = useState<Draft>(EMPTY_DRAFT);
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [step, setStep] = useState(0);
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracyMeters: number } | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const update = (key: keyof Draft, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setError("");
  };

  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY).then((value) => {
      if (!value) return;
      try {
        setForm({ ...EMPTY_DRAFT, ...JSON.parse(value) });
      } catch {
        // Ignore a damaged non-sensitive draft; identity values are never in it.
      }
    });
  }, []);

  // Deliberately excludes Aadhaar and the image. Sensitive identity values stay
  // in memory until the online submission and are cleared immediately after it.
  useEffect(() => {
    const timer = setTimeout(() => void AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(form)), 250);
    return () => clearTimeout(timer);
  }, [form]);

  // Android 15+ keeps edge-to-edge content at the full window height, so the
  // native adjustResize flag alone does not protect the last form action from
  // the IME. The form owns this one keyboard-only content inset; it is not a
  // tab-bar inset and is zero as soon as the keyboard is dismissed.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", ({ endCoordinates }) => setKeyboardHeight(endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const load = useCallback(async () => {
    try {
      setProposals((await repApi.retailerProposals()).proposals ?? []);
    } catch {
      setProposals([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const captureLocation = async () => {
    const reading = await captureForegroundLocation();
    if (reading.kind === "permission_denied") {
      return Alert.alert(
        "Location permission needed",
        reading.canAskAgain ? "Allow location while using the app to pin the shop." : "Turn on location access in Settings to pin the shop."
      );
    }
    if (reading.kind === "unavailable") return Alert.alert("Location unavailable", reading.message);
    setLocation({ latitude: reading.latitude, longitude: reading.longitude, accuracyMeters: reading.accuracyMeters });
  };

  const choosePhoto = async (source: "camera" | "library") => {
    setError("");
    setFieldErrors((current) => ({ ...current, aadhaarPhoto: undefined }));
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return Alert.alert("Camera permission needed", "Allow camera access to capture the Aadhaar card photo.");
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images" as any], quality: 0.78, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images" as any], quality: 0.78, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 10_000_000) return setFieldErrors((current) => ({ ...current, aadhaarPhoto: "Photo must be smaller than 10 MB." }));
    setPhoto({ uri: asset.uri, contentType: asset.mimeType ?? "image/jpeg", name: asset.fileName ?? undefined, size: asset.fileSize });
  };

  const errorsForStep = (candidateStep: number): Partial<Record<FieldKey, string>> => {
    const issues: Partial<Record<FieldKey, string>> = {};
    if (candidateStep === 0) {
      if (form.businessName.trim().length < 2) issues.businessName = "Party Name is required.";
      if (form.groupName.trim().length < 2) issues.groupName = "Group Name is required.";
      if (form.ownerName.trim().length < 2) issues.ownerName = "Contact Person is required.";
      if (!mobileIsValid(form.phone)) issues.phone = "Enter a valid 10-digit Indian mobile number.";
    }
    if (candidateStep === 1) {
      if (!form.transporter.trim()) issues.transporter = "Transporter is required.";
      if (form.shopAddress.trim().length < 4) issues.shopAddress = "Address - 1 is required.";
      if (form.pinCode.trim() && !PIN_RE.test(form.pinCode.trim())) issues.pinCode = "PIN Code must be 6 digits.";
      if (form.deliveryCity.trim().length < 2) issues.deliveryCity = "Delivery City is required.";
    }
    if (candidateStep === 2) {
      const years = Number(form.shopDurationYears);
      if (!Number.isInteger(years) || years < 0) issues.shopDurationYears = "Enter a non-negative number of completed years.";
      const gstin = form.gstin.trim().toUpperCase();
      if (gstin && !GSTIN_RE.test(gstin)) issues.gstin = "Enter a valid GSTIN or leave this optional field blank.";
      if (!form.paymentTerms.trim()) issues.paymentTerms = "Payment Terms are required.";
      if (form.upiId.trim() && !UPI_RE.test(form.upiId.trim())) issues.upiId = "Enter a valid UPI ID or leave this optional field blank.";
    }
    if (candidateStep === 3) {
      if (!/^\d{12}$/.test(aadhaarNumber.replace(/[\s-]/g, ""))) issues.aadhaarNumber = "Aadhaar Number must contain 12 digits.";
      if (!photo) issues.aadhaarPhoto = "Aadhaar Card Photo is required.";
    }
    return issues;
  };

  const validateStep = (candidateStep: number) => {
    const issues = errorsForStep(candidateStep);
    setFieldErrors((current) => ({ ...current, ...issues }));
    return Object.values(issues)[0] ?? "";
  };

  const submit = async () => {
    for (const requiredStep of [0, 1, 2, 3]) {
      const issue = validateStep(requiredStep);
      if (issue) {
        setStep(requiredStep);
        setError(issue);
        return;
      }
    }
    if (!photo) return;
    setSaving(true);
    setError("");
    try {
      const base64 = await new File(photo.uri).base64();
      const digits = form.phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
      await repApi.proposeRetailer({
        businessName: form.businessName.trim(),
        groupName: form.groupName.trim(),
        ownerName: form.ownerName.trim(),
        phone: digits,
        telephone: form.telephone.trim() || undefined,
        transporter: form.transporter.trim(),
        shopAddress: form.shopAddress.trim(),
        pinCode: form.pinCode.trim() || undefined,
        tehsil: form.tehsil.trim() || undefined,
        district: form.district.trim() || undefined,
        state: form.state.trim() || undefined,
        deliveryCity: form.deliveryCity.trim(),
        shopDurationYears: Number(form.shopDurationYears),
        gstin: form.gstin.trim().toUpperCase() || undefined,
        aadhaarNumber: aadhaarNumber.replace(/[\s-]/g, ""),
        aadhaarPhoto: { contentType: photo.contentType, bodyBase64: base64 },
        paymentTerms: form.paymentTerms.trim(),
        upiId: form.upiId.trim() || undefined,
        notes: form.notes.trim() || undefined,
        ...(location ?? {}),
      });
      setForm(EMPTY_DRAFT);
      setAadhaarNumber("");
      setPhoto(null);
      setLocation(null);
      setStep(0);
      setFieldErrors({});
      await AsyncStorage.removeItem(DRAFT_KEY);
      await load();
      Alert.alert(t("addRetailer.sent"), t("addRetailer.sentBody"));
    } catch (err: any) {
      const code = err?.message;
      setError(
        code === "retailer_already_exists"
          ? "This shop is already on the customer list."
          : code === "proposal_already_pending"
            ? "You have already sent this shop for approval."
            : code === "PII_ENCRYPTION_KEY is required for sensitive identity data"
              ? "Identity submission is unavailable until secure staging storage is configured."
              : "Could not send this request. Try again when you have a connection."
      );
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async (id: string) => {
    try {
      await repApi.withdrawRetailerProposal(id);
      await load();
    } catch {
      Alert.alert("Could not withdraw", "Only a request still waiting can be withdrawn.");
    }
  };

  const input = (key: keyof Draft, placeholder: string, options?: { keyboardType?: any; multiline?: boolean }) => (
    <TextInput
      value={form[key]}
      onChangeText={(value) => update(key, value)}
      placeholder={placeholder}
      placeholderTextColor={colors.inkFaint}
      style={[styles.input, fieldErrors[key] && styles.inputError, options?.multiline && styles.multiline]}
      keyboardType={options?.keyboardType}
      multiline={options?.multiline}
      accessibilityLabel={placeholder}
    />
  );

  const reviewValues = useMemo(
    () => [
      ["Party Name", form.businessName],
      ["Group Name", form.groupName],
      ["Contact Person", form.ownerName],
      ["Mobile No.", form.phone],
      ["Telephone", form.telephone],
      ["Transporter", form.transporter],
      ["Address - 1", form.shopAddress],
      ["PIN Code", form.pinCode],
      ["Tehsil", form.tehsil],
      ["District", form.district],
      ["State", form.state],
      ["Delivery City", form.deliveryCity],
      ["Salesman", rep?.name ?? staff?.name ?? "Authenticated salesperson"],
      ["Shop duration", form.shopDurationYears ? `${form.shopDurationYears} years` : ""],
      ["Payment Terms", form.paymentTerms],
      ["GSTIN No.", form.gstin],
      ["Aadhaar Number", aadhaarNumber ? "Will be encrypted · ending in " + aadhaarNumber.replace(/[\s-]/g, "").slice(-4) : ""],
      ["Aadhaar Card Photo", photo ? "Ready for private upload" : ""],
      ["UPI ID", form.upiId],
    ],
    [aadhaarNumber, form, photo, rep?.name, staff?.name]
  );

  const stepContent = useMemo(() => {
    if (step === 0) {
      return (
        <>
          <Field label="Party Name*" error={fieldErrors.businessName}>{input("businessName", "Sharma General Store")}</Field>
          <Field label="Group Name*" error={fieldErrors.groupName}>{input("groupName", "Sharma Retail Group")}</Field>
          <Field label="Contact Person*" error={fieldErrors.ownerName}>{input("ownerName", "Ramesh Sharma")}</Field>
          <Field label="Mobile No.*" hint="10-digit Indian mobile number" error={fieldErrors.phone}>{input("phone", "9812345678", { keyboardType: "phone-pad" })}</Field>
          <Field label="Telephone" hint="Optional">{input("telephone", "020 2345 6789", { keyboardType: "phone-pad" })}</Field>
        </>
      );
    }
    if (step === 1) {
      return (
        <>
          <Field label="Transporter*" error={fieldErrors.transporter}>{input("transporter", "Gagan Logistics")}</Field>
          <Field label="Address - 1*" error={fieldErrors.shopAddress}>{input("shopAddress", "18 Market Road, Pune", { multiline: true })}</Field>
          <Field label="PIN Code" hint="Optional · 6 digits" error={fieldErrors.pinCode}>{input("pinCode", "411001", { keyboardType: "number-pad" })}</Field>
          <Field label="Tehsil">{input("tehsil", "Haveli")}</Field>
          <Field label="District">{input("district", "Pune")}</Field>
          <Field label="State">{input("state", "Maharashtra")}</Field>
          <Field label="Delivery City*" error={fieldErrors.deliveryCity}>{input("deliveryCity", "Pune")}</Field>
          <Pressable accessibilityRole="button" style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={() => void captureLocation()}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>{location ? `Location captured · ${Math.round(location.accuracyMeters)} m` : "Capture shop location"}</Text>
          </Pressable>
        </>
      );
    }
    if (step === 2) {
      return (
        <>
          <Field label="Salesman*" hint="Assigned from your authenticated account">
            <View style={styles.readOnly}>
              <Ionicons name="person-outline" size={17} color={colors.textSecondary} />
              <Text style={styles.readOnlyText}>{rep?.name ?? staff?.name ?? "Authenticated salesperson"}</Text>
              <Text style={styles.readOnlyBadge}>YOU</Text>
            </View>
          </Field>
          <Field label="How long have you been running a shop in this town?*" hint="Enter completed years" error={fieldErrors.shopDurationYears}>{input("shopDurationYears", "5", { keyboardType: "number-pad" })}</Field>
          <Field label="GSTIN No." hint="Optional" error={fieldErrors.gstin}>{input("gstin", "27ABCDE1234F1Z5")}</Field>
          <Field label="Payment Terms*" error={fieldErrors.paymentTerms}>{input("paymentTerms", "30 days credit")}</Field>
          <Field label="UPI ID" hint="Optional" error={fieldErrors.upiId}>{input("upiId", "store@upi", { keyboardType: "email-address" })}</Field>
        </>
      );
    }
    return (
      <>
        <View style={styles.securityNote}><Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} /><Text style={styles.securityText}>Identity details are encrypted and visible only to authorised reviewers. They are not saved in your draft.</Text></View>
        <Field label="Aadhaar Number*" hint="12 digits · encrypted on submit" error={fieldErrors.aadhaarNumber}>
          <TextInput value={aadhaarNumber} onChangeText={(value) => { setAadhaarNumber(value.replace(/\D/g, "").slice(0, 12)); setFieldErrors((current) => ({ ...current, aadhaarNumber: undefined })); setError(""); }} placeholder="1234 5678 9012" placeholderTextColor={colors.inkFaint} style={[styles.input, fieldErrors.aadhaarNumber && styles.inputError]} keyboardType="number-pad" secureTextEntry accessibilityLabel="Aadhaar Number" />
        </Field>
        <Field label="Aadhaar Card Photo*" hint="Required for manager review" error={fieldErrors.aadhaarPhoto}>
          {photo ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: photo.uri }} style={styles.photo} />
              <View style={styles.photoMeta}><Text style={styles.photoName} numberOfLines={1}>{photo.name ?? "Aadhaar photo ready"}</Text><Text style={styles.fieldHint}>Private upload on submit</Text><View style={styles.photoActions}><Pressable onPress={() => void choosePhoto("camera")}><Text style={styles.link}>Replace</Text></Pressable><Pressable onPress={() => { setPhoto(null); setFieldErrors((current) => ({ ...current, aadhaarPhoto: "Aadhaar Card Photo is required." })); }}><Text style={styles.remove}>Remove</Text></Pressable></View></View>
            </View>
          ) : (
            <View style={styles.photoButtons}><Pressable style={styles.photoButton} onPress={() => void choosePhoto("camera")}><Ionicons name="camera-outline" size={20} color={colors.primary} /><Text style={styles.photoButtonText}>Take photo</Text></Pressable><Pressable style={styles.photoButton} onPress={() => void choosePhoto("library")}><Ionicons name="images-outline" size={20} color={colors.primary} /><Text style={styles.photoButtonText}>Choose from gallery</Text></Pressable></View>
          )}
        </Field>
        <Field label="Review"><View style={styles.reviewList}>{reviewValues.map(([label, value]) => <View style={styles.reviewRow} key={label}><Text style={styles.reviewLabel}>{label}</Text><Text style={styles.reviewValue} numberOfLines={2}>{value || "—"}</Text></View>)}</View></Field>
        <Field label="Notes" hint="Optional">{input("notes", "Useful context for the reviewer", { multiline: true })}</Field>
      </>
    );
  }, [aadhaarNumber, fieldErrors, form, location, photo, rep?.name, reviewValues, staff?.name, step]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.content, keyboardHeight > 0 && { paddingBottom: keyboardHeight + spacing.xl }]} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}>
        <View style={styles.header}><Text style={styles.kicker}>CUSTOMER MASTER</Text><Text style={styles.title}>New retailer</Text><Text style={styles.subtitle}>Submit a complete store profile for manager review. Approval creates one canonical retailer.</Text></View>
        <View style={styles.stepper}>{STEPS.map((label, index) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: index === step }} onPress={() => index <= step && setStep(index)} style={styles.step}><View style={[styles.stepDot, index <= step && styles.stepDotActive]}><Text style={[styles.stepNumber, index <= step && styles.stepNumberActive]}>{index + 1}</Text></View><Text style={[styles.stepLabel, index === step && styles.stepLabelActive]}>{label}</Text></Pressable>)}</View>
        {error ? <View style={styles.errorBanner}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.errorBannerText}>{error}</Text></View> : null}
        <View style={styles.formSurface}><Text style={styles.formHeading}>{STEPS[step]}</Text><Text style={styles.formProgress}>Step {step + 1} of {STEPS.length}</Text>{stepContent}</View>
        <View style={styles.navigation}>{step > 0 ? <Pressable accessibilityRole="button" onPress={() => { setError(""); setStep((current) => current - 1); }} style={styles.backButton}><Text style={styles.backText}>Back</Text></Pressable> : <View />}{step < STEPS.length - 1 ? <Pressable accessibilityRole="button" onPress={() => { const issue = validateStep(step); if (issue) setError(issue); else { setError(""); setStep((current) => current + 1); } }} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryText}>Continue</Text><Ionicons name="arrow-forward" size={18} color={colors.onDark} /></Pressable> : <Pressable accessibilityRole="button" disabled={saving} onPress={() => void submit()} style={({ pressed }) => [styles.primaryButton, saving && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryText}>{saving ? "Sending…" : "Send for review"}</Text><Ionicons name="paper-plane-outline" size={18} color={colors.onDark} /></Pressable>}</View>
        <View style={styles.requests}><Text style={styles.sectionTitle}>My requests</Text>{proposals.length === 0 ? <Text style={styles.fieldHint}>Submitted stores and their review status will appear here.</Text> : proposals.map((proposal) => <View key={proposal.id} style={styles.requestRow}><View style={styles.requestIcon}><Ionicons name="storefront-outline" size={18} color={colors.primary} /></View><View style={styles.requestMain}><Text style={styles.requestName}>{proposal.businessName}</Text><Text style={styles.fieldHint} numberOfLines={1}>{proposal.deliveryCity ?? proposal.shopAddress}</Text></View><View style={[styles.status, STATUS_TONE[proposal.status] ?? STATUS_TONE.pending]}><Text style={[styles.statusText, { color: (STATUS_TONE[proposal.status] ?? STATUS_TONE.pending).color }]}>{proposal.status}</Text></View>{proposal.status === "pending" ? <Pressable onPress={() => void withdraw(proposal.id)}><Text style={styles.remove}>Withdraw</Text></Pressable> : null}</View>)}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { gap: spacing.xs },
  kicker: { fontSize: 10, letterSpacing: 1.2, fontWeight: "700", color: colors.textSecondary },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700", color: colors.ink, letterSpacing: -0.7 },
  subtitle: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, maxWidth: 480 },
  stepper: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  step: { alignItems: "center", gap: spacing.xs, flex: 1 },
  stepDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.separator },
  stepDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepNumber: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  stepNumberActive: { color: colors.onDark },
  stepLabel: { fontSize: 10, color: colors.textTertiary, textAlign: "center" },
  stepLabelActive: { color: colors.ink, fontWeight: "700" },
  errorBanner: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radius.md },
  errorBannerText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 18 },
  formSurface: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.lg, borderWidth: 1, borderColor: colors.border },
  formHeading: { fontSize: 19, fontWeight: "700", color: colors.ink },
  formProgress: { fontSize: 11, color: colors.textSecondary, marginTop: -spacing.md },
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  fieldHint: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
  fieldError: { color: colors.danger, fontSize: 11, lineHeight: 16 },
  input: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.ink, fontSize: 14, minHeight: control.buttonHeight },
  inputError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  multiline: { minHeight: 76, textAlignVertical: "top" },
  secondaryButton: { minHeight: control.buttonHeight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  secondaryButtonText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  readOnly: { minHeight: control.buttonHeight, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  readOnlyText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "600" },
  readOnlyBadge: { fontSize: 10, letterSpacing: 0.8, color: colors.textSecondary, fontWeight: "700" },
  securityNote: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md },
  securityText: { flex: 1, color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  photoButtons: { flexDirection: "row", gap: spacing.sm },
  photoButton: { flex: 1, minHeight: 74, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", gap: spacing.xs },
  photoButtonText: { color: colors.primary, fontSize: 12, fontWeight: "600", textAlign: "center" },
  photoPreview: { flexDirection: "row", gap: spacing.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  photo: { width: 86, height: 68, borderRadius: radius.sm, backgroundColor: colors.bg },
  photoMeta: { flex: 1, justifyContent: "center", gap: spacing.xs },
  photoName: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  photoActions: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.xs },
  link: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  remove: { color: colors.danger, fontWeight: "700", fontSize: 12 },
  reviewList: { borderTopWidth: 1, borderTopColor: colors.separator },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.separator },
  reviewLabel: { color: colors.textSecondary, fontSize: 12 },
  reviewValue: { color: colors.ink, fontSize: 12, fontWeight: "600", textAlign: "right", flex: 1 },
  navigation: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md },
  backButton: { minHeight: control.buttonHeight, justifyContent: "center", paddingHorizontal: spacing.md },
  backText: { color: colors.textSecondary, fontWeight: "700", fontSize: 14 },
  primaryButton: { minHeight: control.buttonHeight, borderRadius: radius.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  primaryText: { color: colors.onDark, fontWeight: "700", fontSize: 14 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
  requests: { gap: spacing.md, paddingTop: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  requestRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.separator, paddingVertical: spacing.sm },
  requestIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  requestMain: { flex: 1, gap: 2 },
  requestName: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  status: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: "700", textTransform: "capitalize" },
});
