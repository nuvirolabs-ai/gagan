import { z } from "zod";

export const RETAILER_GRADES = ["A", "B", "C", "D"] as const;
export type RetailerGradeCode = (typeof RETAILER_GRADES)[number];

export const PAYMENT_TERM_OPTIONS = [7, 15, 21, 30, 45] as const;
export type PaymentTermDays = (typeof PAYMENT_TERM_OPTIONS)[number];

export const RETAILER_FORM_FIELDS = [
  { key: "partyName", label: "Party Name", required: true },
  { key: "groupId", label: "Group Name", required: true },
  { key: "contactPerson", label: "Contact Person", required: true },
  { key: "mobile", label: "Mobile", required: true },
  { key: "telephone", label: "Telephone", required: false },
  { key: "transporterId", label: "Transporter", required: true },
  { key: "address1", label: "Address-1", required: true },
  { key: "pin", label: "PIN", required: false },
  { key: "tehsil", label: "Tehsil", required: false },
  { key: "district", label: "District", required: false },
  { key: "state", label: "State", required: false },
  { key: "deliveryCity", label: "Delivery City", required: true },
  { key: "salesmanRepId", label: "Salesman", required: true },
  { key: "beatId", label: "Beat Name", required: false },
  { key: "shopTenureYears", label: "Shop tenure in town", required: true },
  { key: "gstin", label: "GSTIN", required: false },
  { key: "aadhaarNumber", label: "Aadhaar Number", required: true },
  { key: "aadhaarPhotoAssetId", label: "Aadhaar Card Photo", required: true },
  { key: "paymentTermDays", label: "Payment Terms", required: true },
  { key: "creditLimit", label: "Credit Limit", required: false },
  { key: "grade", label: "Grade", required: true },
  { key: "buyerCategoryId", label: "Buyer Category", required: true },
  { key: "buyerSubCategoryId", label: "Buyer Sub Category", required: false },
  { key: "upiId", label: "UPI ID", required: false },
] as const;

export type RetailerFormFieldKey = (typeof RETAILER_FORM_FIELDS)[number]["key"];

function blankToUndefined(value: unknown) {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function digits(value: unknown) {
  if (typeof value !== "string") return value;
  return value.replace(/\D/g, "");
}

export function normalizeRetailerMobile(input: string) {
  let value = input.replace(/\D/g, "");
  if (value.length === 11 && value.startsWith("0")) value = value.slice(1);
  if (value.length === 12 && value.startsWith("91")) value = value.slice(2);
  return value;
}

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

const uuid = z.string().uuid();
const optionalUuid = z.preprocess(blankToUndefined, uuid.optional());

export const retailerFormSchema = z.object({
  partyName: z.string().trim().min(1).max(120),
  groupId: uuid,
  contactPerson: z.string().trim().min(1).max(80),
  mobile: z.preprocess((value) => (typeof value === "string" ? normalizeRetailerMobile(value) : value), z.string().regex(/^[6-9]\d{9}$/, "mobile must be a 10-digit Indian number")),
  telephone: optionalText(15),
  transporterId: uuid,
  address1: z.string().trim().min(1).max(200),
  pin: z.preprocess(blankToUndefined, z.string().regex(/^\d{6}$/, "PIN must be 6 digits").optional()),
  tehsil: optionalText(80),
  district: optionalText(80),
  state: optionalText(80),
  deliveryCity: z.string().trim().min(1).max(80),
  salesmanRepId: uuid,
  beatId: optionalUuid,
  shopTenureYears: z.coerce.number().int().min(0).max(80),
  gstin: z.preprocess(
    (value) => {
      const next = blankToUndefined(value);
      return typeof next === "string" ? next.trim().toUpperCase() : next;
    },
    z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "GSTIN is invalid").optional()
  ),
  aadhaarNumber: z.preprocess(digits, z.string().regex(/^\d{12}$/, "Aadhaar must be 12 digits")),
  aadhaarPhotoAssetId: uuid,
  paymentTermDays: z.coerce.number().int().refine((value): value is PaymentTermDays => (PAYMENT_TERM_OPTIONS as readonly number[]).includes(value), {
    message: "payment terms must be 7, 15, 21, 30 or 45 days",
  }),
  creditLimit: z.coerce.number().min(0).max(10_000_000).default(0),
  grade: z.enum(RETAILER_GRADES),
  buyerCategoryId: uuid,
  buyerSubCategoryId: optionalUuid,
  upiId: z.preprocess(
    blankToUndefined,
    z.string().trim().regex(/^[\w.-]+@[\w.-]+$/, "UPI ID is invalid").optional()
  ),
});

export type RetailerFormValues = z.infer<typeof retailerFormSchema>;

export function parseRetailerForm(input: unknown) {
  return retailerFormSchema.safeParse(input);
}

export function emptyToNull(value: string | undefined | null) {
  if (value == null || value === "") return null;
  return value;
}

/** Maps the 24-field form onto Retailer write columns, including commercial fields. */
export function mapFormToRetailerWrite(form: RetailerFormValues) {
  return {
    name: form.partyName,
    shopAddress: form.address1,
    phone: form.mobile,
    contactPerson: form.contactPerson,
    telephone: emptyToNull(form.telephone),
    groupId: form.groupId,
    transporterId: form.transporterId,
    pin: emptyToNull(form.pin),
    tehsil: emptyToNull(form.tehsil),
    district: emptyToNull(form.district),
    state: emptyToNull(form.state),
    deliveryCity: form.deliveryCity,
    salesRepId: form.salesmanRepId,
    beatId: form.beatId ?? null,
    shopTenureYears: form.shopTenureYears,
    gstin: emptyToNull(form.gstin),
    aadhaarNumber: form.aadhaarNumber,
    aadhaarPhotoAssetId: form.aadhaarPhotoAssetId,
    paymentTermDays: form.paymentTermDays,
    creditLimit: form.creditLimit,
    grade: form.grade,
    buyerCategoryId: form.buyerCategoryId,
    buyerSubCategoryId: form.buyerSubCategoryId ?? null,
    upiId: emptyToNull(form.upiId),
  };
}

export function mapFormToProposalWrite(form: RetailerFormValues) {
  return {
    partyName: form.partyName,
    groupId: form.groupId,
    contactPerson: form.contactPerson,
    mobile: form.mobile,
    telephone: emptyToNull(form.telephone),
    transporterId: form.transporterId,
    address1: form.address1,
    pin: emptyToNull(form.pin),
    tehsil: emptyToNull(form.tehsil),
    district: emptyToNull(form.district),
    state: emptyToNull(form.state),
    deliveryCity: form.deliveryCity,
    salesmanRepId: form.salesmanRepId,
    beatId: form.beatId ?? null,
    shopTenureYears: form.shopTenureYears,
    gstin: emptyToNull(form.gstin),
    aadhaarNumber: form.aadhaarNumber,
    aadhaarPhotoAssetId: form.aadhaarPhotoAssetId,
    paymentTermDays: form.paymentTermDays,
    creditLimit: form.creditLimit,
    grade: form.grade,
    buyerCategoryId: form.buyerCategoryId,
    buyerSubCategoryId: form.buyerSubCategoryId ?? null,
    upiId: emptyToNull(form.upiId),
    payload: form,
  };
}

export function mapRetailerToForm(retailer: {
  name: string;
  shopAddress: string;
  phone: string;
  contactPerson?: string | null;
  telephone?: string | null;
  groupId?: string | null;
  transporterId?: string | null;
  pin?: string | null;
  tehsil?: string | null;
  district?: string | null;
  state?: string | null;
  deliveryCity?: string | null;
  salesRepId?: string | null;
  beatId?: string | null;
  shopTenureYears?: number | null;
  gstin?: string | null;
  aadhaarNumber?: string | null;
  aadhaarPhotoAssetId?: string | null;
  paymentTermDays?: number | null;
  creditLimit?: number | { toString(): string } | null;
  grade?: RetailerGradeCode | null;
  buyerCategoryId?: string | null;
  buyerSubCategoryId?: string | null;
  upiId?: string | null;
}): Partial<RetailerFormValues> {
  return {
    partyName: retailer.name,
    address1: retailer.shopAddress,
    mobile: retailer.phone,
    contactPerson: retailer.contactPerson ?? undefined,
    telephone: retailer.telephone ?? undefined,
    groupId: retailer.groupId ?? undefined,
    transporterId: retailer.transporterId ?? undefined,
    pin: retailer.pin ?? undefined,
    tehsil: retailer.tehsil ?? undefined,
    district: retailer.district ?? undefined,
    state: retailer.state ?? undefined,
    deliveryCity: retailer.deliveryCity ?? undefined,
    salesmanRepId: retailer.salesRepId ?? undefined,
    beatId: retailer.beatId ?? undefined,
    shopTenureYears: retailer.shopTenureYears ?? undefined,
    gstin: retailer.gstin ?? undefined,
    aadhaarNumber: retailer.aadhaarNumber ?? undefined,
    aadhaarPhotoAssetId: retailer.aadhaarPhotoAssetId ?? undefined,
    paymentTermDays: retailer.paymentTermDays as PaymentTermDays | undefined,
    creditLimit: retailer.creditLimit == null ? 0 : Number(retailer.creditLimit),
    grade: retailer.grade ?? undefined,
    buyerCategoryId: retailer.buyerCategoryId ?? undefined,
    buyerSubCategoryId: retailer.buyerSubCategoryId ?? undefined,
    upiId: retailer.upiId ?? undefined,
  };
}

export function publicRetailerProfile(retailer: {
  id: string;
  name: string;
  shopAddress: string;
  phone: string;
  contactPerson?: string | null;
  telephone?: string | null;
  pin?: string | null;
  tehsil?: string | null;
  district?: string | null;
  state?: string | null;
  deliveryCity?: string | null;
  shopTenureYears?: number | null;
  gstin?: string | null;
  aadhaarNumber?: string | null;
  aadhaarPhotoAssetId?: string | null;
  paymentTermDays?: number | null;
  creditLimit?: { toString(): string } | number;
  grade?: RetailerGradeCode | null;
  upiId?: string | null;
  group?: { id: string; name: string } | null;
  transporter?: { id: string; name: string } | null;
  beat?: { id: string; name: string } | null;
  buyerCategory?: { id: string; name: string } | null;
  buyerSubCategory?: { id: string; name: string } | null;
  salesRep?: { id: string; name: string } | null;
  groupId?: string | null;
  transporterId?: string | null;
  beatId?: string | null;
  buyerCategoryId?: string | null;
  buyerSubCategoryId?: string | null;
  salesRepId?: string | null;
}) {
  return {
    id: retailer.id,
    name: retailer.name,
    partyName: retailer.name,
    shopAddress: retailer.shopAddress,
    address1: retailer.shopAddress,
    phone: retailer.phone,
    mobile: retailer.phone,
    contactPerson: retailer.contactPerson ?? null,
    telephone: retailer.telephone ?? null,
    pin: retailer.pin ?? null,
    tehsil: retailer.tehsil ?? null,
    district: retailer.district ?? null,
    state: retailer.state ?? null,
    deliveryCity: retailer.deliveryCity ?? null,
    shopTenureYears: retailer.shopTenureYears ?? null,
    gstin: retailer.gstin ?? null,
    aadhaarNumber: retailer.aadhaarNumber ?? null,
    aadhaarPhotoAssetId: retailer.aadhaarPhotoAssetId ?? null,
    paymentTermDays: retailer.paymentTermDays ?? null,
    creditLimit: Number(retailer.creditLimit ?? 0),
    grade: retailer.grade ?? null,
    upiId: retailer.upiId ?? null,
    groupId: retailer.group?.id ?? retailer.groupId ?? null,
    groupName: retailer.group?.name ?? null,
    transporterId: retailer.transporter?.id ?? retailer.transporterId ?? null,
    transporterName: retailer.transporter?.name ?? null,
    beatId: retailer.beat?.id ?? retailer.beatId ?? null,
    beatName: retailer.beat?.name ?? null,
    buyerCategoryId: retailer.buyerCategory?.id ?? retailer.buyerCategoryId ?? null,
    buyerCategoryName: retailer.buyerCategory?.name ?? null,
    buyerSubCategoryId: retailer.buyerSubCategory?.id ?? retailer.buyerSubCategoryId ?? null,
    buyerSubCategoryName: retailer.buyerSubCategory?.name ?? null,
    salesmanRepId: retailer.salesRep?.id ?? retailer.salesRepId ?? null,
    salesmanName: retailer.salesRep?.name ?? null,
  };
}
