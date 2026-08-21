import { describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";

describe("KYC schema", () => {
  it("stores retailer lifecycle, one current case, evidence assets, documents and reviews", async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('KycCase', 'KycDocument', 'KycReview', 'EvidenceAsset', 'RetailerContact', 'RetailerSapAccount')
      ORDER BY table_name
    `;
    expect(tables.map(({ table_name }) => table_name)).toEqual([
      "EvidenceAsset",
      "KycCase",
      "KycDocument",
      "KycReview",
      "RetailerContact",
      "RetailerSapAccount",
    ]);

    const lifecycle = await prisma.$queryRaw<Array<{ column_default: string | null }>>`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Retailer'
        AND column_name = 'status'
    `;
    expect(lifecycle).toHaveLength(1);
    expect(lifecycle[0].column_default).toContain("pending_kyc");
  });
});
