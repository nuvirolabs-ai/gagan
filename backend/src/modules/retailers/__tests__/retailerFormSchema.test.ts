import { describe, expect, it } from "vitest";
import {
  RETAILER_FORM_FIELDS,
  mapFormToProposalWrite,
  mapFormToRetailerWrite,
  parseRetailerForm,
} from "../retailerFormSchema";

const valid = {
  partyName: "Sharma Kirana",
  groupId: "11111111-1111-4111-8111-111111111111",
  contactPerson: "Ramesh Sharma",
  mobile: "9876543210",
  telephone: "07314001111",
  transporterId: "22222222-2222-4222-8222-222222222222",
  address1: "14 Palasia Square",
  pin: "452001",
  tehsil: "Indore",
  district: "Indore",
  state: "Madhya Pradesh",
  deliveryCity: "Indore",
  salesmanRepId: "33333333-3333-4333-8333-333333333333",
  beatId: "44444444-4444-4444-8444-444444444444",
  shopTenureYears: 8,
  gstin: "23AABCU9603R1ZX",
  aadhaarNumber: "1234 5678 9012",
  aadhaarPhotoAssetId: "55555555-5555-4555-8555-555555555555",
  paymentTermDays: 21,
  creditLimit: 75000,
  grade: "B" as const,
  buyerCategoryId: "66666666-6666-4666-8666-666666666666",
  buyerSubCategoryId: "77777777-7777-4777-8777-777777777777",
  upiId: "sharma@okaxis",
};

describe("retailer form validation", () => {
  it("defines all 24 fields and accepts a complete Indore payload", () => {
    expect(RETAILER_FORM_FIELDS).toHaveLength(24);
    const parsed = parseRetailerForm(valid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.mobile).toBe("9876543210");
    expect(parsed.data.aadhaarNumber).toBe("123456789012");
    expect(parsed.data.gstin).toBe("23AABCU9603R1ZX");
  });

  it("requires party, group, contact, mobile, transporter, address, delivery city, salesman, tenure, aadhaar, terms, grade and category", () => {
    const parsed = parseRetailerForm({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const keys = Object.keys(parsed.error.flatten().fieldErrors);
    for (const required of [
      "partyName",
      "groupId",
      "contactPerson",
      "mobile",
      "transporterId",
      "address1",
      "deliveryCity",
      "salesmanRepId",
      "shopTenureYears",
      "aadhaarNumber",
      "aadhaarPhotoAssetId",
      "paymentTermDays",
      "grade",
      "buyerCategoryId",
    ]) {
      expect(keys).toContain(required);
    }
  });

  it("rejects invalid mobile, aadhaar, GSTIN, PIN, UPI and payment terms", () => {
    expect(parseRetailerForm({ ...valid, mobile: "12345" }).success).toBe(false);
    expect(parseRetailerForm({ ...valid, aadhaarNumber: "123" }).success).toBe(false);
    expect(parseRetailerForm({ ...valid, gstin: "bad" }).success).toBe(false);
    expect(parseRetailerForm({ ...valid, pin: "4520" }).success).toBe(false);
    expect(parseRetailerForm({ ...valid, upiId: "not-an-upi" }).success).toBe(false);
    expect(parseRetailerForm({ ...valid, paymentTermDays: 12 }).success).toBe(false);
    expect(parseRetailerForm({ ...valid, grade: "Z" }).success).toBe(false);
  });

  it("treats blank optional fields as absent", () => {
    const parsed = parseRetailerForm({
      ...valid,
      telephone: "",
      pin: "",
      gstin: "",
      beatId: "",
      buyerSubCategoryId: "",
      upiId: "",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.telephone).toBeUndefined();
    expect(parsed.data.beatId).toBeUndefined();
    expect(parsed.data.upiId).toBeUndefined();
  });
});

describe("proposal to retailer mapping", () => {
  it("maps all 24 fields including credit limit, payment terms and grade", () => {
    const parsed = parseRetailerForm(valid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const retailer = mapFormToRetailerWrite(parsed.data);
    const proposal = mapFormToProposalWrite(parsed.data);

    expect(retailer).toMatchObject({
      name: "Sharma Kirana",
      shopAddress: "14 Palasia Square",
      phone: "9876543210",
      contactPerson: "Ramesh Sharma",
      telephone: "07314001111",
      groupId: valid.groupId,
      transporterId: valid.transporterId,
      pin: "452001",
      tehsil: "Indore",
      district: "Indore",
      state: "Madhya Pradesh",
      deliveryCity: "Indore",
      salesRepId: valid.salesmanRepId,
      beatId: valid.beatId,
      shopTenureYears: 8,
      gstin: "23AABCU9603R1ZX",
      aadhaarNumber: "123456789012",
      aadhaarPhotoAssetId: valid.aadhaarPhotoAssetId,
      paymentTermDays: 21,
      creditLimit: 75000,
      grade: "B",
      buyerCategoryId: valid.buyerCategoryId,
      buyerSubCategoryId: valid.buyerSubCategoryId,
      upiId: "sharma@okaxis",
    });

    expect(proposal.partyName).toBe(retailer.name);
    expect(proposal.address1).toBe(retailer.shopAddress);
    expect(proposal.mobile).toBe(retailer.phone);
    expect(proposal.creditLimit).toBe(75000);
    expect(proposal.paymentTermDays).toBe(21);
    expect(proposal.grade).toBe("B");
    expect(Object.keys(retailer)).toHaveLength(24);
  });
});
