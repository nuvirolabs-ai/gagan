export interface RecoveryLetterPdfInput {
  retailerName: string;
  retailerAddress: string;
  invoiceNumber: number;
  outstandingAmount: number;
  currency: string;
  sentAt: Date;
  responseDueAt: Date;
  signatories: [string, string, string];
}

function pdfText(value: string) {
  return value.replace(/([\\()])/g, "\\$1").replace(/\r?\n/g, " ");
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function amountLabel(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Renders a deterministic, single-page PDF without embedding generated ids or
 * timestamps beyond the letter's supplied sent/deadline dates.
 */
export function renderRecoveryLetterPdf(input: RecoveryLetterPdfInput) {
  const lines = [
    "GAGAN RECOVERY NOTICE",
    `To: ${input.retailerName}`,
    `Address: ${input.retailerAddress}`,
    `Invoice ${input.invoiceNumber}`,
    `Outstanding amount: ${amountLabel(input.currency, input.outstandingAmount)}`,
    `Notice date: ${dateLabel(input.sentAt)}`,
    `Response deadline: ${dateLabel(input.responseDueAt)}`,
    "Please contact Gagan Accounts within seven days to confirm payment arrangements.",
    "Signatories:",
    `1. ${input.signatories[0]}`,
    `2. ${input.signatories[1]}`,
    `3. ${input.signatories[2]}`,
  ];
  const content = ["BT", ...lines.map((line, index) => `/F1 ${index === 0 ? 16 : 11} Tf 72 ${730 - index * 42} Td (${pdfText(line)}) Tj`), "ET", ""].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`,
  ];
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(chunks.join(""), "latin1"));
    chunks.push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`);
  }
  const xrefOffset = Buffer.byteLength(chunks.join(""), "latin1");
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.from(chunks.join(""), "latin1");
}
