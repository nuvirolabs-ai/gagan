import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
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
import { staffCapabilities } from "../auth/staffCapabilities";
import { colors, control, radius, spacing } from "../theme";
import { KeyboardSafeScrollView } from "../components/ui";

const DRAFT_KEY = "gagan.new-retailer.v3.draft";
const STEPS = ["Business", "Location", "Commercial", "References", "Identity & Hindi"] as const;
const PIN_RE = /^\d{6}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const UPI_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,255}@[A-Za-z][A-Za-z0-9.-]{1,63}$/;

const FALLBACK_GRADES = ["A", "B", "C", "D"];
const FALLBACK_CATEGORIES = [
  "Kirana / General Store",
  "Wholesaler",
  "Supermarket / Mart",
  "HoReCa (Hotel / Restaurant / Catering)",
  "Semi-Wholesaler",
  "Distributor",
  "Institution / Bulk Buyer",
];
const FALLBACK_SUBCATEGORIES = [
  "Retail Kirana",
  "Wholesale Kirana",
  "Modern Trade / Mart",
  "Caterer / Mithai",
  "Hotel / Restaurant",
  "Grain Merchant",
  "Institutional",
  "Other",
];
const FALLBACK_PAYMENT_TERMS = [
  "Advance",
  "Cash on Delivery",
  "7 days",
  "15 days",
  "21 days",
  "30 days",
  "45 days",
];
const FALLBACK_STATES = [
  "Madhya Pradesh",
  "Maharashtra",
  "Rajasthan",
  "Uttar Pradesh",
  "Gujarat",
  "Chhattisgarh",
  "Delhi",
  "Haryana",
];
const FALLBACK_CITIES = [
  "Indore",
  "Bhopal",
  "Ujjain",
  "Dewas",
  "Dhar",
  "Pithampur",
  "Mhow",
  "Rau",
  "Ratlam",
  "Khandwa",
  "Khargone",
  "Shujalpur",
  "Sehore",
  "Jabalpur",
  "Gwalior",
  "Sagar",
  "Rewa",
  "Satna",
  "Neemuch",
  "Mandsaur",
];

const STATUS_TONE: Record<string, { backgroundColor: string; color: string }> = {
  pending: { backgroundColor: colors.warningSoft, color: colors.warning },
  approved: { backgroundColor: colors.successSoft, color: colors.success },
  rejected: { backgroundColor: colors.errorSoft, color: colors.error },
  withdrawn: { backgroundColor: colors.surfaceAlt, color: colors.textSecondary },
};

type ReferenceDraft = {
  referencedRetailerId?: string;
  referencedShopName: string;
  referencedPhone: string;
  referencedCity: string;
  referencedAddress: string;
  notes: string;
  isManualFallback: boolean;
};

type Draft = {
  businessName: string;
  groupName: string;
  ownerName: string;
  phone: string;
  telephone: string;
  transporter: string;
  broker: string;
  shopAddress: string;
  addressLine2: string;
  beatName: string;
  pinCode: string;
  tehsil: string;
  district: string;
  state: string;
  deliveryCity: string;
  shopDurationYears: string;
  gstin: string;
  paymentTerms: string;
  proposedCreditLimit: string;
  grade: string;
  buyerCategory: string;
  buyerSubCategory: string;
  upiId: string;
  remark: string;
  businessNameHi: string;
  transporterHi: string;
  shopAddressHi: string;
  addressLine2Hi: string;
  beatNameHi: string;
  deliveryCityHi: string;
  tehsilHi: string;
  districtHi: string;
  stateHi: string;
  customLocationUsed: boolean;
  references: ReferenceDraft[];
};

type FieldKey = keyof Draft | "aadhaarNumber" | "aadhaarPhoto" | "aadhaarPhotoBack" | "references";
type Photo = { uri: string; contentType: string; name?: string; size?: number; base64?: string };

const emptyReference = (): ReferenceDraft => ({
  referencedShopName: "",
  referencedPhone: "",
  referencedCity: "",
  referencedAddress: "",
  notes: "",
  isManualFallback: false,
});

const EMPTY_DRAFT: Draft = {
  businessName: "",
  groupName: "",
  ownerName: "",
  phone: "",
  telephone: "",
  transporter: "",
  broker: "",
  shopAddress: "",
  addressLine2: "",
  beatName: "",
  pinCode: "",
  tehsil: "",
  district: "",
  state: "",
  deliveryCity: "",
  shopDurationYears: "",
  gstin: "",
  paymentTerms: "7 days",
  proposedCreditLimit: "",
  grade: "",
  buyerCategory: "",
  buyerSubCategory: "",
  upiId: "",
  remark: "",
  businessNameHi: "",
  transporterHi: "",
  shopAddressHi: "",
  addressLine2Hi: "",
  beatNameHi: "",
  deliveryCityHi: "",
  tehsilHi: "",
  districtHi: "",
  stateHi: "",
  customLocationUsed: false,
  references: [emptyReference(), emptyReference(), emptyReference()],
};

type CityRetailerCandidate = {
  id: string;
  name: string;
  phone?: string;
  deliveryCity?: string | null;
  shopAddress?: string | null;
  grade?: string | null;
  buyerCategory?: string | null;
};

type FormMetadata = {
  grades: string[];
  buyerCategories: string[];
  buyerSubCategories: string[];
  paymentTermsOptions: string[];
  locations: {
    states: string[];
    districtsByState: Record<string, string[]>;
    tehsilsByDistrict: Record<string, string[]>;
    cities: string[];
    citiesByState: Record<string, string[]>;
  };
};

function mobileIsValid(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits);
}

function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
}

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={{ color: colors.error }}> *</Text> : null}
      </Text>
      {children}
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export default function AddRetailerScreen({ navigation }: any) {
  const { staff, rep } = useRep();
  const canOrderForRetailers = staffCapabilities(staff?.permissions ?? []).canOrderForRetailers;
  const salesmanDisplayName = staff?.name || rep?.name || "Authenticated Salesperson";

  const [form, setForm] = useState<Draft>(EMPTY_DRAFT);
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [photoFront, setPhotoFront] = useState<Photo | null>(null);
  const [photoBack, setPhotoBack] = useState<Photo | null>(null);
  const [step, setStep] = useState(0);
  const [proposals, setProposals] = useState<any[]>([]);
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);
  const [jumpToRequests, setJumpToRequests] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracyMeters: number } | null>(null);

  const [metadata, setMetadata] = useState<FormMetadata>({
    grades: FALLBACK_GRADES,
    buyerCategories: FALLBACK_CATEGORIES,
    buyerSubCategories: FALLBACK_SUBCATEGORIES,
    paymentTermsOptions: FALLBACK_PAYMENT_TERMS,
    locations: {
      states: FALLBACK_STATES,
      districtsByState: {},
      tehsilsByDistrict: {},
      cities: FALLBACK_CITIES,
      citiesByState: {},
    },
  });

  // PIN code lookup state
  const [pinLookupBusy, setPinLookupBusy] = useState(false);
  const [pinNotice, setPinNotice] = useState("");
  const lastLookedUpPinRef = useRef("");

  // Standardized location modal picker
  const [locationPicker, setLocationPicker] = useState<{
    field: "state" | "district" | "tehsil" | "deliveryCity";
    title: string;
    allowCustom: boolean;
    options: string[];
  } | null>(null);
  const [locationSearch, setLocationSearch] = useState("");

  // Same-city reference search state
  const [cityRetailers, setCityRetailers] = useState<CityRetailerCandidate[]>([]);
  const [cityRetailerCount, setCityRetailerCount] = useState<number>(0);
  const [cityRetailersLoading, setCityRetailersLoading] = useState(false);
  const [refPickerIndex, setRefPickerIndex] = useState<number | null>(null);
  const [refSearchQuery, setRefSearchQuery] = useState("");
  const [refPickerResults, setRefPickerResults] = useState<CityRetailerCandidate[]>([]);

  // Hindi auto-translation state
  const [hindiLoading, setHindiLoading] = useState(false);
  const [hindiNotice, setHindiNotice] = useState("");
  const lastTranslatedSigRef = useRef("");

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    if (error) setError("");
  };

  // Load draft & form metadata
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved && typeof saved === "object") {
          setForm({
            ...EMPTY_DRAFT,
            ...saved,
            references:
              Array.isArray(saved.references) && saved.references.length >= 3
                ? saved.references.map((r: any) => ({ ...emptyReference(), ...r }))
                : [emptyReference(), emptyReference(), emptyReference()],
          });
        }
      })
      .catch(() => {});

    repApi
      .retailerProposalMetadata()
      .then((res: any) => {
        if (res && typeof res === "object") {
          setMetadata({
            grades: Array.isArray(res.grades) && res.grades.length ? res.grades : FALLBACK_GRADES,
            buyerCategories:
              Array.isArray(res.buyerCategories) && res.buyerCategories.length
                ? res.buyerCategories
                : FALLBACK_CATEGORIES,
            buyerSubCategories:
              Array.isArray(res.buyerSubCategories) && res.buyerSubCategories.length
                ? res.buyerSubCategories
                : FALLBACK_SUBCATEGORIES,
            paymentTermsOptions:
              Array.isArray(res.paymentTermsOptions) && res.paymentTermsOptions.length
                ? res.paymentTermsOptions
                : FALLBACK_PAYMENT_TERMS,
            locations: {
              states: res.locations?.states?.length ? res.locations.states : FALLBACK_STATES,
              districtsByState: res.locations?.districtsByState ?? {},
              tehsilsByDistrict: res.locations?.tehsilsByDistrict ?? {},
              cities: res.locations?.cities?.length ? res.locations.cities : FALLBACK_CITIES,
              citiesByState: res.locations?.citiesByState ?? {},
            },
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(form)), 250);
    return () => clearTimeout(timer);
  }, [form]);

  const load = useCallback(async () => {
    try {
      setProposals((await repApi.retailerProposals()).proposals ?? []);
    } catch {
      // ignore initial failure
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // PIN code lookup effect when 6 digits entered
  useEffect(() => {
    const cleanPin = form.pinCode.replace(/\D/g, "");
    if (!PIN_RE.test(cleanPin)) {
      lastLookedUpPinRef.current = "";
      setPinNotice("");
      return;
    }
    if (lastLookedUpPinRef.current === cleanPin) return;
    lastLookedUpPinRef.current = cleanPin;
    setPinLookupBusy(true);
    setPinNotice("");
    repApi
      .lookupRetailerPinCode(cleanPin)
      .then((res: any) => {
        if (!res?.found) {
          setPinNotice("PIN details not found automatically — select State/District below.");
          return;
        }
        setForm((cur) => ({
          ...cur,
          state: res.state || cur.state,
          district: res.district || cur.district,
          tehsil: res.tehsil || cur.tehsil,
          deliveryCity: cur.deliveryCity || res.city || "",
          customLocationUsed: false,
        }));
        setPinNotice(
          `PIN ${cleanPin} matched: ${[res.tehsil, res.district, res.state].filter(Boolean).join(", ")}`
        );
      })
      .catch(() => {
        setPinNotice("Could not fetch PIN lookup — select location from list.");
      })
      .finally(() => setPinLookupBusy(false));
  }, [form.pinCode]);

  // Same-city existing retailers loader whenever city changes or entering Step 3
  const loadCityRetailers = useCallback(async (city: string, query?: string) => {
    if (!city.trim()) {
      setCityRetailers([]);
      setCityRetailerCount(0);
      return;
    }
    setCityRetailersLoading(true);
    try {
      const res: any = await repApi.sameCityRetailers(city.trim(), query);
      const list: CityRetailerCandidate[] = Array.isArray(res?.retailers) ? res.retailers : [];
      if (!query) {
        setCityRetailers(list);
        setCityRetailerCount(Number(res?.totalInCity ?? list.length));
      } else {
        setRefPickerResults(list);
      }
    } catch {
      if (!query) {
        setCityRetailers([]);
        setCityRetailerCount(0);
      }
    } finally {
      setCityRetailersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === 3 && form.deliveryCity.trim()) {
      void loadCityRetailers(form.deliveryCity.trim());
    }
  }, [step, form.deliveryCity, loadCityRetailers]);

  // Hindi auto-translator whenever entering Step 4
  const runHindiTranslation = useCallback(
    async (forceOverwrite = false) => {
      const sig = JSON.stringify({
        businessName: form.businessName,
        transporter: form.transporter,
        shopAddress: form.shopAddress,
        addressLine2: form.addressLine2,
        beatName: form.beatName,
        deliveryCity: form.deliveryCity,
        tehsil: form.tehsil,
        district: form.district,
        state: form.state,
      });
      if (!forceOverwrite && lastTranslatedSigRef.current === sig && form.businessNameHi.trim()) {
        return;
      }
      lastTranslatedSigRef.current = sig;
      setHindiLoading(true);
      setHindiNotice("");
      try {
        const res: any = await repApi.translateRetailerHindi({
          businessName: form.businessName,
          transporter: form.transporter,
          shopAddress: form.shopAddress,
          addressLine2: form.addressLine2,
          beatName: form.beatName,
          deliveryCity: form.deliveryCity,
          tehsil: form.tehsil,
          district: form.district,
          state: form.state,
        });
        const hi = res?.hindi ?? {};
        setForm((cur) => ({
          ...cur,
          businessNameHi: forceOverwrite || !cur.businessNameHi.trim() ? hi.businessNameHi ?? cur.businessNameHi : cur.businessNameHi,
          transporterHi: forceOverwrite || !cur.transporterHi.trim() ? hi.transporterHi ?? cur.transporterHi : cur.transporterHi,
          shopAddressHi: forceOverwrite || !cur.shopAddressHi.trim() ? hi.shopAddressHi ?? cur.shopAddressHi : cur.shopAddressHi,
          addressLine2Hi: forceOverwrite || !cur.addressLine2Hi.trim() ? hi.addressLine2Hi ?? cur.addressLine2Hi : cur.addressLine2Hi,
          beatNameHi: forceOverwrite || !cur.beatNameHi.trim() ? hi.beatNameHi ?? cur.beatNameHi : cur.beatNameHi,
          deliveryCityHi: forceOverwrite || !cur.deliveryCityHi.trim() ? hi.deliveryCityHi ?? cur.deliveryCityHi : cur.deliveryCityHi,
          tehsilHi: forceOverwrite || !cur.tehsilHi.trim() ? hi.tehsilHi ?? cur.tehsilHi : cur.tehsilHi,
          districtHi: forceOverwrite || !cur.districtHi.trim() ? hi.districtHi ?? cur.districtHi : cur.districtHi,
          stateHi: forceOverwrite || !cur.stateHi.trim() ? hi.stateHi ?? cur.stateHi : cur.stateHi,
        }));
        setHindiNotice("Auto-translated from English. Review and edit any Hindi text if needed.");
      } catch {
        setHindiNotice("Offline mode — enter Hindi details manually or retry when online.");
      } finally {
        setHindiLoading(false);
      }
    },
    [
      form.addressLine2,
      form.beatName,
      form.businessName,
      form.businessNameHi,
      form.deliveryCity,
      form.district,
      form.shopAddress,
      form.state,
      form.tehsil,
      form.transporter,
    ]
  );

  useEffect(() => {
    if (step === 4) {
      void runHindiTranslation(false);
    }
  }, [step, runHindiTranslation]);

  const captureLocation = async () => {
    const reading = await captureForegroundLocation();
    if (reading.kind === "captured") {
      setLocation({
        latitude: reading.latitude,
        longitude: reading.longitude,
        accuracyMeters: reading.accuracyMeters,
      });
      setError("");
    } else if (reading.kind === "permission_denied") {
      setError("Location permission denied. Enable device location in Settings to pin the shop coordinates.");
    } else {
      setError(reading.message);
    }
  };

  const choosePhoto = async (side: "front" | "back", source: "camera" | "library") => {
    setError("");
    const errorKey = side === "front" ? "aadhaarPhoto" : "aadhaarPhotoBack";
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[errorKey];
      return next;
    });
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError("Camera access is needed to capture the Aadhaar photo.");
        return;
      }
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.55, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.55, base64: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const rawMime = (asset.mimeType ?? "image/jpeg").toLowerCase();
    const contentType = rawMime === "image/jpg" ? "image/jpeg" : rawMime;
    const pickedPhoto: Photo = {
      uri: asset.uri,
      contentType,
      name: asset.fileName ?? `${side}.jpg`,
      size: asset.fileSize ?? undefined,
      base64: asset.base64 ?? undefined,
    };
    if (side === "front") setPhotoFront(pickedPhoto);
    else setPhotoBack(pickedPhoto);
  };

  const openLocationPicker = (field: "state" | "district" | "tehsil" | "deliveryCity") => {
    const states = metadata.locations.states;
    let options: string[] = [];
    let title = "";
    let allowCustom = false;
    if (field === "state") {
      title = "Select State";
      options = states;
    } else if (field === "district") {
      title = form.state ? `Select District (${form.state})` : "Select District";
      const byState = metadata.locations.districtsByState[form.state] ?? [];
      options = byState.length
        ? byState
        : Array.from(new Set(Object.values(metadata.locations.districtsByState).flat())).sort();
      allowCustom = true;
    } else if (field === "tehsil") {
      title = form.district ? `Select Tehsil (${form.district})` : "Select Tehsil";
      const byDistrict = metadata.locations.tehsilsByDistrict[form.district] ?? [];
      options = byDistrict.length
        ? byDistrict
        : Array.from(new Set(Object.values(metadata.locations.tehsilsByDistrict).flat())).sort();
      allowCustom = true;
    } else {
      title = "Select Delivery City / Town / Village";
      const byState = metadata.locations.citiesByState[form.state] ?? [];
      options = Array.from(new Set([...byState, ...metadata.locations.cities])).sort();
      allowCustom = true;
    }
    setLocationSearch("");
    setLocationPicker({ field, title, allowCustom, options });
  };

  const openReferencePicker = (idx: number) => {
    setRefPickerIndex(idx);
    setRefSearchQuery("");
    setRefPickerResults(cityRetailers);
    if (form.deliveryCity.trim()) {
      void loadCityRetailers(form.deliveryCity.trim(), "");
    }
  };

  const updateReferenceSlot = (idx: number, patch: Partial<ReferenceDraft>) => {
    setForm((cur) => {
      const next = [...cur.references];
      next[idx] = { ...(next[idx] ?? emptyReference()), ...patch };
      return { ...cur, references: next };
    });
    setFieldErrors((cur) => {
      if (!cur.references) return cur;
      const next = { ...cur };
      delete next.references;
      return next;
    });
  };

  const addReferenceSlot = () => {
    setForm((cur) => ({ ...cur, references: [...cur.references, emptyReference()] }));
  };

  const removeReferenceSlot = (idx: number) => {
    if (form.references.length <= 3) return;
    setForm((cur) => ({
      ...cur,
      references: cur.references.filter((_, i) => i !== idx),
    }));
  };

  const errorsForStep = (candidateStep: number): Partial<Record<FieldKey, string>> => {
    const issues: Partial<Record<FieldKey, string>> = {};
    if (candidateStep === 0) {
      if (!form.businessName.trim()) issues.businessName = "Enter the shop or party name";
      if (!form.groupName.trim()) issues.groupName = "Enter the group name";
      if (!form.ownerName.trim()) issues.ownerName = "Enter the contact person name";
      if (!mobileIsValid(form.phone)) issues.phone = "Enter a valid 10-digit mobile number";
      if (!form.transporter.trim()) issues.transporter = "Enter the transporter name";
    }
    if (candidateStep === 1) {
      if (!form.shopAddress.trim()) issues.shopAddress = "Enter Address - 1";
      if (!PIN_RE.test(form.pinCode.trim())) issues.pinCode = "Enter a 6-digit PIN code";
      if (!form.state.trim()) issues.state = "Select State";
      if (!form.district.trim()) issues.district = "Select District";
      if (!form.tehsil.trim()) issues.tehsil = "Select Tehsil";
      if (!form.deliveryCity.trim()) issues.deliveryCity = "Select City (जहाँ माल जाना है)";
    }
    if (candidateStep === 2) {
      const years = Number(form.shopDurationYears);
      if (!form.shopDurationYears.trim() || !Number.isFinite(years) || years < 0 || years > 120) {
        issues.shopDurationYears = "Enter shop running duration in years (0 to 120)";
      }
      if (!form.paymentTerms.trim()) issues.paymentTerms = "Select Payment Terms";
      if (!form.grade.trim()) issues.grade = "Select Grade (A / B / C / D)";
      if (!form.buyerCategory.trim()) issues.buyerCategory = "Select Buyer Category";
      if (form.proposedCreditLimit.trim()) {
        const limitNum = Number(form.proposedCreditLimit);
        if (!Number.isFinite(limitNum) || limitNum < 0) {
          issues.proposedCreditLimit = "Credit limit must be a positive amount";
        }
      }
      const gstin = form.gstin.trim().toUpperCase();
      if (gstin && !GSTIN_RE.test(gstin)) {
        issues.gstin = "GSTIN must be 15 characters in standard format";
      }
      if (form.upiId.trim() && !UPI_RE.test(form.upiId.trim())) {
        issues.upiId = "Enter a valid UPI ID (example@bank)";
      }
    }
    if (candidateStep === 3) {
      const filledRefs = form.references.filter((r) => r.referencedShopName.trim().length >= 2);
      if (filledRefs.length < 3) {
        issues.references = `At least 3 existing retailer references in ${form.deliveryCity || "this city"} are required (${filledRefs.length}/3 added).`;
      } else {
        const dbIds = filledRefs.map((r) => r.referencedRetailerId).filter(Boolean);
        if (new Set(dbIds).size !== dbIds.length) {
          issues.references = "Select distinct retailers — the same store cannot be listed twice.";
        }
        const badManual = filledRefs.find(
          (r) => !r.referencedRetailerId && !mobileIsValid(r.referencedPhone)
        );
        if (badManual) {
          issues.references = "Enter a valid 10-digit mobile number for any manual market reference.";
        }
      }
    }
    if (candidateStep === 4) {
      if (!/^\d{12}$/.test(aadhaarNumber.trim())) {
        issues.aadhaarNumber = "Enter the 12-digit Aadhaar number";
      }
      if (!photoFront) issues.aadhaarPhoto = "Upload front photo of Aadhaar card";
      if (!photoBack) issues.aadhaarPhotoBack = "Upload back photo of Aadhaar card";
      if (!form.businessNameHi.trim()) issues.businessNameHi = "Hindi Party Name is required";
      if (!form.transporterHi.trim()) issues.transporterHi = "Hindi Transporter is required";
      if (!form.shopAddressHi.trim()) issues.shopAddressHi = "Hindi Address - 1 is required";
      if (!form.deliveryCityHi.trim()) issues.deliveryCityHi = "Hindi City is required";
    }
    return issues;
  };

  const validateStep = (candidateStep: number) => {
    const issues = errorsForStep(candidateStep);
    if (Object.keys(issues).length === 0) return "";
    setFieldErrors((current) => ({ ...current, ...issues }));
    return Object.values(issues)[0] ?? "Complete all required fields";
  };

  const submit = async () => {
    for (const requiredStep of [0, 1, 2, 3, 4]) {
      const issue = validateStep(requiredStep);
      if (issue) {
        setStep(requiredStep);
        setError(issue);
        return;
      }
    }
    if (!photoFront || !photoBack) {
      setError("Upload both Aadhaar front and back photos.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const readBase64 = async (photo: Photo): Promise<string> => {
        if (photo.base64) return photo.base64;
        if (Platform.OS !== "web" && photo.uri) {
          return await new File(photo.uri).base64();
        }
        throw new Error("aadhaar_photo_required");
      };

      const base64Front = await readBase64(photoFront);
      const base64Back = await readBase64(photoBack);
      const digits = normalizePhoneDigits(form.phone);

      const filledReferences = form.references
        .filter((r) => r.referencedShopName.trim().length >= 2)
        .map((r) => ({
          referencedRetailerId: r.referencedRetailerId || undefined,
          referencedShopName: r.referencedShopName.trim(),
          referencedPhone: r.referencedPhone.trim()
            ? normalizePhoneDigits(r.referencedPhone)
            : undefined,
          referencedCity: r.referencedCity.trim() || form.deliveryCity.trim(),
          referencedAddress: r.referencedAddress.trim() || undefined,
          notes: r.notes.trim() || undefined,
        }));

      const result = await repApi.proposeRetailer({
        businessName: form.businessName.trim(),
        groupName: form.groupName.trim(),
        ownerName: form.ownerName.trim(),
        phone: digits,
        telephone: form.telephone.trim() || undefined,
        transporter: form.transporter.trim(),
        broker: form.broker.trim() || undefined,
        shopAddress: form.shopAddress.trim(),
        addressLine2: form.addressLine2.trim() || undefined,
        beatName: form.beatName.trim() || undefined,
        pinCode: form.pinCode.trim(),
        tehsil: form.tehsil.trim(),
        district: form.district.trim(),
        state: form.state.trim(),
        deliveryCity: form.deliveryCity.trim(),
        shopDurationYears: Number(form.shopDurationYears),
        gstin: form.gstin.trim() ? form.gstin.trim().toUpperCase() : undefined,
        aadhaarNumber: aadhaarNumber.trim(),
        aadhaarPhoto: { contentType: photoFront.contentType, bodyBase64: base64Front },
        aadhaarPhotoBack: { contentType: photoBack.contentType, bodyBase64: base64Back },
        paymentTerms: form.paymentTerms.trim(),
        proposedCreditLimit: form.proposedCreditLimit.trim()
          ? Number(form.proposedCreditLimit)
          : undefined,
        grade: form.grade.trim(),
        buyerCategory: form.buyerCategory.trim(),
        buyerSubCategory: form.buyerSubCategory.trim() || undefined,
        remark: form.remark.trim() || undefined,
        upiId: form.upiId.trim() || undefined,
        businessNameHi: form.businessNameHi.trim(),
        transporterHi: form.transporterHi.trim(),
        shopAddressHi: form.shopAddressHi.trim(),
        addressLine2Hi: form.addressLine2Hi.trim() || undefined,
        beatNameHi: form.beatNameHi.trim() || undefined,
        deliveryCityHi: form.deliveryCityHi.trim(),
        tehsilHi: form.tehsilHi.trim() || undefined,
        districtHi: form.districtHi.trim() || undefined,
        stateHi: form.stateHi.trim() || undefined,
        customLocationUsed: form.customLocationUsed,
        references: filledReferences,
        ...(location
          ? {
              latitude: location.latitude,
              longitude: location.longitude,
              accuracyMeters: location.accuracyMeters,
            }
          : {}),
      });

      await AsyncStorage.removeItem(DRAFT_KEY);
      setForm(EMPTY_DRAFT);
      setAadhaarNumber("");
      setPhotoFront(null);
      setPhotoBack(null);
      setLocation(null);
      setFieldErrors({});
      setStep(0);
      await load();

      if (canOrderForRetailers && result?.proposal?.id) {
        Alert.alert(
          "New retailer submitted",
          "Sent to Dispatch and Credit Team with 3+ references. Want to punch an opening order right now?",
          [
            { text: "Done", style: "cancel" },
            {
              text: "Take order",
              onPress: () =>
                navigation.navigate("RepCatalog", {
                  proposalId: result.proposal.id,
                  retailerName: result.proposal.businessName,
                }),
            },
          ]
        );
      } else {
        Alert.alert("New retailer submitted", "Sent to Dispatch and Credit Team for approval.");
      }
    } catch (err: any) {
      const code = err?.body?.error || err?.message;
      const details = err?.body?.details;
      if (code === "invalid_input" && details?.fieldErrors) {
        const errors = details.fieldErrors;
        const firstKey = Object.keys(errors)[0];
        if (firstKey) {
          setError(`Validation error on "${firstKey}": ${errors[firstKey][0]}`);
          return;
        }
      }
      const messageMap: Record<string, string> = {
        retailer_phone_already_registered: "A store is already registered with this mobile number.",
        aadhaar_already_registered: "This Aadhaar number is already linked to an existing store.",
        duplicate_pending_proposal: "A pending review already exists for this phone or Aadhaar.",
        aadhaar_photo_too_large: "Aadhaar photo exceeds the 5 MB size limit.",
        aadhaar_photo_type_not_allowed: "Use JPG, PNG, or WEBP photo for Aadhaar.",
        aadhaar_back_photo_required: "Aadhaar Card Back photo is mandatory.",
        references_minimum_three:
          err?.body?.message || "At least 3 same-city retailer references are mandatory.",
        duplicate_reference: "Please select distinct retailers — do not repeat the same reference.",
        hindi_translation_required:
          "Hindi Party Name, Transporter, Address - 1, and City are required.",
        location_pin_tehsil_district_state_required:
          "PIN Code, Tehsil, District, and State are all required.",
        missing_required_fields:
          err?.body?.message || "Please complete all mandatory (*) fields before submitting.",
      };
      setError(messageMap[code] ?? err?.body?.message ?? "Could not submit store proposal.");
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async (id: string) => {
    setWithdrawing(id);
    try {
      await repApi.withdrawRetailerProposal(id);
      await load();
    } catch (err: any) {
      setError(err?.body?.message || "Could not withdraw proposal.");
    } finally {
      setWithdrawing(null);
    }
  };

  const textInput = (
    key: Exclude<keyof Draft, "customLocationUsed" | "references">,
    placeholder: string,
    options?: { keyboardType?: any; multiline?: boolean; autoCapitalize?: "none" | "words" | "characters" }
  ) => (
    <TextInput
      style={[
        styles.input,
        options?.multiline && styles.multiline,
        fieldErrors[key] && styles.inputError,
      ]}
      value={form[key] as string}
      onChangeText={(value) => update(key, value)}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      keyboardType={options?.keyboardType}
      autoCapitalize={options?.autoCapitalize}
      multiline={options?.multiline}
      editable={!saving}
    />
  );

  const selectedRefIds = useMemo(
    () =>
      new Set(
        form.references.map((r) => r.referencedRetailerId).filter((v): v is string => Boolean(v))
      ),
    [form.references]
  );

  const stepContent = (() => {
    if (step === 0) {
      return (
        <View style={styles.section}>
          <Field label="Party Name" required error={fieldErrors.businessName}>
            {textInput("businessName", "Full legal / shop name")}
          </Field>
          <Field label="Group Name" required error={fieldErrors.groupName}>
            {textInput("groupName", "Parent trading group or Direct customer")}
          </Field>
          <Field label="Contact Person" required error={fieldErrors.ownerName}>
            {textInput("ownerName", "Owner or authorised buyer")}
          </Field>
          <Field label="Mobile No." required error={fieldErrors.phone}>
            {textInput("phone", "10-digit WhatsApp / mobile number", { keyboardType: "phone-pad" })}
          </Field>
          <Field label="Telephone">
            {textInput("telephone", "Landline number (optional)", { keyboardType: "phone-pad" })}
          </Field>
          <Field label="Transporter" required error={fieldErrors.transporter}>
            {textInput("transporter", "Preferred carrier / transport name")}
          </Field>
          <Field label="Broker">
            {textInput("broker", "Dalal / broker name (optional)")}
          </Field>
        </View>
      );
    }

    if (step === 1) {
      return (
        <View style={styles.section}>
          <Field label="Address - 1" required error={fieldErrors.shopAddress}>
            {textInput("shopAddress", "Shop number, market, main street", { multiline: true })}
          </Field>
          <Field label="Address - 2" hint="Colony, landmark, nearby market">
            {textInput("addressLine2", "Landmark / locality (optional)")}
          </Field>
          <Field label="Beat Name">
            {textInput("beatName", "Route / beat name (optional)")}
          </Field>
          <Field
            label="PIN Code"
            required
            error={fieldErrors.pinCode}
            hint={pinLookupBusy ? "Looking up PIN code..." : pinNotice || "6-digit PIN auto-fills State, District & Tehsil"}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1 }}>
                {textInput("pinCode", "6-digit PIN code", { keyboardType: "number-pad" })}
              </View>
              {pinLookupBusy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            </View>
          </Field>

          <Field label="State" required error={fieldErrors.state}>
            <Pressable
              accessibilityRole="button"
              style={[styles.pickerTrigger, fieldErrors.state && styles.inputError]}
              onPress={() => openLocationPicker("state")}
            >
              <Text style={form.state ? styles.pickerValue : styles.pickerPlaceholder}>
                {form.state || "Choose standardized state"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </Pressable>
          </Field>

          <Field label="District" required error={fieldErrors.district}>
            <Pressable
              accessibilityRole="button"
              style={[styles.pickerTrigger, fieldErrors.district && styles.inputError]}
              onPress={() => openLocationPicker("district")}
            >
              <Text style={form.district ? styles.pickerValue : styles.pickerPlaceholder}>
                {form.district || "Choose standardized district"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </Pressable>
          </Field>

          <Field label="Tehsil" required error={fieldErrors.tehsil}>
            <Pressable
              accessibilityRole="button"
              style={[styles.pickerTrigger, fieldErrors.tehsil && styles.inputError]}
              onPress={() => openLocationPicker("tehsil")}
            >
              <Text style={form.tehsil ? styles.pickerValue : styles.pickerPlaceholder}>
                {form.tehsil || "Choose standardized tehsil"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </Pressable>
          </Field>

          <Field
            label="City (जहाँ माल जाना है उस सिटी का नाम)"
            required
            error={fieldErrors.deliveryCity}
            hint="Select from master city/town list, or add unlisted town if missing"
          >
            <Pressable
              accessibilityRole="button"
              style={[styles.pickerTrigger, fieldErrors.deliveryCity && styles.inputError]}
              onPress={() => openLocationPicker("deliveryCity")}
            >
              <Text style={form.deliveryCity ? styles.pickerValue : styles.pickerPlaceholder}>
                {form.deliveryCity || "Choose standardized delivery city"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </Pressable>
          </Field>

          {form.customLocationUsed ? (
            <View style={styles.customLocBanner}>
              <Ionicons name="warning-outline" size={16} color={colors.warning} />
              <Text style={styles.customLocText}>
                Custom city/tehsil entered — Dispatch & Credit Team will verify spelling.
              </Text>
            </View>
          ) : null}

          <Field label="Shop storefront location" hint="Optional but speeds up dispatch verification">
            <Pressable
              accessibilityRole="button"
              style={styles.locationButton}
              onPress={() => void captureLocation()}
            >
              <Ionicons name="location-outline" size={18} color={colors.primaryDeep} />
              <Text style={styles.locationText}>
                {location ? `Pinned (±${Math.round(location.accuracyMeters)}m)` : "Capture shop GPS"}
              </Text>
            </Pressable>
          </Field>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={styles.section}>
          <Field label="Salesman" required hint="Linked to your authenticated account">
            <View style={styles.readOnlyBox}>
              <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.readOnlyText}>{salesmanDisplayName}</Text>
            </View>
          </Field>

          <Field
            label="Shop Duration (सर, आप इस टाउन में कब से दुकान चला रहे हैं?)"
            required
            error={fieldErrors.shopDurationYears}
          >
            {textInput("shopDurationYears", "Years operating in this town (e.g. 5)", {
              keyboardType: "number-pad",
            })}
          </Field>

          <Field label="Payment Terms" required error={fieldErrors.paymentTerms}>
            <View style={styles.chipWrap}>
              {metadata.paymentTermsOptions.map((opt) => {
                const active = form.paymentTerms === opt;
                return (
                  <Pressable
                    key={opt}
                    style={[styles.choiceChip, active && styles.choiceChipActive]}
                    onPress={() => update("paymentTerms", opt)}
                  >
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
            {textInput("paymentTerms", "Or type custom payment terms")}
          </Field>

          <Field label="Credit Limit (₹)" error={fieldErrors.proposedCreditLimit} hint="Proposed credit limit (optional)">
            {textInput("proposedCreditLimit", "e.g. 50000", { keyboardType: "number-pad" })}
          </Field>

          <Field label="Grade" required error={fieldErrors.grade}>
            <View style={styles.chipWrap}>
              {metadata.grades.map((g) => {
                const active = form.grade === g;
                return (
                  <Pressable
                    key={g}
                    style={[styles.choiceChip, active && styles.choiceChipActive]}
                    onPress={() => update("grade", g)}
                  >
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                      Grade {g}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="Buyer Category" required error={fieldErrors.buyerCategory}>
            <View style={styles.chipWrap}>
              {metadata.buyerCategories.map((cat) => {
                const active = form.buyerCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    style={[styles.choiceChip, active && styles.choiceChipActive]}
                    onPress={() => update("buyerCategory", cat)}
                  >
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{cat}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="Buyer Sub Category">
            <View style={styles.chipWrap}>
              {metadata.buyerSubCategories.map((sub) => {
                const active = form.buyerSubCategory === sub;
                return (
                  <Pressable
                    key={sub}
                    style={[styles.choiceChip, active && styles.choiceChipActive]}
                    onPress={() => update("buyerSubCategory", active ? "" : sub)}
                  >
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{sub}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="GSTIN No." error={fieldErrors.gstin}>
            {textInput("gstin", "15-character GSTIN (optional)", { autoCapitalize: "characters" })}
          </Field>

          <Field label="UPI ID" error={fieldErrors.upiId}>
            {textInput("upiId", "name@bank (optional)", { autoCapitalize: "none" })}
          </Field>

          <Field label="Remark">
            {textInput("remark", "Any commercial / market remark for Credit & Dispatch (optional)", {
              multiline: true,
            })}
          </Field>
        </View>
      );
    }

    if (step === 3) {
      const filledCount = form.references.filter((r) => r.referencedShopName.trim().length >= 2).length;
      const allowManualFallback = cityRetailerCount < 3;
      return (
        <View style={styles.section}>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>
              Same-City Retailer References ({filledCount}/3 mandatory)
            </Text>
            <Text style={styles.infoBoxBody}>
              Record at least 3 existing retailers in{" "}
              <Text style={{ fontWeight: "700" }}>{form.deliveryCity || "this city"}</Text> who
              have vouched that supply to this new party is safe. Tap "+ Add Reference" for a 4th,
              5th, 6th or 7th+. Credit Team will verify these references.
            </Text>
            {cityRetailersLoading ? (
              <Text style={[styles.fieldHint, { marginTop: 4 }]}>
                Loading existing stores in {form.deliveryCity}...
              </Text>
            ) : (
              <Text style={[styles.fieldHint, { marginTop: 4 }]}>
                {cityRetailerCount} registered customer{cityRetailerCount === 1 ? "" : "s"} found in{" "}
                {form.deliveryCity || "selected city"}.
              </Text>
            )}
          </View>

          {fieldErrors.references ? (
            <Text style={styles.fieldError}>{fieldErrors.references}</Text>
          ) : null}

          {form.references.map((ref, idx) => (
            <View key={idx} style={styles.refCard}>
              <View style={styles.refHeader}>
                <Text style={styles.refTitle}>
                  Reference #{idx + 1} {idx < 3 ? "(Mandatory)" : "(Additional)"}
                </Text>
                {idx >= 3 ? (
                  <Pressable onPress={() => removeReferenceSlot(idx)}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                accessibilityRole="button"
                style={styles.pickerTrigger}
                onPress={() => openReferencePicker(idx)}
              >
                <Text
                  style={ref.referencedShopName ? styles.pickerValue : styles.pickerPlaceholder}
                  numberOfLines={1}
                >
                  {ref.referencedShopName
                    ? `${ref.referencedShopName}${ref.referencedPhone ? ` · ${ref.referencedPhone}` : ""}`
                    : `Select retailer in ${form.deliveryCity || "city"}`}
                </Text>
                <Ionicons name="search-outline" size={18} color={colors.primary} />
              </Pressable>

              {ref.referencedRetailerId ? (
                <Text style={styles.fieldHint}>
                  Linked DB Customer · {ref.referencedCity || form.deliveryCity}
                  {ref.referencedAddress ? ` · ${ref.referencedAddress}` : ""}
                </Text>
              ) : null}

              {allowManualFallback ? (
                <View style={{ marginTop: 6 }}>
                  <Pressable
                    onPress={() =>
                      updateReferenceSlot(idx, {
                        isManualFallback: !ref.isManualFallback,
                        referencedRetailerId: undefined,
                      })
                    }
                  >
                    <Text style={[styles.orderAction, { fontSize: 12 }]}>
                      {ref.isManualFallback
                        ? "Use existing customer picker instead"
                        : "Fewer than 3 DB retailers in town? Enter manual market reference"}
                    </Text>
                  </Pressable>
                  {ref.isManualFallback ? (
                    <View style={{ gap: 8, marginTop: 6 }}>
                      <TextInput
                        style={styles.input}
                        value={ref.referencedShopName}
                        onChangeText={(v) =>
                          updateReferenceSlot(idx, {
                            referencedShopName: v,
                            referencedRetailerId: undefined,
                          })
                        }
                        placeholder="Vouching shop / retailer name *"
                        placeholderTextColor={colors.textTertiary}
                      />
                      <TextInput
                        style={styles.input}
                        value={ref.referencedPhone}
                        onChangeText={(v) => updateReferenceSlot(idx, { referencedPhone: v })}
                        placeholder="10-digit mobile number *"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="phone-pad"
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}

              <TextInput
                style={[styles.input, { marginTop: 6 }]}
                value={ref.notes}
                onChangeText={(v) => updateReferenceSlot(idx, { notes: v })}
                placeholder="Confirmation note (optional, e.g. 5 yrs neighbor trader)"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          ))}

          <Pressable
            accessibilityRole="button"
            style={styles.addRefButton}
            onPress={addReferenceSlot}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.addRefText}>+ Add Reference (4th, 5th, 6th...)</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Field
          label="Aadhaar Number"
          required
          error={fieldErrors.aadhaarNumber}
          hint="Encrypted on server and masked for dispatch & credit review"
        >
          <TextInput
            style={[styles.input, fieldErrors.aadhaarNumber && styles.inputError]}
            value={aadhaarNumber}
            onChangeText={(v) => {
              setAadhaarNumber(v.replace(/\D/g, "").slice(0, 12));
              if (error) setError("");
            }}
            placeholder="12-digit Aadhaar number"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            maxLength={12}
          />
        </Field>

        <Field label="Aadhaar Card Photo Front" required error={fieldErrors.aadhaarPhoto}>
          <View style={styles.photoRow}>
            <Pressable style={styles.photoBtn} onPress={() => void choosePhoto("front", "camera")}>
              <Ionicons name="camera-outline" size={18} color={colors.ink} />
              <Text style={styles.photoBtnText}>Camera Front</Text>
            </Pressable>
            <Pressable style={styles.photoBtn} onPress={() => void choosePhoto("front", "library")}>
              <Ionicons name="image-outline" size={18} color={colors.ink} />
              <Text style={styles.photoBtnText}>Gallery Front</Text>
            </Pressable>
          </View>
          {photoFront ? (
            <Image source={{ uri: photoFront.uri }} style={styles.thumb} />
          ) : null}
        </Field>

        <Field label="Aadhaar Card Photo Back" required error={fieldErrors.aadhaarPhotoBack}>
          <View style={styles.photoRow}>
            <Pressable style={styles.photoBtn} onPress={() => void choosePhoto("back", "camera")}>
              <Ionicons name="camera-outline" size={18} color={colors.ink} />
              <Text style={styles.photoBtnText}>Camera Back</Text>
            </Pressable>
            <Pressable style={styles.photoBtn} onPress={() => void choosePhoto("back", "library")}>
              <Ionicons name="image-outline" size={18} color={colors.ink} />
              <Text style={styles.photoBtnText}>Gallery Back</Text>
            </Pressable>
          </View>
          {photoBack ? (
            <Image source={{ uri: photoBack.uri }} style={styles.thumb} />
          ) : null}
        </Field>

        <View style={styles.hindiSection}>
          <View style={styles.hindiHeader}>
            <Text style={styles.hindiTitle}>Hindi Details (हिंदी विवरण)</Text>
            <Pressable
              style={styles.retranslateBtn}
              onPress={() => void runHindiTranslation(true)}
              disabled={hindiLoading}
            >
              {hindiLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="refresh" size={15} color={colors.primary} />
              )}
              <Text style={styles.retranslateText}>Auto-Translate</Text>
            </Pressable>
          </View>
          {hindiNotice ? <Text style={styles.fieldHint}>{hindiNotice}</Text> : null}

          <Field label="Hindi Party Name (पार्टी का नाम)" required error={fieldErrors.businessNameHi}>
            {textInput("businessNameHi", "हिंदी में दुकान/पार्टी का नाम")}
          </Field>
          <Field label="Hindi Transporter (ट्रांसपोर्टर)" required error={fieldErrors.transporterHi}>
            {textInput("transporterHi", "हिंदी में ट्रांसपोर्टर का नाम")}
          </Field>
          <Field label="Hindi Address - 1 (पता - 1)" required error={fieldErrors.shopAddressHi}>
            {textInput("shopAddressHi", "हिंदी में पूरा पता", { multiline: true })}
          </Field>
          <Field label="Hindi Address - 2 (पता - 2 / लैंडमार्क)">
            {textInput("addressLine2Hi", "हिंदी में लैंडमार्क / क्षेत्र")}
          </Field>
          <Field label="Hindi Beat Name (बीट का नाम)">
            {textInput("beatNameHi", "हिंदी में बीट का नाम")}
          </Field>
          <Field
            label="Hindi City (जहाँ माल जाना है उस सिटी का नाम)"
            required
            error={fieldErrors.deliveryCityHi}
          >
            {textInput("deliveryCityHi", "हिंदी में शहर का नाम")}
          </Field>
          <Field label="Hindi Tehsil (तहसील)">
            {textInput("tehsilHi", "हिंदी में तहसील")}
          </Field>
          <Field label="Hindi District (जिला)">
            {textInput("districtHi", "हिंदी में जिला")}
          </Field>
          <Field label="Hindi State (राज्य)">
            {textInput("stateHi", "हिंदी में राज्य")}
          </Field>
        </View>

        <View style={styles.reviewBox}>
          <Text style={styles.reviewTitle}>Final Summary</Text>
          <Text style={styles.reviewLine}>
            {form.businessName || "—"} ({form.businessNameHi || "—"}) · {form.deliveryCity || "—"}
          </Text>
          <Text style={styles.reviewLine}>
            Grade {form.grade || "—"} · {form.buyerCategory || "—"} · {form.paymentTerms || "—"}
          </Text>
          <Text style={styles.reviewLine}>
            References:{" "}
            {form.references.filter((r) => r.referencedShopName.trim().length >= 2).length} same-city
            stores attached
          </Text>
        </View>
      </View>
    );
  })();

  if (loading && !refreshing && proposals.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardSafeScrollView key={step} externalScrollRef={scrollRef} containerStyle={styles.screen} contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>FIELD ONBOARDING</Text>
        <Text style={styles.title}>New Retailer Proposal</Text>
        <Text style={styles.subtitle}>
          Collect complete English + Hindi store profile, Aadhaar Front/Back, standardized location,
          and 3+ same-city references.
        </Text>
      </View>

      {proposals.length > 0 ? (
        <Pressable
          style={styles.jumpPill}
          onPress={() => {
            setJumpToRequests(true);
            scrollRef.current?.scrollToEnd({ animated: true });
          }}
        >
          <Ionicons name="list-outline" size={16} color={colors.primary} />
          <Text style={styles.jumpText}>
            View submitted requests ({proposals.length})
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.stepper}>
        {STEPS.map((label, idx) => (
          <Pressable
            key={label}
            style={[styles.stepItem, step === idx && styles.stepItemActive]}
            onPress={() => {
              Keyboard.dismiss();
              setError("");
              setStep(idx);
            }}
          >
            <Text style={[styles.stepIndex, step === idx && styles.stepIndexActive]}>
              {idx + 1}
            </Text>
            <Text style={[styles.stepLabel, step === idx && styles.stepLabelActive]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {stepContent}

      <View style={styles.navigation}>
        {step > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              Keyboard.dismiss();
              setError("");
              setStep((current) => current - 1);
            }}
            style={styles.backButton}
          >
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}

        {step < STEPS.length - 1 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const issue = validateStep(step);
              if (issue) setError(issue);
              else {
                Keyboard.dismiss();
                setError("");
                setStep((current) => current + 1);
              }
            }}
            style={styles.nextButton}
          >
            <Text style={styles.nextText}>Next: {STEPS[step + 1]}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => {
              Keyboard.dismiss();
              void submit();
            }}
            style={[styles.nextButton, saving && { opacity: 0.55 }]}
          >
            <Text style={styles.nextText}>{saving ? "Submitting..." : "Send for review"}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.requestsSection}>
        <Text style={styles.sectionTitle}>
          Submitted Retailer Requests ({proposals.length})
          {jumpToRequests ? " ↓" : ""}
        </Text>
        {proposals.map((proposal) => (
          <View key={proposal.id} style={styles.requestCard}>
            <Pressable
              style={styles.requestTop}
              onPress={() =>
                setExpandedProposalId((cur) => (cur === proposal.id ? null : proposal.id))
              }
            >
              <View style={styles.requestIcon}>
                <Ionicons name="storefront-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.requestMain}>
                <Text style={styles.requestName}>{proposal.businessName}</Text>
                <Text style={styles.fieldHint} numberOfLines={1}>
                  {proposal.deliveryCity ?? proposal.shopAddress}
                  {Array.isArray(proposal.references)
                    ? ` · ${proposal.references.length} refs`
                    : ""}
                </Text>
              </View>
              <View style={[styles.status, STATUS_TONE[proposal.status] ?? STATUS_TONE.pending]}>
                <Text
                  style={[
                    styles.statusText,
                    { color: (STATUS_TONE[proposal.status] ?? STATUS_TONE.pending).color },
                  ]}
                >
                  {proposal.status}
                </Text>
              </View>
              <Ionicons
                name={expandedProposalId === proposal.id ? "chevron-up" : "chevron-down"}
                size={17}
                color={colors.textSecondary}
              />
            </Pressable>

            {expandedProposalId === proposal.id ? (
              <View style={styles.requestDetail}>
                <Text style={styles.fieldHint}>
                  {proposal.shopAddress}
                  {proposal.deliveryCity ? ` · ${proposal.deliveryCity}` : ""}
                </Text>
                <Text style={styles.fieldHint}>
                  Credit Reference Check: {proposal.creditVerificationStatus ?? "pending"}
                </Text>
                <Text style={styles.fieldHint}>
                  {proposal.status === "pending"
                    ? "Awaiting manager approval. Demand can be punched now, but no official order or price is committed until approval and review."
                    : `Request ${proposal.status}.`}
                </Text>
                {proposal.status === "pending" && canOrderForRetailers ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.navigate("RepCatalog", {
                        proposalId: proposal.id,
                        retailerName: proposal.businessName,
                      })
                    }
                  >
                    <Text style={styles.orderAction}>Take order (pending approval) →</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {proposal.status === "pending" ? (
              <View style={styles.proposalActions}>
                {canOrderForRetailers ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.navigate("RepCatalog", {
                        proposalId: proposal.id,
                        retailerName: proposal.businessName,
                      })
                    }
                  >
                    <Text style={styles.orderAction}>Punch order</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  disabled={withdrawing === proposal.id}
                  onPress={() => void withdraw(proposal.id)}
                >
                  <Text
                    style={[styles.remove, withdrawing === proposal.id && { opacity: 0.45 }]}
                  >
                    {withdrawing === proposal.id ? "Withdrawing…" : "Withdraw"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {(proposal.orderIntents ?? []).map((intent: any) => (
              <View key={intent.id} style={styles.demandRow}>
                <View style={styles.requestMain}>
                  <Text style={styles.requestName}>
                    Punched demand · {intent.items?.length ?? 0} line
                    {intent.items?.length === 1 ? "" : "s"}
                  </Text>
                  <Text style={styles.fieldHint}>
                    {`Order punched by ${intent.creatorName ?? "Salesperson"}`}
                    {intent.createdAt
                      ? ` · ${new Date(intent.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}`
                      : ""}
                  </Text>
                  <Text style={styles.fieldHint}>
                    {intent.demandState === "waiting_for_retailer_approval"
                      ? "Waiting for retailer approval · unpriced"
                      : intent.demandState === "ready_for_official_order"
                      ? "Retailer approved · review current pricing"
                      : intent.demandState === "converted"
                      ? `Order ${intent.convertedOrder?.orderNo ?? "created"}`
                      : "Unavailable"}
                  </Text>
                </View>
                {intent.demandState === "ready_for_official_order" && canOrderForRetailers ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      navigation.navigate("RepReviewOrder", {
                        intentId: intent.id,
                        retailerId: proposal.retailerId,
                        retailerName: proposal.businessName,
                      })
                    }
                  >
                    <Text style={styles.orderAction}>Review order</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </View>

      {/* Standardized Location Search & Custom Escape Hatch Modal */}
      <Modal
        visible={locationPicker !== null}
        animationType="slide"
        onRequestClose={() => setLocationPicker(null)}
      >
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{locationPicker?.title}</Text>
            <Pressable onPress={() => setLocationPicker(null)}>
              <Text style={styles.orderAction}>Close</Text>
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            <TextInput
              style={styles.input}
              value={locationSearch}
              onChangeText={setLocationSearch}
              placeholder="Search name or type unlisted name..."
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />
          </View>
          <ScrollView contentContainerStyle={styles.modalList}>
            {(() => {
              const q = locationSearch.trim().toLowerCase();
              const filtered = (locationPicker?.options ?? []).filter((o) =>
                q ? o.toLowerCase().includes(q) : true
              );
              const exactMatch = filtered.some((o) => o.toLowerCase() === q);
              return (
                <>
                  {locationPicker?.allowCustom && locationSearch.trim().length >= 2 && !exactMatch ? (
                    <Pressable
                      style={[styles.modalOption, styles.modalCustomOption]}
                      onPress={() => {
                        const field = locationPicker.field;
                        update(field, locationSearch.trim());
                        update("customLocationUsed", true);
                        setLocationPicker(null);
                      }}
                    >
                      <Text style={{ fontWeight: "700", color: colors.warning }}>
                        + Add unlisted town/name: "{locationSearch.trim()}"
                      </Text>
                      <Text style={styles.fieldHint}>
                        Flagged for dispatch verification to prevent duplicates
                      </Text>
                    </Pressable>
                  ) : null}
                  {filtered.map((opt) => (
                    <Pressable
                      key={opt}
                      style={styles.modalOption}
                      onPress={() => {
                        if (!locationPicker) return;
                        const field = locationPicker.field;
                        update(field, opt);
                        if (field === "state") {
                          update("district", "");
                          update("tehsil", "");
                        } else if (field === "district") {
                          update("tehsil", "");
                        }
                        setLocationPicker(null);
                      }}
                    >
                      <Text style={styles.modalOptionText}>{opt}</Text>
                    </Pressable>
                  ))}
                  {filtered.length === 0 && !locationPicker?.allowCustom ? (
                    <Text style={styles.fieldHint}>No matches found.</Text>
                  ) : null}
                </>
              );
            })()}
          </ScrollView>
        </View>
      </Modal>

      {/* Same-City Reference Customer Picker Modal */}
      <Modal
        visible={refPickerIndex !== null}
        animationType="slide"
        onRequestClose={() => setRefPickerIndex(null)}
      >
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Existing Retailers in {form.deliveryCity || "City"}
            </Text>
            <Pressable onPress={() => setRefPickerIndex(null)}>
              <Text style={styles.orderAction}>Close</Text>
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            <TextInput
              style={styles.input}
              value={refSearchQuery}
              onChangeText={(q) => {
                setRefSearchQuery(q);
                if (form.deliveryCity.trim()) {
                  void loadCityRetailers(form.deliveryCity.trim(), q);
                }
              }}
              placeholder="Search retailer name or mobile number..."
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <ScrollView contentContainerStyle={styles.modalList}>
            {cityRetailersLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : null}
            {refPickerResults.map((candidate) => {
              const alreadyChosenElsewhere =
                selectedRefIds.has(candidate.id) &&
                form.references[refPickerIndex ?? -1]?.referencedRetailerId !== candidate.id;
              return (
                <Pressable
                  key={candidate.id}
                  disabled={alreadyChosenElsewhere}
                  style={[styles.modalOption, alreadyChosenElsewhere && { opacity: 0.45 }]}
                  onPress={() => {
                    if (refPickerIndex === null) return;
                    updateReferenceSlot(refPickerIndex, {
                      referencedRetailerId: candidate.id,
                      referencedShopName: candidate.name,
                      referencedPhone: candidate.phone ?? "",
                      referencedCity: candidate.deliveryCity ?? form.deliveryCity,
                      referencedAddress: candidate.shopAddress ?? "",
                      isManualFallback: false,
                    });
                    setRefPickerIndex(null);
                  }}
                >
                  <Text style={styles.modalOptionText}>
                    {candidate.name}
                    {alreadyChosenElsewhere ? " (Already selected)" : ""}
                  </Text>
                  <Text style={styles.fieldHint}>
                    {[candidate.phone, candidate.deliveryCity, candidate.shopAddress]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </Pressable>
              );
            })}
            {!cityRetailersLoading && refPickerResults.length === 0 ? (
              <Text style={styles.fieldHint}>
                No matching DB customers found in "{form.deliveryCity}". If this town has fewer than
                3 customers in the system, close this picker and use the manual market reference
                option.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardSafeScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { gap: spacing.xs },
  kicker: { fontSize: 10, letterSpacing: 1.2, fontWeight: "700", color: colors.textSecondary },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  jumpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  jumpText: { fontSize: 12, fontWeight: "600", color: colors.primary },
  stepper: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepIndex: { fontSize: 11, fontWeight: "700", color: colors.textSecondary },
  stepIndexActive: { color: colors.onDark },
  stepLabel: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  stepLabelActive: { color: colors.onDark },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.errorSoft,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: { flex: 1, fontSize: 13, color: colors.error, fontWeight: "600" },
  section: { gap: spacing.md },
  field: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.ink },
  fieldHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  fieldError: { fontSize: 12, color: colors.error, fontWeight: "600" },
  input: {
    minHeight: control.minTap,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
  },
  multiline: { minHeight: 74, textAlignVertical: "top" },
  inputError: { borderColor: colors.error },
  pickerTrigger: {
    minHeight: control.minTap,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  pickerValue: { flex: 1, fontSize: 14, color: colors.ink, fontWeight: "500" },
  pickerPlaceholder: { flex: 1, fontSize: 14, color: colors.textTertiary },
  customLocBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
  },
  customLocText: { flex: 1, fontSize: 12, color: colors.warning, fontWeight: "600" },
  locationButton: {
    minHeight: control.minTap,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.greenSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  locationText: { fontSize: 14, fontWeight: "600", color: colors.primaryDeep },
  readOnlyBox: {
    minHeight: control.minTap,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  readOnlyText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  choiceTextActive: { color: colors.onDark },
  infoBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.infoSoft,
    borderWidth: 1,
    borderColor: colors.blueSoft,
  },
  infoBoxTitle: { fontSize: 13.5, fontWeight: "700", color: colors.blueInk, marginBottom: 4 },
  infoBoxBody: { fontSize: 12.5, color: colors.ink, lineHeight: 18 },
  refCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  refHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  refTitle: { fontSize: 13, fontWeight: "700", color: colors.ink },
  addRefButton: {
    minHeight: control.minTap,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.infoSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addRefText: { fontSize: 14, fontWeight: "700", color: colors.primary },
  photoRow: { flexDirection: "row", gap: 10 },
  photoBtn: {
    flex: 1,
    minHeight: control.minTap,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoBtnText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  thumb: { width: "100%", height: 140, borderRadius: radius.md, marginTop: 6, resizeMode: "cover" },
  hindiSection: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  hindiHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hindiTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  retranslateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  retranslateText: { fontSize: 12, fontWeight: "600", color: colors.primary },
  reviewBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    gap: 4,
  },
  reviewTitle: { fontSize: 13, fontWeight: "700", color: colors.ink },
  reviewLine: { fontSize: 12.5, color: colors.textSecondary },
  navigation: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  backButton: {
    minHeight: control.buttonHeight,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  nextButton: {
    flex: 1,
    minHeight: control.buttonHeight,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  nextText: { fontSize: 14, fontWeight: "700", color: colors.onDark },
  requestsSection: { gap: spacing.md, marginTop: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  requestCard: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  requestTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  requestIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  requestMain: { flex: 1 },
  requestName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  requestDetail: { gap: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border },
  proposalActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderAction: { fontSize: 13.5, fontWeight: "700", color: colors.primary },
  remove: { fontSize: 13, fontWeight: "600", color: colors.error },
  demandRow: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalScreen: { flex: 1, backgroundColor: colors.bg, paddingTop: 48 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: colors.ink, flex: 1 },
  modalList: { padding: spacing.lg, gap: spacing.xs },
  modalOption: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  modalCustomOption: { borderColor: colors.warning, backgroundColor: colors.warningSoft },
  modalOptionText: { fontSize: 14.5, fontWeight: "600", color: colors.ink },
});
