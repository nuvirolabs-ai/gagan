import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { getObjectStorage } from "../../platform/storage/storageRuntime";
import type { ObjectStorage } from "../../platform/storage/objectStorage";
import { EvidencePurpose } from "@prisma/client";
import { isWithinScope } from "../field/fieldDomain";
import { normalizeIndianPhone } from "../identity/otpService";
import { encryptPii, maskAadhaar } from "../../platform/security/pii";
import { CommercialStatusCode } from "@prisma/client";
import { recordCommercialStatusEvent } from "../commercialStatus/statusService";
import { createOrderForRetailer, type OrderLineInput } from "../../lib/orders";
import { catalogueImageState, catalogueOrderingState } from "../catalog/catalogueVisibility";
import { quoteFor } from "../commercial/service";
import {
  BUYER_CATEGORIES,
  BUYER_SUB_CATEGORIES,
  PAYMENT_TERMS_OPTIONS,
  RETAILER_GRADES,
  type RetailerReferenceInput,
} from "./retailerOptions";
import {
  buildLocationDirectory,
  buildSameCityRetailerWhere,
  cityMatchVariants,
  lookupPinCode,
  normalizeCityName,
  standardizeProposalLocation,
} from "./locationDirectory";
import {
  buildBilingualHindiFields,
  deterministicEnglishToHindi,
} from "./hindiTranslator";

type Db = PrismaClient | any;

export class ProposalError extends Error {
  constructor(readonly code: string, readonly status = 409, readonly details?: unknown) {
    super(code);
    this.name = "ProposalError";
  }
}

/** The state predicate is evaluated by PostgreSQL after any competing writer
 * commits. An earlier read of pending is not authority to overwrite a decision. */
async function decidePending(tx: Db, id: string, data: Record<string, unknown>) {
  try {
    return await tx.retailerProposal.update({ where: { id, status: "pending" }, data });
  } catch (error: any) {
    if (error?.code === "P2025") throw new ProposalError("proposal_already_decided", 409);
    throw error;
  }
}

export interface SubmitProposalInput {
  submittedByStaffId: string;
  businessName: string;
  groupName: string;
  ownerName: string;
  phone: string;
  telephone?: string;
  transporter: string;
  broker?: string;
  shopAddress: string;
  addressLine2?: string;
  beatName?: string;
  pinCode: string;
  tehsil: string;
  district: string;
  state: string;
  deliveryCity: string;
  shopDurationYears: number;
  gstin?: string;
  aadhaarNumber: string;
  aadhaarPhoto: {
    contentType: string;
    bodyBase64: string;
    checksum?: string;
  };
  aadhaarPhotoBack?: {
    contentType: string;
    bodyBase64: string;
    checksum?: string;
  };
  paymentTerms: string;
  proposedCreditLimit?: number;
  grade: string;
  buyerCategory: string;
  buyerSubCategory?: string;
  remark?: string;
  upiId?: string;
  businessNameHi?: string;
  transporterHi?: string;
  shopAddressHi?: string;
  addressLine2Hi?: string;
  beatNameHi?: string;
  deliveryCityHi?: string;
  tehsilHi?: string;
  districtHi?: string;
  stateHi?: string;
  customLocationUsed?: boolean;
  references: RetailerReferenceInput[];
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  proposedTierId?: string;
  notes?: string;
}

function clean(value: string | undefined) {
  return value?.trim() || null;
}

function validateAadhaar(value: string) {
  const normalized = value.replace(/[\s-]/g, "");
  if (!/^\d{12}$/.test(normalized)) throw new ProposalError("aadhaar_invalid", 400);
  return normalized;
}

const INDIAN_PIN_RE = /^\d{6}$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const UPI_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,255}@[A-Za-z][A-Za-z0-9.-]{1,63}$/;

function optionalValue(value: string | undefined, pattern: RegExp, code: string) {
  const normalized = clean(value);
  if (normalized && !pattern.test(normalized)) throw new ProposalError(code, 400);
  return normalized;
}

function normalizeProposalDemand(items: OrderLineInput[] | Array<{ variantId: string; qty: number }>) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (!item || typeof item.variantId !== "string" || !item.variantId.trim()
      || !Number.isSafeInteger(item.qty) || item.qty <= 0) return null;
    const qty = (quantities.get(item.variantId) ?? 0) + item.qty;
    if (qty > 2_147_483_647) return null;
    quantities.set(item.variantId, qty);
  }
  return [...quantities].sort(([a], [b]) => a.localeCompare(b)).map(([variantId, qty]) => ({ variantId, qty }));
}

function sameProposalDemand(existing: Array<{ variantId: string; qty: number }>, expected: OrderLineInput[]) {
  const normalizedExisting = normalizeProposalDemand(existing);
  return normalizedExisting !== null && JSON.stringify(normalizedExisting) === JSON.stringify(expected);
}

function decodePhoto(bodyBase64: string) {
  const body = Buffer.from(bodyBase64, "base64");
  if (!body.length) throw new ProposalError("aadhaar_photo_required", 400);
  return body;
}

function publicProposal(proposal: any, photoUrl?: string | null, photoBackUrl?: string | null, backAsset?: any) {
  const {
    aadhaarEncrypted: _encrypted,
    aadhaarLast4,
    aadhaarPhotoAsset,
    aadhaarPhotoAssetId: _photoAssetId,
    notes,
    hindiSnapshot,
    ...safe
  } = proposal;
  const cleanNotes = notes ? notes.replace(/\s*\[AADHAAR_BACK_ASSET_ID:[a-zA-Z0-9_-]+\]/, "").trim() || null : null;
  const rawSnap = (hindiSnapshot && typeof hindiSnapshot === "object" ? hindiSnapshot : {}) as Record<string, string | null>;
  const computedHindi = {
    businessNameHi: proposal.businessNameHi || deterministicEnglishToHindi(proposal.businessName) || null,
    transporterHi: proposal.transporterHi || deterministicEnglishToHindi(proposal.transporter) || null,
    shopAddressHi: proposal.shopAddressHi || deterministicEnglishToHindi(proposal.shopAddress) || null,
    addressLine2Hi: proposal.addressLine2Hi || deterministicEnglishToHindi(proposal.addressLine2) || null,
    beatNameHi: proposal.beatNameHi || deterministicEnglishToHindi(proposal.beatName) || null,
    deliveryCityHi: proposal.deliveryCityHi || deterministicEnglishToHindi(proposal.deliveryCity) || null,
    tehsilHi: proposal.tehsilHi || deterministicEnglishToHindi(proposal.tehsil) || null,
    districtHi: proposal.districtHi || deterministicEnglishToHindi(proposal.district) || null,
    stateHi: proposal.stateHi || deterministicEnglishToHindi(proposal.state) || null,
  };
  const resolvedHindiSnapshot = {
    groupNameHi: rawSnap.groupNameHi || deterministicEnglishToHindi(proposal.groupName) || null,
    ownerNameHi: rawSnap.ownerNameHi || deterministicEnglishToHindi(proposal.ownerName) || null,
    brokerHi: rawSnap.brokerHi || deterministicEnglishToHindi(proposal.broker) || null,
    paymentTermsHi: rawSnap.paymentTermsHi || deterministicEnglishToHindi(proposal.paymentTerms) || null,
    gradeHi: rawSnap.gradeHi || proposal.grade || null,
    buyerCategoryHi: rawSnap.buyerCategoryHi || deterministicEnglishToHindi(proposal.buyerCategory) || null,
    buyerSubCategoryHi: rawSnap.buyerSubCategoryHi || deterministicEnglishToHindi(proposal.buyerSubCategory) || null,
    remarkHi: rawSnap.remarkHi || deterministicEnglishToHindi(proposal.remark ?? cleanNotes) || null,
    salesmanNameHi: rawSnap.salesmanNameHi || deterministicEnglishToHindi(proposal.submittedBy?.name) || null,
  };
  return {
    ...safe,
    ...computedHindi,
    hindiSnapshot: resolvedHindiSnapshot,
    remark: proposal.remark ?? cleanNotes,
    proposedCreditLimit: proposal.proposedCreditLimit != null ? Number(proposal.proposedCreditLimit) : null,
    notes: cleanNotes,
    aadhaarNumberMasked: maskAadhaar(aadhaarLast4),
    aadhaarPhoto: aadhaarPhotoAsset
      ? {
          available: !aadhaarPhotoAsset.deletedAt && (photoUrl === undefined ? true : Boolean(photoUrl)),
          contentType: aadhaarPhotoAsset.contentType,
          sizeBytes: aadhaarPhotoAsset.sizeBytes,
          ...(photoUrl ? { signedUrl: photoUrl } : {}),
        }
      : null,
    aadhaarPhotoBack: photoBackUrl
      ? {
          available: true,
          ...(backAsset ? { contentType: backAsset.contentType, sizeBytes: backAsset.sizeBytes } : {}),
          signedUrl: photoBackUrl,
        }
      : backAsset && !backAsset.deletedAt
        ? {
            available: false,
            contentType: backAsset.contentType,
            sizeBytes: backAsset.sizeBytes,
          }
        : null,
  };
}

function attributedOrderIntent(proposal: any, intent: any) {
  return {
    ...intent,
    source: "SALESPERSON_APP",
    creatorName: intent.submittedBy?.name ?? null,
    retailer: { id: proposal.retailerId ?? null, name: proposal.businessName },
    createdAt: intent.punchedAt,
  };
}

/**
 * Adding a store to the customer master, proposed from the field.
 *
 * There is no second customer model: a proposal is a governance record that,
 * once approved, creates exactly one canonical `Retailer` and points at it. A
 * salesperson can put a store forward; only a reviewer can admit it, and the
 * store still enters the lifecycle at `pending_kyc` so approval never
 * shortcuts the KYC gate that dispatch and credit depend on.
 */
export class RetailerProposalService {
  private pendingBackfillPromise: Promise<Array<{
    proposalId: string;
    retailerId: string;
    count: number;
    orderIds: string[];
  }>> | null = null;

  constructor(
    private readonly prisma: Db = defaultPrisma,
    private readonly storage?: ObjectStorage,
    private readonly createOfficialOrder: typeof createOrderForRetailer = createOrderForRetailer,
    private readonly createCommercialQuote: typeof quoteFor = quoteFor,
  ) {}

  private objectStorage() {
    return this.storage ?? getObjectStorage();
  }

  async getFormMetadata() {
    return {
      grades: [...RETAILER_GRADES],
      buyerCategories: [...BUYER_CATEGORIES],
      buyerSubCategories: [...BUYER_SUB_CATEGORIES],
      paymentTermsOptions: [...PAYMENT_TERMS_OPTIONS],
      locations: await buildLocationDirectory(this.prisma),
    };
  }

  async lookupPin(pinCode: string) {
    return lookupPinCode(pinCode);
  }

  async translateHindiPreview(input: Parameters<typeof buildBilingualHindiFields>[0]) {
    return buildBilingualHindiFields(input);
  }

  async listSameCityRetailers(input: { city: string; query?: string }) {
    const cleanCity = normalizeCityName(input.city);
    if (!cleanCity || cleanCity.length < 2 || !this.prisma.retailer?.findMany) {
      return { city: cleanCity, retailers: [], cityRetailerCount: 0 };
    }
    const cityWhere = buildSameCityRetailerWhere(cleanCity);
    const q = input.query?.trim();
    const searchWhere = q
      ? {
          AND: [
            cityWhere,
            {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { ownerName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { shopAddress: { contains: q, mode: "insensitive" } },
              ],
            },
          ],
        }
      : cityWhere;

    const [retailers, cityRetailerCount] = await Promise.all([
      this.prisma.retailer.findMany({
        where: searchWhere,
        select: {
          id: true,
          name: true,
          ownerName: true,
          phone: true,
          shopAddress: true,
          deliveryCity: true,
          tehsil: true,
          status: true,
        },
        orderBy: { name: "asc" },
        take: 60,
      }),
      this.prisma.retailer.count ? this.prisma.retailer.count({ where: cityWhere }) : Promise.resolve(0),
    ]);

    return { city: cleanCity, retailers, cityRetailerCount };
  }

  private retailerMatchesCity(retailer: { deliveryCity?: string | null; tehsil?: string | null; shopAddress?: string | null; name?: string | null }, targetCity: string) {
    const tokens = cityMatchVariants(targetCity).map((v) => v.toLowerCase());
    const fields = [retailer.deliveryCity, retailer.tehsil, retailer.shopAddress, retailer.name]
      .filter(Boolean)
      .map((f) => String(f).toLowerCase());
    if (retailer.deliveryCity) {
      return tokens.some((tok) => normalizeCityName(retailer.deliveryCity!).toLowerCase() === normalizeCityName(tok).toLowerCase());
    }
    return tokens.some((tok) => fields.some((field) => field.includes(tok)));
  }

  async submit(input: SubmitProposalInput) {
    const businessName = input.businessName.trim();
    const groupName = input.groupName.trim();
    const ownerName = input.ownerName.trim();
    const shopAddress = input.shopAddress.trim();
    if (businessName.length < 2) throw new ProposalError("business_name_required", 400);
    if (groupName.length < 2) throw new ProposalError("group_name_required", 400);
    if (ownerName.length < 2) throw new ProposalError("contact_person_required", 400);
    if (shopAddress.length < 4) throw new ProposalError("shop_address_required", 400);
    if (!input.transporter.trim()) throw new ProposalError("transporter_required", 400);
    if (!input.deliveryCity.trim()) throw new ProposalError("delivery_city_required", 400);
    if (!Number.isInteger(input.shopDurationYears) || input.shopDurationYears < 0 || input.shopDurationYears > 200) {
      throw new ProposalError("shop_duration_invalid", 400);
    }
    if (!input.paymentTerms.trim()) throw new ProposalError("payment_terms_required", 400);
    const pinCode = clean(input.pinCode);
    if (!pinCode || !INDIAN_PIN_RE.test(pinCode)) throw new ProposalError("pin_code_invalid", 400);
    const rawTehsil = clean(input.tehsil);
    const rawDistrict = clean(input.district);
    const rawState = clean(input.state);
    if (!rawTehsil || rawTehsil.length < 2) throw new ProposalError("tehsil_required", 400);
    if (!rawDistrict || rawDistrict.length < 2) throw new ProposalError("district_required", 400);
    if (!rawState || rawState.length < 2) throw new ProposalError("state_required", 400);

    const grade = clean(input.grade);
    const buyerCategory = clean(input.buyerCategory);
    if (!grade) throw new ProposalError("grade_required", 400);
    if (!buyerCategory) throw new ProposalError("buyer_category_required", 400);

    if (
      input.proposedCreditLimit !== undefined &&
      (!Number.isFinite(input.proposedCreditLimit) || input.proposedCreditLimit < 0)
    ) {
      throw new ProposalError("credit_limit_invalid", 400);
    }

    const gstin = clean(input.gstin)?.toUpperCase() ?? null;
    if (gstin && !GSTIN_RE.test(gstin)) throw new ProposalError("gstin_invalid", 400);
    const upiId = optionalValue(input.upiId, UPI_ID_RE, "upi_id_invalid");
    const aadhaar = validateAadhaar(input.aadhaarNumber);
    if (!input.aadhaarPhoto?.contentType?.startsWith("image/")) {
      throw new ProposalError("aadhaar_photo_required", 400);
    }
    if (!input.aadhaarPhotoBack?.contentType?.startsWith("image/")) {
      throw new ProposalError("aadhaar_photo_back_required", 400);
    }

    const standardizedLocation = standardizeProposalLocation({
      state: rawState,
      district: rawDistrict,
      tehsil: rawTehsil,
      deliveryCity: input.deliveryCity,
      customLocationUsed: input.customLocationUsed,
    });

    // `normalizeIndianPhone` validates and returns the +91 form; the customer
    // master stores the bare national number, so the proposal is kept in the
    // shape the Retailer row will actually use.
    let phone: string;
    let internationalPhone: string;
    try {
      internationalPhone = normalizeIndianPhone(input.phone);
      phone = internationalPhone.replace(/^\+91/, "");
    } catch {
      throw new ProposalError("phone_invalid", 400);
    }

    const rawRefs = Array.isArray(input.references) ? input.references : [];
    if (rawRefs.length < 3) {
      throw new ProposalError("references_minimum_three", 400);
    }

    const staff = await this.prisma.staffUser.findUnique({
      where: { id: input.submittedByStaffId },
      select: { name: true, status: true, salesRepId: true },
    });
    if (!staff || staff.status !== "active" || !staff.salesRepId) {
      throw new ProposalError("salesperson_not_available", 403);
    }

    // Validate 3+ unique same-city retailer references
    const seenRefIds = new Set<string>();
    const seenRefNames = new Set<string>();
    const linkedIds = rawRefs.map((r) => clean(r.existingRetailerId ?? undefined)).filter(Boolean) as string[];
    let linkedRetailersById = new Map<string, any>();
    let sameCityDbCount = 0;
    if (this.prisma.retailer?.findMany) {
      const cityWhere = buildSameCityRetailerWhere(standardizedLocation.deliveryCity);
      const [foundLinked, dbCityCount] = await Promise.all([
        linkedIds.length > 0
          ? this.prisma.retailer.findMany({
              where: { id: { in: linkedIds } },
              select: { id: true, name: true, ownerName: true, phone: true, shopAddress: true, deliveryCity: true, tehsil: true },
            })
          : Promise.resolve([]),
        this.prisma.retailer.count ? this.prisma.retailer.count({ where: cityWhere }) : Promise.resolve(0),
      ]);
      linkedRetailersById = new Map(foundLinked.map((r: any) => [r.id, r]));
      sameCityDbCount = dbCityCount;
    }

    const preparedRefs: Array<{
      existingRetailerId: string | null;
      retailerName: string;
      ownerName: string | null;
      phone: string | null;
      shopAddress: string | null;
      city: string;
      isExistingCustomer: boolean;
      notes: string | null;
    }> = [];

    for (const ref of rawRefs) {
      const existingId = clean(ref.existingRetailerId ?? undefined);
      if (existingId) {
        if (seenRefIds.has(existingId)) throw new ProposalError("reference_duplicate", 400);
        seenRefIds.add(existingId);
        const dbRet = linkedRetailersById.get(existingId);
        if (this.prisma.retailer?.findMany && !dbRet) {
          throw new ProposalError("reference_retailer_not_found", 400);
        }
        if (dbRet) {
          if (!this.retailerMatchesCity(dbRet, standardizedLocation.deliveryCity)) {
            throw new ProposalError("reference_city_mismatch", 400, { retailerName: dbRet.name });
          }
          const refPhone = String(dbRet.phone ?? "").replace(/^\+91/, "");
          if (refPhone && refPhone === phone) {
            throw new ProposalError("reference_self_not_allowed", 400);
          }
          preparedRefs.push({
            existingRetailerId: dbRet.id,
            retailerName: dbRet.name,
            ownerName: dbRet.ownerName ?? clean(ref.ownerName ?? undefined),
            phone: dbRet.phone ?? clean(ref.phone ?? undefined),
            shopAddress: dbRet.shopAddress ?? clean(ref.shopAddress ?? undefined),
            city: standardizedLocation.deliveryCity,
            isExistingCustomer: true,
            notes: clean(ref.notes ?? undefined),
          });
          continue;
        }
      }

      const refName = ref.retailerName?.trim() ?? "";
      if (refName.length < 2) throw new ProposalError("reference_name_required", 400);
      const refCity = normalizeCityName(ref.city || standardizedLocation.deliveryCity);
      if (refCity.toLowerCase() !== standardizedLocation.deliveryCity.toLowerCase()) {
        throw new ProposalError("reference_city_mismatch", 400, { retailerName: refName });
      }
      let refPhone: string | null = null;
      if (ref.phone?.trim()) {
        try {
          refPhone = normalizeIndianPhone(ref.phone).replace(/^\+91/, "");
        } catch {
          throw new ProposalError("reference_phone_invalid", 400, { retailerName: refName });
        }
        if (refPhone === phone) throw new ProposalError("reference_self_not_allowed", 400);
      } else {
        throw new ProposalError("reference_phone_invalid", 400, { retailerName: refName });
      }
      const dedupeKey = `${refName.toLowerCase()}::${refPhone ?? ""}`;
      if (seenRefNames.has(dedupeKey)) throw new ProposalError("reference_duplicate", 400);
      seenRefNames.add(dedupeKey);

      preparedRefs.push({
        existingRetailerId: existingId ?? null,
        retailerName: refName,
        ownerName: clean(ref.ownerName ?? undefined),
        phone: refPhone,
        shopAddress: clean(ref.shopAddress ?? undefined),
        city: standardizedLocation.deliveryCity,
        isExistingCustomer: false,
        notes: clean(ref.notes ?? undefined),
      });
    }

    if (sameCityDbCount >= 3 && preparedRefs.filter((r) => r.isExistingCustomer).length < 3) {
      throw new ProposalError("references_must_be_existing_city_retailers", 400, {
        city: standardizedLocation.deliveryCity,
        availableCount: sameCityDbCount,
      });
    }

    // The customer master keys on phone, so a store already on it cannot be
    // proposed again — the salesperson is told to ask for the assignment
    // instead of creating a duplicate customer.
    const [existingRetailer, existingProposal] = await Promise.all([
      this.prisma.retailer.findFirst({
        where: { phone: { in: [phone, internationalPhone, `91${phone}`] } },
        select: { id: true, name: true },
      }),
      this.prisma.retailerProposal.findFirst({
        where: { phone, status: "pending" },
        select: { id: true },
      }),
    ]);
    if (existingRetailer) {
      throw new ProposalError("retailer_already_exists", 409, { retailerName: existingRetailer.name });
    }
    if (existingProposal) throw new ProposalError("proposal_already_pending", 409);

    const bilingualHindi = await buildBilingualHindiFields({
      businessName,
      groupName,
      ownerName,
      transporter: input.transporter,
      broker: input.broker,
      shopAddress,
      addressLine2: input.addressLine2,
      beatName: input.beatName,
      deliveryCity: standardizedLocation.deliveryCity,
      tehsil: standardizedLocation.tehsil,
      district: standardizedLocation.district,
      state: standardizedLocation.state,
      paymentTerms: input.paymentTerms,
      grade,
      buyerCategory,
      buyerSubCategory: input.buyerSubCategory,
      remark: input.remark ?? input.notes,
      salesmanName: staff.name ?? null,
      businessNameHi: input.businessNameHi,
      transporterHi: input.transporterHi,
      shopAddressHi: input.shopAddressHi,
      addressLine2Hi: input.addressLine2Hi,
      beatNameHi: input.beatNameHi,
      deliveryCityHi: input.deliveryCityHi,
      tehsilHi: input.tehsilHi,
      districtHi: input.districtHi,
      stateHi: input.stateHi,
    });
    if (
      !bilingualHindi.businessNameHi ||
      !bilingualHindi.transporterHi ||
      !bilingualHindi.shopAddressHi ||
      !bilingualHindi.deliveryCityHi
    ) {
      throw new ProposalError("hindi_fields_required", 400);
    }

    const storage = this.objectStorage();
    const frontPhotoBody = decodePhoto(input.aadhaarPhoto.bodyBase64);
    const stored = await storage.put({
      purpose: EvidencePurpose.retailer_proposal_aadhaar,
      contentType: input.aadhaarPhoto.contentType,
      body: frontPhotoBody,
      checksum: input.aadhaarPhoto.checksum,
    });
    const backPhotoBody = decodePhoto(input.aadhaarPhotoBack.bodyBase64);
    const storedBack = await storage.put({
      purpose: EvidencePurpose.retailer_proposal_aadhaar,
      contentType: input.aadhaarPhotoBack.contentType,
      body: backPhotoBody,
      checksum: input.aadhaarPhotoBack.checksum,
    });
    try {
      const proposal = await this.prisma.$transaction(async (tx: Db) => {
        const asset = await tx.evidenceAsset.create({
          data: {
            objectKey: stored.objectKey,
            checksum: stored.checksum,
            contentType: stored.contentType,
            sizeBytes: stored.sizeBytes,
            contentBytes: frontPhotoBody,
            purpose: EvidencePurpose.retailer_proposal_aadhaar,
            createdByStaffId: input.submittedByStaffId,
          },
        });
        const assetBack = await tx.evidenceAsset.create({
          data: {
            objectKey: storedBack.objectKey,
            checksum: storedBack.checksum,
            contentType: storedBack.contentType,
            sizeBytes: storedBack.sizeBytes,
            contentBytes: backPhotoBody,
            purpose: EvidencePurpose.retailer_proposal_aadhaar,
            createdByStaffId: input.submittedByStaffId,
          },
        });
        const remarkText = clean(input.remark ?? input.notes);
        const created = await tx.retailerProposal.create({
          data: {
            businessName,
            groupName,
            ownerName,
            phone,
            telephone: clean(input.telephone),
            transporter: input.transporter.trim(),
            broker: clean(input.broker),
            shopAddress,
            addressLine2: clean(input.addressLine2),
            beatName: clean(input.beatName),
            pinCode,
            tehsil: standardizedLocation.tehsil,
            district: standardizedLocation.district,
            state: standardizedLocation.state,
            deliveryCity: standardizedLocation.deliveryCity,
            locationStandardized: standardizedLocation.locationStandardized,
            locationNeedsReview: standardizedLocation.locationNeedsReview,
            shopDurationYears: input.shopDurationYears,
            gstin,
            aadhaarEncrypted: encryptPii(aadhaar),
            aadhaarLast4: aadhaar.slice(-4),
            aadhaarPhotoAssetId: asset.id,
            paymentTerms: input.paymentTerms.trim(),
            proposedCreditLimit: input.proposedCreditLimit ?? null,
            grade,
            buyerCategory,
            buyerSubCategory: clean(input.buyerSubCategory),
            remark: remarkText,
            upiId,
            businessNameHi: bilingualHindi.businessNameHi,
            transporterHi: bilingualHindi.transporterHi,
            shopAddressHi: bilingualHindi.shopAddressHi,
            addressLine2Hi: bilingualHindi.addressLine2Hi,
            beatNameHi: bilingualHindi.beatNameHi,
            deliveryCityHi: bilingualHindi.deliveryCityHi,
            tehsilHi: bilingualHindi.tehsilHi,
            districtHi: bilingualHindi.districtHi,
            stateHi: bilingualHindi.stateHi,
            hindiSnapshot: bilingualHindi.hindiSnapshot,
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            accuracyMeters: input.accuracyMeters ?? null,
            proposedTierId: input.proposedTierId ?? null,
            notes: `${remarkText || ""}\n[AADHAAR_BACK_ASSET_ID:${assetBack.id}]`.trim(),
            submittedByStaffId: input.submittedByStaffId,
          },
        });
        if (tx.retailerProposalReference?.createMany) {
          await tx.retailerProposalReference.createMany({
            data: preparedRefs.map((ref) => ({
              proposalId: created.id,
              ...ref,
            })),
          });
        }
        return { ...created, references: preparedRefs };
      });
      return publicProposal(proposal);
    } catch (error) {
      await storage.delete(stored.objectKey).catch(() => undefined);
      await storage.delete(storedBack.objectKey).catch(() => undefined);
      throw error;
    }
  }

  async listForSalesperson(salespersonId: string) {
    const proposals = await this.prisma.retailerProposal.findMany({
      where: { submittedByStaffId: salespersonId },
      include: {
        proposedTier: { select: { id: true, name: true } },
        creditVerifiedBy: { select: { id: true, name: true } },
        references: {
          orderBy: { createdAt: "asc" },
          include: {
            existingRetailer: { select: { id: true, name: true, phone: true, shopAddress: true, deliveryCity: true, status: true } },
          },
        },
        aadhaarPhotoAsset: {
          select: { id: true, objectKey: true, contentType: true, sizeBytes: true, deletedAt: true },
        },
        orderIntents: {
          orderBy: { punchedAt: "desc" },
          include: {
            items: { select: { variantId: true, qty: true, productName: true, unitSize: true, unitsPerCase: true } },
            convertedOrder: { select: { id: true, orderNo: true, status: true } },
            submittedBy: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: 100,
    });
    return proposals.map((proposal: any) => ({
      ...publicProposal(proposal),
      orderIntents: (proposal.orderIntents ?? []).map((intent: any) => ({
        ...attributedOrderIntent(proposal, intent),
        demandState: proposal.status === "pending"
          ? "waiting_for_retailer_approval"
          : proposal.status === "approved"
            ? intent.convertedOrderId ? "converted" : "ready_for_official_order"
            : "not_available",
      })),
    }));
  }

  async proposalDemandCatalog(input: { proposalId: string; salespersonId: string }) {
    const proposal = await this.prisma.retailerProposal.findUnique({
      where: { id: input.proposalId },
      select: { id: true, status: true, submittedByStaffId: true },
    });
    if (!proposal || proposal.submittedByStaffId !== input.salespersonId) {
      throw new ProposalError("proposal_not_found", 404);
    }
    if (proposal.status !== "pending") throw new ProposalError("proposal_not_pending", 409);

    const [products, prices, referenceTier] = await Promise.all([this.prisma.product.findMany({
      where: { catalogStatus: "active", variants: { some: { catalogStatus: "active" } } },
      include: { variants: { where: { catalogStatus: "active" } } },
      orderBy: { createdAt: "asc" },
    }), this.prisma.priceList.findMany({ select: { variantId: true, tierId: true, price: true, rateBasis: true } }),
      this.prisma.tier.findUnique({ where: { name: "Silver" }, select: { id: true, name: true } })
    ]) as [any[], Array<{ variantId: string; tierId: string; price: number; rateBasis: string }>, { id: string; name: string } | null];
    return {
      catalog: products.map((product: any) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        imageUrl: product.imageUrl,
        description: product.description,
        sapMaterialId: product.sapMaterialId,
        variants: product.variants.map((variant: any) => {
          const caseWeightKg = Number(variant.unitWeightKg) * variant.unitsPerCase;
          const variantPrices = prices.filter((price) => price.variantId === variant.id);
          const casePrice = (price: typeof variantPrices[number]) => price.rateBasis === "quintal"
            ? Math.round(Number(price.price) * caseWeightKg) / 100 : Number(price.price);
          const casePrices = variantPrices.map(casePrice);
          const referencePrice = variantPrices.find((price) => price.tierId === referenceTier?.id);
          return ({
          id: variant.id,
          imageUrl: variant.imageUrl ?? product.imageUrl,
          unitSize: variant.unitSize,
          unit: variant.unit,
          unitsPerCase: variant.unitsPerCase,
          caseWeightKg,
          price: null,
          indicativePrice: referencePrice ? casePrice(referencePrice) : null,
          indicativeTierName: referencePrice ? referenceTier?.name : null,
          indicativePriceRange: casePrices.length ? { minCase: Math.min(...casePrices), maxCase: Math.max(...casePrices) } : null,
          ...catalogueImageState(variant),
          ...catalogueOrderingState(variant.catalogStatus, variant.gstPercent?.toString() ?? null, variant.gstPendingOrderAllowed),
        }); }),
      })),
      categories: [...new Set(products.map((product: any) => product.category))].sort(),
    };
  }

  async punchOrderIntent(input: {
    proposalId: string;
    salespersonId: string;
    idempotencyKey: string;
    items: OrderLineInput[];
  }) {
    const items = normalizeProposalDemand(input.items);
    if (!items) throw new ProposalError("invalid_order_items", 400);
    const proposal = await this.prisma.retailerProposal.findUnique({
      where: { id: input.proposalId },
      select: { id: true, status: true, submittedByStaffId: true },
    });
    if (!proposal || proposal.submittedByStaffId !== input.salespersonId) {
      throw new ProposalError("proposal_not_found", 404);
    }

    const intentWhere = { proposalId_idempotencyKey: { proposalId: input.proposalId, idempotencyKey: input.idempotencyKey } };
    const replay = await this.prisma.retailerProposalOrderIntent.findUnique({
      where: intentWhere,
      include: { items: true },
    });
    if (replay) return sameProposalDemand(replay.items, items)
      ? replay
      : (() => { throw new ProposalError("idempotency_key_conflict", 409); })();
    if (proposal.status !== "pending") throw new ProposalError("proposal_not_pending", 409);

    const variants = await this.prisma.variant.findMany({
      where: {
        id: { in: items.map((item) => item.variantId) },
        catalogStatus: "active",
        product: { catalogStatus: "active" },
      },
      select: {
        id: true,
        unitSize: true,
        unitsPerCase: true,
        product: { select: { name: true } },
      },
    });
    if (variants.length !== items.length) throw new ProposalError("catalog_item_not_orderable", 409);
    const variantById = new Map(variants.map((variant: any) => [variant.id, variant]));
    const lineSnapshots = items.map((item) => {
      const variant: any = variantById.get(item.variantId);
      return {
        ...item,
        productName: variant.product.name,
        unitSize: variant.unitSize,
        unitsPerCase: variant.unitsPerCase,
      };
    });

    try {
      return await this.prisma.$transaction(async (tx: Db) => {
        const eligible = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "RetailerProposal"
          WHERE "id" = ${input.proposalId}
            AND "submittedByStaffId" = ${input.salespersonId}
            AND "status" = 'pending'
          FOR UPDATE
        `;
        if (eligible.length !== 1) throw new ProposalError("proposal_not_pending", 409);
        const created = await tx.retailerProposalOrderIntent.create({
          data: {
            proposalId: input.proposalId,
            submittedByStaffId: input.salespersonId,
            idempotencyKey: input.idempotencyKey,
            items: { create: lineSnapshots },
          },
          include: { items: true },
        });
        await tx.auditEvent.create({
          data: {
            actorStaffId: input.salespersonId,
            action: "retailer_proposal.order_punched",
            subjectType: "retailer_proposal_order_intent",
            subjectId: created.id,
            metadata: { proposalId: input.proposalId, itemCount: lineSnapshots.length },
          },
        });
        return created;
      });
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;
      const raced = await this.prisma.retailerProposalOrderIntent.findUnique({ where: intentWhere, include: { items: true } });
      if (raced && sameProposalDemand(raced.items, items)) return raced;
      if (raced) throw new ProposalError("idempotency_key_conflict", 409);
      throw error;
    }
  }

  async orderIntentForSalesperson(input: { intentId: string; salespersonId: string }) {
    const intent = await this.prisma.retailerProposalOrderIntent.findFirst({
      where: { id: input.intentId, submittedByStaffId: input.salespersonId },
      include: {
        proposal: { select: { id: true, status: true, retailerId: true, businessName: true } },
        items: { select: { variantId: true, qty: true, productName: true, unitSize: true, unitsPerCase: true } },
        convertedOrder: { select: { id: true, orderNo: true, status: true } },
      },
    });
    if (!intent) throw new ProposalError("order_intent_not_found", 404);
    const { id, proposalId, punchedAt, convertedAt, convertedOrderId, conversionCommercialQuoteId, items, proposal, convertedOrder } = intent;
    const demandState = proposal.status === "pending"
      ? "waiting_for_retailer_approval"
      : proposal.status === "approved"
        ? convertedOrderId ? "converted" : "ready_for_official_order"
        : "not_available";
    return { id, proposalId, punchedAt, convertedAt, convertedOrderId, conversionCommercialQuoteId, items, proposal, convertedOrder, demandState };
  }

  async convertOrderIntent(input: {
    intentId: string;
    salespersonId: string;
    commercial?: { quoteId: string; revision: number };
  }) {
    const intent = await this.prisma.retailerProposalOrderIntent.findFirst({
      where: { id: input.intentId, submittedByStaffId: input.salespersonId },
      include: {
        proposal: { include: { submittedBy: { select: { salesRepId: true } } } },
        items: { select: { variantId: true, qty: true } },
        convertedOrder: true,
      },
    });
    if (!intent) throw new ProposalError("order_intent_not_found", 404);
    if (intent.convertedOrder) return { order: intent.convertedOrder, alreadyConverted: true };
    if (intent.proposal.status !== "approved" || !intent.proposal.retailerId) {
      throw new ProposalError("retailer_approval_required", 409);
    }

    const staff = await this.prisma.staffUser.findUnique({
      where: { id: input.salespersonId },
      select: { status: true, salesRepId: true },
    });
    if (!staff || staff.status !== "active" || !staff.salesRepId) {
      throw new ProposalError("salesperson_not_available", 403);
    }
    if (staff.salesRepId !== intent.proposal.submittedBy.salesRepId) {
      throw new ProposalError("retailer_assignment_mismatch", 403);
    }
    const retailer = await this.prisma.retailer.findFirst({
      where: { id: intent.proposal.retailerId, salesRepId: staff.salesRepId },
      select: { id: true },
    });
    if (!retailer) throw new ProposalError("retailer_assignment_mismatch", 403);

    const commercial = input.commercial ?? undefined;
    if (intent.conversionCommercialQuoteId && commercial?.quoteId !== intent.conversionCommercialQuoteId) {
      const pinnedQuote = await this.prisma.commercialQuote.findUnique({
        where: { id: intent.conversionCommercialQuoteId },
        select: { acceptedAt: true, expiresAt: true },
      });
      if (!pinnedQuote || pinnedQuote.acceptedAt || pinnedQuote.expiresAt >= new Date() || !commercial?.quoteId) {
        throw new ProposalError("conversion_quote_mismatch", 409, { quoteId: intent.conversionCommercialQuoteId });
      }
      const replaced = await this.prisma.retailerProposalOrderIntent.updateMany({
        where: {
          id: intent.id,
          convertedOrderId: null,
          conversionCommercialQuoteId: intent.conversionCommercialQuoteId,
        },
        data: { conversionCommercialQuoteId: commercial.quoteId },
      });
      if (replaced.count !== 1) {
        const current = await this.prisma.retailerProposalOrderIntent.findUnique({ where: { id: intent.id }, select: { conversionCommercialQuoteId: true } });
        if (current?.conversionCommercialQuoteId !== commercial.quoteId) {
          throw new ProposalError("conversion_quote_mismatch", 409, { quoteId: current?.conversionCommercialQuoteId });
        }
      }
    }
    if (!intent.conversionCommercialQuoteId && commercial?.quoteId) {
      const claimed = await this.prisma.retailerProposalOrderIntent.updateMany({
        where: { id: intent.id, convertedOrderId: null, conversionCommercialQuoteId: null },
        data: { conversionCommercialQuoteId: commercial.quoteId },
      });
      if (claimed.count !== 1) {
        const current = await this.prisma.retailerProposalOrderIntent.findUnique({ where: { id: intent.id }, select: { conversionCommercialQuoteId: true } });
        if (current?.conversionCommercialQuoteId !== commercial.quoteId) {
          throw new ProposalError("conversion_quote_mismatch", 409, { quoteId: current?.conversionCommercialQuoteId });
        }
      }
    }

    const result = await this.createOfficialOrder(
      retailer.id,
      normalizeProposalDemand(intent.items)!,
      "rep",
      staff.salesRepId,
      input.salespersonId,
      `retailer-proposal-intent:${intent.id}`,
      commercial,
    );
    if (!result.ok) {
      if (result.body.error !== "manager_freight_confirmation_required") {
        await this.prisma.retailerProposalOrderIntent.updateMany({
          where: { id: intent.id, convertedOrderId: null },
          data: { conversionCommercialQuoteId: null },
        });
      }
      throw new ProposalError(String(result.body.error ?? "order_conversion_failed"), result.status, result.body);
    }

    await this.prisma.$transaction(async (tx: Db) => {
      const linked = await tx.retailerProposalOrderIntent.updateMany({
        where: { id: intent.id, convertedOrderId: null },
        data: { convertedOrderId: result.order.id, convertedAt: new Date() },
      });
      if (linked.count === 0) {
        const existing = await tx.retailerProposalOrderIntent.findUnique({ where: { id: intent.id }, select: { convertedOrderId: true } });
        if (existing?.convertedOrderId !== result.order.id) throw new ProposalError("order_intent_already_converted", 409);
      }
      if (linked.count === 1) {
        await tx.auditEvent.create({
          data: {
            actorStaffId: input.salespersonId,
            action: "retailer_proposal.order_converted",
            subjectType: "retailer_proposal_order_intent",
            subjectId: intent.id,
            metadata: { proposalId: intent.proposalId, retailerId: retailer.id, orderId: result.order.id },
          },
        });
      }
    });
    return { ...result, alreadyConverted: false };
  }

  /**
   * The reviewer's queue.
   *
   * Scope routes a proposal to the manager above whoever submitted it, but it
   * does not change who is *allowed* to admit a store to the customer master —
   * an org-wide reviewer (the existing admin approval policy) still sees every
   * proposal, because `scopeStaffIds` is null for them. Routing and policy stay
   * separate concerns.
   */
  async listForReview(filters: { status?: string; scopeStaffIds?: string[] | null } = {}) {
    const proposals = await this.prisma.retailerProposal.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.scopeStaffIds ? { submittedByStaffId: { in: filters.scopeStaffIds } } : {}),
      },
      include: {
        submittedBy: { select: { id: true, name: true, phone: true } },
        reviewedBy: { select: { id: true, name: true } },
        creditVerifiedBy: { select: { id: true, name: true } },
        proposedTier: { select: { id: true, name: true } },
        references: {
          orderBy: { createdAt: "asc" },
          include: {
            existingRetailer: { select: { id: true, name: true, phone: true, shopAddress: true, deliveryCity: true, status: true } },
          },
        },
        aadhaarPhotoAsset: {
          select: { id: true, objectKey: true, contentType: true, sizeBytes: true, deletedAt: true },
        },
        orderIntents: {
          select: {
            id: true,
            punchedAt: true,
            convertedOrderId: true,
            conversionCommercialQuoteId: true,
            convertedOrder: { select: { id: true, orderNo: true, status: true } },
            submittedBy: { select: { id: true, name: true } },
            items: {
              select: {
                variantId: true,
                qty: true,
                productName: true,
                unitSize: true,
                unitsPerCase: true,
              },
            },
          },
          orderBy: { punchedAt: "desc" },
        },
      },
      orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
      take: 200,
    });

    const backAssetIdByProposal = new Map<string, string>();
    for (const proposal of proposals) {
      const match = proposal.notes?.match(/\[AADHAAR_BACK_ASSET_ID:([a-zA-Z0-9_-]+)\]/);
      if (match?.[1]) backAssetIdByProposal.set(proposal.id, match[1]);
    }

    const backAssetIds = [...new Set(backAssetIdByProposal.values())];
    const backAssetsById = new Map<string, any>();
    if (backAssetIds.length > 0 && this.prisma.evidenceAsset?.findMany) {
      try {
        const backAssets = await this.prisma.evidenceAsset.findMany({
          where: { id: { in: backAssetIds } },
          select: { id: true, objectKey: true, contentType: true, sizeBytes: true, deletedAt: true },
        });
        for (const a of backAssets) backAssetsById.set(a.id, a);
      } catch {
        // Fallback to single lookup per proposal if mock does not implement findMany
      }
    }

    const candidateAssetIds: string[] = [];
    for (const proposal of proposals) {
      if (proposal.aadhaarPhotoAsset && !proposal.aadhaarPhotoAsset.deletedAt && proposal.aadhaarPhotoAsset.id) {
        candidateAssetIds.push(proposal.aadhaarPhotoAsset.id);
      }
      const backId = backAssetIdByProposal.get(proposal.id);
      if (backId) candidateAssetIds.push(backId);
    }

    const dbBackedAssetIds = new Set<string>();
    if (candidateAssetIds.length > 0 && this.prisma.evidenceAsset?.findMany) {
      try {
        const backedRows = await this.prisma.evidenceAsset.findMany({
          where: {
            id: { in: [...new Set(candidateAssetIds)] },
            deletedAt: null,
            contentBytes: { not: null },
          },
          select: { id: true },
        });
        for (const row of backedRows) {
          if (row?.id) dbBackedAssetIds.add(row.id);
        }
      } catch {
        // Ignore if mock prisma lacks contentBytes filtering
      }
    }

    const resolvePhotoUrl = async (proposalId: string, side: "front" | "back", asset: any): Promise<string | null> => {
      if (!asset || asset.deletedAt) return null;
      const proxyPath = `/admin/retailer-proposals/${proposalId}/aadhaar-photo/${side}`;
      try {
        const url = await this.objectStorage().signedReadUrl(asset.objectKey, 300);
        if (url && !url.startsWith("local-storage://")) {
          return url;
        }
        // Browsers cannot load local-storage:// URIs directly; serve via authenticated Admin HTTP endpoint
        return proxyPath;
      } catch {
        // Storage read failed (e.g. ephemeral disk wiped on restart): fall back to durable DB contentBytes if present
        if (asset.id && dbBackedAssetIds.has(asset.id)) {
          return proxyPath;
        }
        return null;
      }
    };

    return Promise.all(
      proposals.map(async (proposal: any) => {
        const photoUrl = await resolvePhotoUrl(proposal.id, "front", proposal.aadhaarPhotoAsset);

        let backAsset: any = null;
        const backAssetId = backAssetIdByProposal.get(proposal.id);
        if (backAssetId) {
          backAsset = backAssetsById.get(backAssetId) ?? null;
          if (!backAsset && this.prisma.evidenceAsset?.findUnique) {
            try {
              backAsset = await this.prisma.evidenceAsset.findUnique({
                where: { id: backAssetId },
                select: { id: true, objectKey: true, contentType: true, sizeBytes: true, deletedAt: true },
              });
            } catch {
              backAsset = null;
            }
          }
        }
        const photoBackUrl = await resolvePhotoUrl(proposal.id, "back", backAsset);

        return {
          ...publicProposal(proposal, photoUrl, photoBackUrl, backAsset),
          orderIntents: (proposal.orderIntents ?? []).map((intent: any) => ({
            ...attributedOrderIntent(proposal, intent),
            items: intent.items ?? [],
            demandState: proposal.status === "pending"
              ? "waiting_for_retailer_approval"
              : proposal.status === "approved"
                ? intent.convertedOrderId ? "converted" : "ready_for_official_order"
                : "not_available",
          })),
        };
      })
    );
  }

  /**
   * Streams protected Aadhaar image bytes (front or back) for authorized reviewers.
   * Uses durable Postgres contentBytes first when present, falling back to objectStorage.
   */
  async getAadhaarPhoto(input: {
    proposalId: string;
    side: "front" | "back";
    scopeStaffIds?: string[] | null;
  }): Promise<{ contentType: string; buffer: Buffer }> {
    const proposal = await this.prisma.retailerProposal.findUnique({
      where: { id: input.proposalId },
      select: {
        id: true,
        submittedByStaffId: true,
        aadhaarPhotoAssetId: true,
        notes: true,
      },
    });
    if (!proposal) throw new ProposalError("proposal_not_found", 404);
    if (!isWithinScope(proposal.submittedByStaffId, input.scopeStaffIds)) {
      throw new ProposalError("outside_reporting_scope", 403);
    }

    let assetId: string | null = null;
    if (input.side === "front") {
      assetId = proposal.aadhaarPhotoAssetId ?? null;
    } else {
      const match = proposal.notes?.match(/\[AADHAAR_BACK_ASSET_ID:([a-zA-Z0-9_-]+)\]/);
      assetId = match?.[1] ?? null;
    }
    if (!assetId) throw new ProposalError("aadhaar_photo_not_found", 404);

    const asset = await this.prisma.evidenceAsset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        objectKey: true,
        contentType: true,
        contentBytes: true,
        deletedAt: true,
      },
    });
    if (!asset || asset.deletedAt) throw new ProposalError("aadhaar_photo_not_found", 404);

    if (asset.contentBytes) {
      return {
        contentType: asset.contentType || "image/jpeg",
        buffer: Buffer.isBuffer(asset.contentBytes) ? asset.contentBytes : Buffer.from(asset.contentBytes),
      };
    }

    try {
      const buffer = await this.objectStorage().read(asset.objectKey);
      return {
        contentType: asset.contentType || "image/jpeg",
        buffer,
      };
    } catch {
      throw new ProposalError("aadhaar_photo_not_found", 404);
    }
  }

  async withdraw(input: { proposalId: string; salespersonId: string }) {
    const proposal = await this.prisma.retailerProposal.findUnique({
      where: { id: input.proposalId },
    });
    if (!proposal || proposal.submittedByStaffId !== input.salespersonId) {
      throw new ProposalError("proposal_not_found", 404);
    }
    if (proposal.status !== "pending") throw new ProposalError("proposal_already_decided", 409);
    return this.prisma.$transaction(async (tx: Db) => {
      const updated = await decidePending(tx, proposal.id, { status: "withdrawn" });
      await tx.auditEvent.create({ data: {
        actorStaffId: input.salespersonId, action: "retailer_proposal.withdrawn",
        subjectType: "retailer_proposal", subjectId: proposal.id,
        metadata: { from: "pending", to: "withdrawn" },
      } });
      return updated;
    });
  }

  /**
   * Admits the store to the customer master.
   *
   * The reviewer chooses the tier that is actually applied; the salesperson's
   * suggestion is only a suggestion. The new customer is assigned to the
   * salesperson who proposed it, which is also what makes it count towards
   * their new-store target.
   */
  async approve(input: {
    proposalId: string;
    reviewerStaffId: string;
    tierId?: string;
    scopeStaffIds?: string[] | null;
  }) {
    const proposal = await this.prisma.retailerProposal.findUnique({
      where: { id: input.proposalId },
      include: { submittedBy: { select: { salesRepId: true } } },
    });
    if (!proposal) throw new ProposalError("proposal_not_found", 404);
    if (proposal.status !== "pending") throw new ProposalError("proposal_already_decided", 409);
    if (proposal.submittedByStaffId === input.reviewerStaffId) {
      throw new ProposalError("self_review_forbidden", 403);
    }
    if (!isWithinScope(proposal.submittedByStaffId, input.scopeStaffIds)) {
      throw new ProposalError("outside_reporting_scope", 403);
    }

    const tierId = input.tierId ?? proposal.proposedTierId;
    if (!tierId) throw new ProposalError("tier_required", 400);
    const tier = await this.prisma.tier.findUnique({ where: { id: tierId }, select: { id: true } });
    if (!tier) throw new ProposalError("tier_not_found", 404);

    const duplicate = await this.prisma.retailer.findFirst({
      where: { phone: proposal.phone },
      select: { id: true },
    });
    if (duplicate) throw new ProposalError("retailer_already_exists", 409);

    const result = await this.prisma.$transaction(async (tx: Db) => {
      // Claim the decision before creating its customer. A losing transaction
      // cannot leave an approved customer behind a rejected/withdrawn proposal.
      await decidePending(tx, proposal.id, { status: "approved" });
      const retailer = await tx.retailer.create({
        data: {
          name: proposal.businessName,
          groupName: proposal.groupName ?? null,
          ownerName: proposal.ownerName ?? null,
          shopAddress: proposal.shopAddress,
          addressLine2: proposal.addressLine2 ?? null,
          beatName: proposal.beatName ?? null,
          pincode: proposal.pinCode ?? null,
          tehsil: proposal.tehsil ?? null,
          district: proposal.district ?? null,
          state: proposal.state ?? null,
          deliveryCity: proposal.deliveryCity?.trim() || null,
          phone: proposal.phone,
          telephone: proposal.telephone ?? null,
          transporter: proposal.transporter ?? null,
          broker: proposal.broker ?? null,
          shopDurationYears: proposal.shopDurationYears ?? null,
          gstin: proposal.gstin ?? null,
          upiId: proposal.upiId ?? null,
          grade: proposal.grade ?? null,
          buyerCategory: proposal.buyerCategory ?? null,
          buyerSubCategory: proposal.buyerSubCategory ?? null,
          remark: proposal.remark ?? null,
          businessNameHi: proposal.businessNameHi ?? null,
          transporterHi: proposal.transporterHi ?? null,
          shopAddressHi: proposal.shopAddressHi ?? null,
          addressLine2Hi: proposal.addressLine2Hi ?? null,
          beatNameHi: proposal.beatNameHi ?? null,
          deliveryCityHi: proposal.deliveryCityHi ?? null,
          tehsilHi: proposal.tehsilHi ?? null,
          districtHi: proposal.districtHi ?? null,
          stateHi: proposal.stateHi ?? null,
          tierId,
          // Approval admits the store to the master; KYC still gates credit
          // and dispatch, so the lifecycle starts where every store starts.
          status: "pending_kyc",
          creditLimit: proposal.proposedCreditLimit ?? 0,
          currentBalance: 0,
          overdueAmount: 0,
          salesRepId: proposal.submittedBy?.salesRepId ?? null,
        },
      });

      // The account-opened milestone belongs to admission into the canonical
      // retailer master, not to proposal submission. Keep it in the same
      // transaction so a reviewer can never see an opened-account event for a
      // retailer that was not actually admitted.
      await recordCommercialStatusEvent(tx, {
        code: CommercialStatusCode.ACCOUNT_OPENED,
        retailerId: retailer.id,
        actorStaffId: input.reviewerStaffId,
        metadata: {
          source: "retailer_proposal_approval",
          proposalId: proposal.id,
          submittedBy: proposal.submittedByStaffId,
          lifecycle: "pending_kyc",
        },
        idempotencyKey: `account-opened:${retailer.id}`,
      });

      // A coordinate taken at the storefront is captured, not verified: the
      // location module verifies on a second reading taken at the store.
      await tx.retailerLocation.create({
        data:
          proposal.latitude != null && proposal.longitude != null
            ? {
                retailerId: retailer.id,
                latitude: proposal.latitude,
                longitude: proposal.longitude,
                accuracyMeters: proposal.accuracyMeters,
                status: "CAPTURED",
                source: "SALESPERSON_VISIT",
                capturedAt: proposal.submittedAt,
                capturedByUserId: proposal.submittedByStaffId,
                locationVersion: 1,
              }
            : { retailerId: retailer.id },
      });

      const updated = await tx.retailerProposal.update({
        where: { id: proposal.id },
        data: {
          status: "approved",
          reviewedByStaffId: input.reviewerStaffId,
          reviewedAt: new Date(),
          retailerId: retailer.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorStaffId: input.reviewerStaffId,
          action: "retailer_proposal.approved",
          subjectType: "retailer_proposal",
          subjectId: proposal.id,
          metadata: { retailerId: retailer.id, submittedBy: proposal.submittedByStaffId },
        },
      });

      return { proposal: updated, retailer };
    });

    const conversionErrors: string[] = [];
    const convertedOrders = await this.autoConvertPendingIntents({
      proposalId: proposal.id,
      retailerId: result.retailer.id,
      salespersonStaffId: proposal.submittedByStaffId,
      salesRepId: proposal.submittedBy?.salesRepId ?? undefined,
      actorStaffId: input.reviewerStaffId,
      onError: (reason) => conversionErrors.push(reason),
    }).catch((conversionErr) => {
      const reason = conversionErr instanceof Error ? conversionErr.message : String(conversionErr);
      conversionErrors.push(reason);
      console.error(`[RetailerProposalService] Auto-conversion failed for proposal ${proposal.id}:`, conversionErr);
      return [] as any[];
    });

    return conversionErrors.length > 0
      ? { ...result, convertedOrders, conversionErrors }
      : { ...result, convertedOrders };
  }

  /**
   * Automatically convert pending preliminary order intents for a proposal
   * into canonical orders immediately upon manager approval so they enter
   * the warehouse dispatch queue without requiring a second manual review step.
   */
  async autoConvertPendingIntents(params: {
    proposalId: string;
    retailerId: string;
    salespersonStaffId: string;
    salesRepId?: string | null;
    actorStaffId?: string | null;
    onError?: (reason: string) => void;
  }) {
    if (!this.prisma.retailerProposalOrderIntent?.findMany) return [];

    const pendingIntents = await this.prisma.retailerProposalOrderIntent.findMany({
      where: {
        proposalId: params.proposalId,
        convertedOrderId: null,
      },
      include: {
        items: {
          select: {
            variantId: true,
            qty: true,
          },
        },
      },
      orderBy: { punchedAt: "asc" },
    });

    if (!pendingIntents || !pendingIntents.length) return [];

    let salesRepId = params.salesRepId;
    if (!salesRepId && this.prisma.staffUser?.findUnique) {
      try {
        const staff = await this.prisma.staffUser.findUnique({
          where: { id: params.salespersonStaffId },
          select: { salesRepId: true },
        });
        salesRepId = staff?.salesRepId ?? undefined;
      } catch {
        salesRepId = undefined;
      }
    }

    const converted: any[] = [];
    for (const intent of pendingIntents) {
      const items = normalizeProposalDemand(intent.items);
      if (!items || items.length === 0) continue;

      const idempotencyKey = `retailer-proposal-intent:${intent.id}`;
      try {
        if (this.prisma.order?.findUnique) {
          const existingOrder = await this.prisma.order.findUnique({
            where: {
              retailerId_idempotencyKey: {
                retailerId: params.retailerId,
                idempotencyKey,
              },
            },
          });
          if (existingOrder?.id) {
            if (this.prisma.retailerProposalOrderIntent?.updateMany) {
              await this.prisma.retailerProposalOrderIntent.updateMany({
                where: { id: intent.id, convertedOrderId: null },
                data: {
                  convertedOrderId: existingOrder.id,
                  convertedAt: new Date(),
                  conversionCommercialQuoteId: existingOrder.commercialQuoteId ?? null,
                },
              });
            }
            converted.push(existingOrder);
            continue;
          }
        }

        let commercial: { quoteId: string; revision: number } | undefined;
        try {
          const q = await this.createCommercialQuote(params.retailerId, items);
          if (q) {
            commercial = { quoteId: q.id, revision: q.revision };
          }
        } catch (quoteErr) {
          console.warn(
            `[RetailerProposalService] Commercial quote failed during auto-conversion for intent ${intent.id}:`,
            quoteErr
          );
        }

        const orderResult = await this.createOfficialOrder(
          params.retailerId,
          items,
          "rep",
          salesRepId ?? undefined,
          params.salespersonStaffId,
          idempotencyKey,
          commercial,
        );

        if (orderResult.ok && orderResult.order?.id) {
          await this.prisma.$transaction(async (tx: Db) => {
            if (tx.retailerProposalOrderIntent?.updateMany) {
              await tx.retailerProposalOrderIntent.updateMany({
                where: { id: intent.id, convertedOrderId: null },
                data: {
                  convertedOrderId: orderResult.order.id,
                  convertedAt: new Date(),
                  conversionCommercialQuoteId: commercial?.quoteId ?? null,
                },
              });
            }

            if (tx.auditEvent?.create) {
              await tx.auditEvent.create({
                data: {
                  actorStaffId: params.actorStaffId ?? params.salespersonStaffId,
                  action: "retailer_proposal.order_auto_converted",
                  subjectType: "retailer_proposal_order_intent",
                  subjectId: intent.id,
                  metadata: {
                    proposalId: params.proposalId,
                    retailerId: params.retailerId,
                    orderId: orderResult.order.id,
                  },
                },
              });
            }
          });
          converted.push(orderResult.order);
        } else {
          const reason = String((orderResult as any)?.body?.error ?? "order_creation_failed");
          params.onError?.(reason);
          console.error(
            `[RetailerProposalService] Auto-conversion order creation failed for intent ${intent.id}:`,
            (orderResult as any)?.body
          );
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        params.onError?.(reason);
        console.error(`[RetailerProposalService] Error during auto-conversion for intent ${intent.id}:`, err);
      }
    }
    return converted;
  }

  /**
   * Backfill/sweep helper to auto-convert any approved proposals that have unconverted order intents.
   */
  async convertAllPendingApprovedIntents(): Promise<Array<{
    proposalId: string;
    retailerId: string;
    count: number;
    orderIds: string[];
  }>> {
    if (this.pendingBackfillPromise) return this.pendingBackfillPromise;
    if (!this.prisma.retailerProposal?.findMany) return [];

    this.pendingBackfillPromise = (async () => {
      const proposals = await this.prisma.retailerProposal.findMany({
        where: {
          status: "approved",
          retailerId: { not: null },
          orderIntents: {
            some: { convertedOrderId: null },
          },
        },
        include: {
          submittedBy: { select: { salesRepId: true } },
          orderIntents: { select: { id: true, convertedOrderId: true } },
        },
      });

      const results: Array<{
        proposalId: string;
        retailerId: string;
        count: number;
        orderIds: string[];
      }> = [];
      for (const proposal of proposals) {
        if (!proposal.retailerId) continue;
        // Skip proposals that already have a converted intent (e.g. from earlier duplicate punches
        // where only one intent was manually converted via the legacy flow).
        const hasAlreadyConvertedIntent = (proposal.orderIntents ?? []).some(
          (i: any) => Boolean(i.convertedOrderId)
        );
        if (hasAlreadyConvertedIntent) continue;

        const orders = await this.autoConvertPendingIntents({
          proposalId: proposal.id,
          retailerId: proposal.retailerId,
          salespersonStaffId: proposal.submittedByStaffId,
          salesRepId: proposal.submittedBy?.salesRepId ?? undefined,
          actorStaffId: proposal.reviewedByStaffId ?? proposal.submittedByStaffId,
        });
        results.push({
          proposalId: proposal.id,
          retailerId: proposal.retailerId,
          count: orders.length,
          orderIds: orders.map((o: any) => String(o.id)),
        });
      }
      return results;
    })();

    try {
      return await this.pendingBackfillPromise;
    } finally {
      this.pendingBackfillPromise = null;
    }
  }

  async verifyCreditReferences(input: {
    proposalId: string;
    actorStaffId: string;
    status: "pending" | "verified" | "flagged";
    notes?: string;
  }) {
    const proposal = await this.prisma.retailerProposal.findUnique({ where: { id: input.proposalId } });
    if (!proposal) throw new ProposalError("proposal_not_found", 404);
    const updated = await this.prisma.$transaction(async (tx: Db) => {
      const next = await tx.retailerProposal.update({
        where: { id: input.proposalId },
        data: {
          creditVerificationStatus: input.status,
          creditVerifiedByStaffId: input.actorStaffId,
          creditVerifiedAt: new Date(),
          creditVerificationNotes: clean(input.notes),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.actorStaffId,
          action: "retailer_proposal.credit_references_reviewed",
          subjectType: "retailer_proposal",
          subjectId: input.proposalId,
          metadata: { status: input.status, notes: clean(input.notes) },
        },
      });
      return next;
    });
    return publicProposal(updated);
  }

  async reject(input: {
    proposalId: string;
    reviewerStaffId: string;
    reason: string;
    scopeStaffIds?: string[] | null;
  }) {
    const reason = input.reason?.trim() ?? "";
    if (reason.length < 3) throw new ProposalError("rejection_reason_required", 400);

    const proposal = await this.prisma.retailerProposal.findUnique({
      where: { id: input.proposalId },
    });
    if (!proposal) throw new ProposalError("proposal_not_found", 404);
    if (proposal.status !== "pending") throw new ProposalError("proposal_already_decided", 409);
    if (proposal.submittedByStaffId === input.reviewerStaffId) {
      throw new ProposalError("self_review_forbidden", 403);
    }
    if (!isWithinScope(proposal.submittedByStaffId, input.scopeStaffIds)) {
      throw new ProposalError("outside_reporting_scope", 403);
    }

    return this.prisma.$transaction(async (tx: Db) => {
      const updated = await decidePending(tx, proposal.id, {
          status: "rejected",
          reviewedByStaffId: input.reviewerStaffId,
          reviewedAt: new Date(),
          rejectionReason: reason,
      });
      await tx.auditEvent.create({
        data: {
          actorStaffId: input.reviewerStaffId,
          action: "retailer_proposal.rejected",
          subjectType: "retailer_proposal",
          subjectId: proposal.id,
          metadata: { reason },
        },
      });
      return updated;
    });
  }
}

export const defaultRetailerProposalService = new RetailerProposalService();
