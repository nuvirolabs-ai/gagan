import type { Prisma, SalesOrderCompany } from "@prisma/client";

const firms = {
  jain_traders: { name: "Jain Traders", referencePrefix: "JT", environmentPrefix: "JAIN_TRADERS" },
  padam_international: { name: "Padam International", referencePrefix: "PI", environmentPrefix: "PADAM_INTERNATIONAL" },
} satisfies Record<SalesOrderCompany, { name: string; referencePrefix: string; environmentPrefix: string }>;

export function firmSeller(company: SalesOrderCompany) {
  const firm = firms[company];
  return {
    name: firm.name,
    address: process.env[`${firm.environmentPrefix}_BILLING_ADDRESS`]?.trim() || null,
    gstin: process.env[`${firm.environmentPrefix}_BILLING_GSTIN`]?.trim().toUpperCase() || null,
  };
}

export async function nextFirmInvoiceIdentity(
  tx: Prisma.TransactionClient,
  company: SalesOrderCompany,
  issuedAt: Date,
) {
  const indiaDate = new Date(issuedAt.getTime() + (5 * 60 + 30) * 60_000);
  const startYear = indiaDate.getUTCFullYear() - (indiaDate.getUTCMonth() < 3 ? 1 : 0);
  const series = await tx.companyInvoiceSequence.upsert({
    where: { company_financialYear: { company, financialYear: startYear } },
    update: { lastNumber: { increment: 1 } },
    create: { company, financialYear: startYear, lastNumber: 1 },
  });
  const yearSuffix = String(startYear + 1).slice(-2);
  return {
    financialYear: `${startYear}-${yearSuffix}`,
    firmInvoiceNumber: `${firms[company].referencePrefix}/${String(startYear).slice(-2)}${yearSuffix}/${String(series.lastNumber).padStart(6, "0")}`,
  };
}
