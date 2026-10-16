export interface InvoicePdfData {
  invoiceNumber: number;
  orderNo?: number | null;
  invoiceDate: Date;
  dueDate: Date;
  currency: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  transportationAmount?: number;
  retailer: {
    name: string;
    shopAddress?: string | null;
    deliveryCity?: string | null;
    phone?: string | null;
  };
  lines: Array<{
    description: string;
    cases?: number | null;
    weightKg?: number | null;
    unitPrice: number;
    lineTotal: number;
    sellingEntity?: string | null;
  }>;
}

function pdfText(value: string) {
  return value.replace(/([\\()])/g, "\\$1").replace(/\r?\n/g, " ");
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function inrLabel(amount: number) {
  return `INR ${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generates a clean, valid, standalone PDF 1.4 Tax Invoice document.
 */
export function renderInvoicePdf(data: InvoicePdfData): Buffer {
  const lines: Array<{ text: string; size: number; y: number; bold?: boolean }> = [];
  let y = 740;

  // Header
  lines.push({ text: "GAGAN FOODS - TAX INVOICE", size: 16, y, bold: true });
  y -= 22;
  lines.push({ text: "Jain Traders & Padam International - Authorized Distribution", size: 9, y });
  y -= 28;

  // Invoice & Customer Info Box
  lines.push({ text: `Invoice No: INV-${data.invoiceNumber}`, size: 11, y, bold: true });
  lines.push({ text: `Date: ${dateLabel(data.invoiceDate)}    Due Date: ${dateLabel(data.dueDate)}`, size: 9, y: y - 14 });
  if (data.orderNo) {
    lines.push({ text: `Order Ref: ORD-${data.orderNo}`, size: 9, y: y - 28 });
  }
  y -= 44;

  // Bill To
  lines.push({ text: "Billed & Delivered To:", size: 10, y, bold: true });
  y -= 14;
  lines.push({ text: `${data.retailer.name} (${data.retailer.phone || "No phone"})`, size: 10, y });
  y -= 13;
  if (data.retailer.shopAddress) {
    lines.push({ text: `${data.retailer.shopAddress}${data.retailer.deliveryCity ? `, ${data.retailer.deliveryCity}` : ""}`, size: 9, y });
    y -= 13;
  }
  y -= 16;

  // Table Header
  lines.push({
    text: "Item Description                                      Cases    Rate (INR)     Total (INR)",
    size: 9,
    y,
    bold: true,
  });
  y -= 14;
  lines.push({
    text: "--------------------------------------------------------------------------------------------------------",
    size: 8,
    y,
  });
  y -= 14;

  // Line Items
  for (const item of data.lines) {
    const desc = item.description.padEnd(46, " ").slice(0, 46);
    const cases = (item.cases != null ? String(item.cases) : "-").padStart(6, " ");
    const rate = Number(item.unitPrice).toFixed(2).padStart(12, " ");
    const total = Number(item.lineTotal).toFixed(2).padStart(14, " ");
    lines.push({
      text: `${desc} ${cases} ${rate} ${total}`,
      size: 9,
      y,
    });
    y -= 16;
  }

  // Divider
  lines.push({
    text: "--------------------------------------------------------------------------------------------------------",
    size: 8,
    y,
  });
  y -= 18;

  // Transportation Amount (if present)
  if (data.transportationAmount && data.transportationAmount > 0) {
    const freightLabel = "Transportation / Freight Charge".padEnd(66, " ");
    const freightVal = Number(data.transportationAmount).toFixed(2).padStart(14, " ");
    lines.push({
      text: `${freightLabel} ${freightVal}`,
      size: 9,
      y,
      bold: true,
    });
    y -= 16;
  }

  // Subtotal & Total
  lines.push({
    text: `Subtotal: ${inrLabel(data.subtotal)}`,
    size: 10,
    y,
  });
  y -= 16;

  if (data.taxTotal > 0) {
    lines.push({
      text: `GST Tax Total: ${inrLabel(data.taxTotal)}`,
      size: 10,
      y,
    });
    y -= 16;
  }

  lines.push({
    text: `FINAL INVOICE TOTAL: ${inrLabel(data.total)}`,
    size: 13,
    y,
    bold: true,
  });
  y -= 36;

  // Footer notes
  lines.push({ text: "Terms & Conditions:", size: 9, y, bold: true });
  y -= 13;
  lines.push({ text: "1. Payment is due as per agreed commercial credit terms.", size: 8, y });
  y -= 11;
  lines.push({ text: "2. Goods once sold and verified at delivery are non-returnable.", size: 8, y });
  y -= 18;
  lines.push({ text: "This is a computer-generated tax invoice. No signature required.", size: 8, y });

  const fontRef = "/F1";
  const content = [
    "BT",
    ...lines.map((l) => `${fontRef} ${l.size} Tf 54 ${l.y} Td (${pdfText(l.text)}) Tj`),
    "ET",
    "",
  ].join("\n");

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
  chunks.push(
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
      .join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return Buffer.from(chunks.join(""), "latin1");
}
