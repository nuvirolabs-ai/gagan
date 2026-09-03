import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { ocean } from "./ocean";
import { useLanguage } from "../../i18n/LanguageContext";

export type RetailerFormValues = {
  partyName: string;
  groupId: string;
  contactPerson: string;
  mobile: string;
  telephone: string;
  transporterId: string;
  address1: string;
  pin: string;
  tehsil: string;
  district: string;
  state: string;
  deliveryCity: string;
  salesmanRepId: string;
  beatId: string;
  shopTenureYears: string;
  gstin: string;
  aadhaarNumber: string;
  aadhaarPhotoAssetId: string;
  paymentTermDays: string;
  creditLimit: string;
  grade: string;
  buyerCategoryId: string;
  buyerSubCategoryId: string;
  upiId: string;
};

export type RetailerMasters = {
  groups: Array<{ id: string; name: string }>;
  transporters: Array<{ id: string; name: string }>;
  beats: Array<{ id: string; name: string }>;
  buyerCategories: Array<{ id: string; name: string; subCategories: Array<{ id: string; name: string }> }>;
  salesmen: Array<{ id: string; name: string }>;
  grades: string[];
  paymentTerms: number[];
};

const emptyForm: RetailerFormValues = {
  partyName: "",
  groupId: "",
  contactPerson: "",
  mobile: "",
  telephone: "",
  transporterId: "",
  address1: "",
  pin: "",
  tehsil: "",
  district: "",
  state: "Madhya Pradesh",
  deliveryCity: "Indore",
  salesmanRepId: "",
  beatId: "",
  shopTenureYears: "",
  gstin: "",
  aadhaarNumber: "",
  aadhaarPhotoAssetId: "",
  paymentTermDays: "15",
  creditLimit: "",
  grade: "",
  buyerCategoryId: "",
  buyerSubCategoryId: "",
  upiId: "",
};

function payloadFromForm(form: RetailerFormValues) {
  return {
    partyName: form.partyName,
    groupId: form.groupId,
    contactPerson: form.contactPerson,
    mobile: form.mobile,
    telephone: form.telephone || undefined,
    transporterId: form.transporterId,
    address1: form.address1,
    pin: form.pin || undefined,
    tehsil: form.tehsil || undefined,
    district: form.district || undefined,
    state: form.state || undefined,
    deliveryCity: form.deliveryCity,
    salesmanRepId: form.salesmanRepId,
    beatId: form.beatId || undefined,
    shopTenureYears: Number(form.shopTenureYears),
    gstin: form.gstin || undefined,
    aadhaarNumber: form.aadhaarNumber,
    aadhaarPhotoAssetId: form.aadhaarPhotoAssetId,
    paymentTermDays: Number(form.paymentTermDays),
    creditLimit: Number(form.creditLimit || 0),
    grade: form.grade,
    buyerCategoryId: form.buyerCategoryId,
    buyerSubCategoryId: form.buyerSubCategoryId || undefined,
    upiId: form.upiId || undefined,
  };
}

export function RetailerForm({
  mode,
  initialValues,
  salesmanRepId,
  masters,
  onUploadAadhaar,
  onSubmit,
  submitting,
}: {
  mode: "add" | "edit";
  initialValues?: Partial<RetailerFormValues>;
  salesmanRepId: string;
  masters: RetailerMasters | null;
  onUploadAadhaar: (body: { contentType: string; bodyBase64: string }) => Promise<{ id: string }>;
  onSubmit: (payload: ReturnType<typeof payloadFromForm>) => Promise<void>;
  submitting: boolean;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState<RetailerFormValues>({
    ...emptyForm,
    salesmanRepId,
    ...initialValues,
  });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [picker, setPicker] = useState<{ key: keyof RetailerFormValues; title: string; options: Array<{ id: string; name: string }> } | null>(null);

  useEffect(() => {
    setForm((current) => ({ ...current, salesmanRepId: salesmanRepId || current.salesmanRepId }));
  }, [salesmanRepId]);

  const subCategories = useMemo(() => {
    return masters?.buyerCategories.find((item) => item.id === form.buyerCategoryId)?.subCategories ?? [];
  }, [masters, form.buyerCategoryId]);

  const set = (key: keyof RetailerFormValues, value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "buyerCategoryId") next.buyerSubCategoryId = "";
      return next;
    });
  };

  const pickAadhaar = async () => {
    setUploading(true);
    setError("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const bodyBase64 = await new File(asset.uri).base64();
      const uploaded = await onUploadAadhaar({ contentType: asset.mimeType ?? "image/jpeg", bodyBase64 });
      set("aadhaarPhotoAssetId", uploaded.id);
    } catch (err: any) {
      setError(err?.message ?? t("errors.generic"));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError("");
    try {
      await onSubmit(payloadFromForm(form));
    } catch (err: any) {
      setError(err?.message ?? t("errors.generic"));
    }
  };

  if (!masters) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ocean.sky} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>{mode === "add" ? t("retailerForm.addKicker") : t("retailerForm.editKicker")}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Section title={t("retailerForm.sectionParty")}>
          <Field label={t("retailerForm.partyName")} required value={form.partyName} onChange={(v) => set("partyName", v)} />
          <Select label={t("retailerForm.groupName")} required value={form.groupId} options={masters.groups} onOpen={() => setPicker({ key: "groupId", title: t("retailerForm.groupName"), options: masters.groups })} />
          <Field label={t("retailerForm.contactPerson")} required value={form.contactPerson} onChange={(v) => set("contactPerson", v)} />
          <Field label={t("retailerForm.mobile")} required value={form.mobile} onChange={(v) => set("mobile", v.replace(/\D/g, "").slice(0, 10))} keyboardType="phone-pad" />
          <Field label={t("retailerForm.telephone")} value={form.telephone} onChange={(v) => set("telephone", v)} keyboardType="phone-pad" />
        </Section>

        <Section title={t("retailerForm.sectionAddress")}>
          <Field label={t("retailerForm.address1")} required value={form.address1} onChange={(v) => set("address1", v)} />
          <Field label={t("retailerForm.pin")} value={form.pin} onChange={(v) => set("pin", v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
          <Field label={t("retailerForm.tehsil")} value={form.tehsil} onChange={(v) => set("tehsil", v)} />
          <Field label={t("retailerForm.district")} value={form.district} onChange={(v) => set("district", v)} />
          <Field label={t("retailerForm.state")} value={form.state} onChange={(v) => set("state", v)} />
          <Field label={t("retailerForm.deliveryCity")} required value={form.deliveryCity} onChange={(v) => set("deliveryCity", v)} />
        </Section>

        <Section title={t("retailerForm.sectionTerritory")}>
          <Select label={t("retailerForm.salesman")} required value={form.salesmanRepId} options={masters.salesmen} onOpen={() => setPicker({ key: "salesmanRepId", title: t("retailerForm.salesman"), options: masters.salesmen })} locked={mode === "edit"} />
          <Select label={t("retailerForm.beatName")} value={form.beatId} options={[{ id: "", name: t("retailerForm.none") }, ...masters.beats]} onOpen={() => setPicker({ key: "beatId", title: t("retailerForm.beatName"), options: [{ id: "", name: t("retailerForm.none") }, ...masters.beats] })} />
          <Select label={t("retailerForm.transporter")} required value={form.transporterId} options={masters.transporters} onOpen={() => setPicker({ key: "transporterId", title: t("retailerForm.transporter"), options: masters.transporters })} />
        </Section>

        <Section title={t("retailerForm.sectionIdentity")}>
          <Field label={t("retailerForm.shopTenure")} required value={form.shopTenureYears} onChange={(v) => set("shopTenureYears", v.replace(/\D/g, "").slice(0, 2))} keyboardType="number-pad" />
          <Field label={t("retailerForm.gstin")} value={form.gstin} onChange={(v) => set("gstin", v.toUpperCase())} autoCapitalize="characters" />
          <Field label={t("retailerForm.aadhaarNumber")} required value={form.aadhaarNumber} onChange={(v) => set("aadhaarNumber", v.replace(/\D/g, "").slice(0, 12))} keyboardType="number-pad" />
          <Text style={styles.label}>{t("retailerForm.aadhaarPhoto")} *</Text>
          <TouchableOpacity style={styles.photoBtn} onPress={() => void pickAadhaar()} disabled={uploading}>
            <Ionicons name={form.aadhaarPhotoAssetId ? "checkmark-circle" : "camera-outline"} size={18} color={ocean.sky} />
            <Text style={styles.photoText}>
              {uploading ? t("retailerForm.uploading") : form.aadhaarPhotoAssetId ? t("retailerForm.photoAttached") : t("retailerForm.choosePhoto")}
            </Text>
          </TouchableOpacity>
          <Field label={t("retailerForm.upiId")} value={form.upiId} onChange={(v) => set("upiId", v)} autoCapitalize="none" />
        </Section>

        <Section title={t("retailerForm.sectionCommercial")}>
          <Select
            label={t("retailerForm.paymentTerms")}
            required
            value={form.paymentTermDays}
            options={masters.paymentTerms.map((days) => ({ id: String(days), name: `${days} days` }))}
            onOpen={() => setPicker({
              key: "paymentTermDays",
              title: t("retailerForm.paymentTerms"),
              options: masters.paymentTerms.map((days) => ({ id: String(days), name: `${days} days` })),
            })}
          />
          <Field label={t("retailerForm.creditLimit")} value={form.creditLimit} onChange={(v) => set("creditLimit", v.replace(/[^\d.]/g, ""))} keyboardType="numeric" />
          <Select
            label={t("retailerForm.grade")}
            required
            value={form.grade}
            options={masters.grades.map((grade) => ({ id: grade, name: grade }))}
            onOpen={() => setPicker({ key: "grade", title: t("retailerForm.grade"), options: masters.grades.map((grade) => ({ id: grade, name: grade })) })}
          />
          <Select label={t("retailerForm.buyerCategory")} required value={form.buyerCategoryId} options={masters.buyerCategories} onOpen={() => setPicker({ key: "buyerCategoryId", title: t("retailerForm.buyerCategory"), options: masters.buyerCategories })} />
          <Select
            label={t("retailerForm.buyerSubCategory")}
            value={form.buyerSubCategoryId}
            options={[{ id: "", name: t("retailerForm.none") }, ...subCategories]}
            onOpen={() => setPicker({ key: "buyerSubCategoryId", title: t("retailerForm.buyerSubCategory"), options: [{ id: "", name: t("retailerForm.none") }, ...subCategories] })}
          />
        </Section>

        <TouchableOpacity style={[styles.submit, submitting && styles.disabled]} disabled={submitting} onPress={() => void submit()}>
          <Text style={styles.submitText}>{submitting ? t("retailerForm.saving") : mode === "add" ? t("retailerForm.submitProposal") : t("retailerForm.saveChanges")}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={picker != null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPicker(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{picker?.title}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {picker?.options.map((option) => (
                <TouchableOpacity
                  key={option.id || "none"}
                  style={styles.option}
                  onPress={() => {
                    if (picker) set(picker.key, option.id);
                    setPicker(null);
                  }}
                >
                  <Text style={styles.optionText}>{option.name}</Text>
                  {picker && form[picker.key] === option.id ? <Ionicons name="checkmark" size={16} color={ocean.sky} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  keyboardType?: "default" | "numeric" | "number-pad" | "phone-pad";
  autoCapitalize?: "none" | "characters" | "words";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? " *" : ""}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={ocean.muted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

function Select({
  label,
  value,
  options,
  onOpen,
  required,
  locked,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  onOpen: () => void;
  required?: boolean;
  locked?: boolean;
}) {
  const selected = options.find((item) => item.id === value)?.name ?? "";
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? " *" : ""}</Text>
      <TouchableOpacity style={[styles.input, styles.select]} onPress={locked ? undefined : onOpen} disabled={locked}>
        <Text style={[styles.selectText, !selected && styles.placeholder]}>{selected || "Select"}</Text>
        <Ionicons name="chevron-down" size={16} color={ocean.muted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ocean.navy },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: ocean.navy },
  kicker: { color: ocean.sky, fontWeight: "700", marginBottom: 12, letterSpacing: 0.3 },
  error: { color: ocean.danger, marginBottom: 12, fontWeight: "600" },
  section: { backgroundColor: ocean.card, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: ocean.border },
  sectionTitle: { color: ocean.sky, fontWeight: "800", fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 },
  field: { marginBottom: 10 },
  label: { color: ocean.muted, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: ocean.input, borderWidth: 1, borderColor: ocean.border, borderRadius: 10, color: ocean.ink, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  select: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectText: { color: ocean.ink, fontSize: 15, flex: 1 },
  placeholder: { color: ocean.muted },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: ocean.input, borderWidth: 1, borderColor: ocean.sky, borderRadius: 10, padding: 12, marginBottom: 10 },
  photoText: { color: ocean.sky, fontWeight: "700" },
  submit: { backgroundColor: ocean.sky, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  submitText: { color: ocean.navy, fontWeight: "800", fontSize: 16 },
  disabled: { opacity: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: ocean.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, borderWidth: 1, borderColor: ocean.border },
  modalTitle: { color: ocean.ink, fontWeight: "800", fontSize: 16, marginBottom: 10 },
  option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: ocean.border },
  optionText: { color: ocean.ink, fontSize: 15 },
});
