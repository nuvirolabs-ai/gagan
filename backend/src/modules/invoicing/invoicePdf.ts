export interface InvoicePdfData {
  invoiceNumber: number;
  invoiceReference?: string;
  voided?: boolean;
  orderNo?: number | null;
  companyOrderReference?: string | null;
  invoiceDate: Date;
  dueDate: Date;
  currency: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  salespersonName?: string | null;
  warehouseName?: string | null;
  seller?: { name: string; address?: string | null; gstin?: string | null } | null;
  retailer: {
    name: string;
    address?: string | null;
    deliveryCity?: string | null;
    phone?: string | null;
    gstin?: string | null;
  };
  shipTo?: { city: string; address: string };
  lines: Array<{
    description: string;
    cases?: number | null;
    weightKg?: number | null;
    unitPrice: number;
    lineTotal: number;
    taxAmount?: number | null;
  }>;
}

function pdfText(value: string) {
  return value.replace(/[^\x20-\x7e\xa0-\xff]/g, "?").replace(/([\\()])/g, "\\$1");
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

function wrap(text: string, limit: number): string[] {
  const parts = text.trim().replace(/\s+/g, " ").split(" ").flatMap(word => {
    const chunks: string[] = [];
    for (let i = 0; i < word.length; i += limit) chunks.push(word.slice(i, i + limit));
    return chunks;
  });
  const result: string[] = [];
  let line = "";
  for (const part of parts) {
    if (line && line.length + part.length + 1 > limit) {
      result.push(line);
      line = part;
    } else {
      line = line ? `${line} ${part}` : part;
    }
  }
  if (line) result.push(line);
  return result;
}

type Line = { text: string; size: number; y: number; font: "F1" | "F2" | "F3" };

export function renderInvoicePdf(data: InvoicePdfData): Buffer {
  const pages: Line[][] = [];
  let page: Line[];
  let y = 0;
  const invoiceRef = data.invoiceReference ?? `INV-${data.invoiceNumber}`;
  const billingTitle = data.seller ? "FIRM BILLING RECORD" : "GAGAN FOODS - INVOICE";
  const documentTitle = data.voided ? `VOIDED - ${billingTitle}` : billingTitle;

  function write(text: string, size = 9, font: Line["font"] = "F1") {
    page.push({ text, size, y, font });
    y -= Math.max(13, size + 4);
  }
  function startPage() {
    page = [];
    y = 744;
    pages.push(page);
    write(documentTitle, 16, "F2");
    write(data.seller ? data.seller.name : invoiceRef, 12, "F2");
    if (data.seller) write(`Invoice reference: ${invoiceRef}`, 10);
    y -= 8;
  }
  function writeWrapped(text: string) {
    for (const line of wrap(text, 88)) {
      if (y < 58) startPage();
      write(line);
    }
  }
  function tableRow(description: string, cases = "", weight = "", rate = "", gst = "", total = "") {
    return [description.padEnd(35), cases.padStart(6), weight.padStart(8), rate.padStart(12), gst.padStart(11), total.padStart(13)].join(" ");
  }
  function tableHeader() {
    y -= 5;
    write(tableRow("Item description", "Cases", "Kg", "Rate", "Tax", "Total"), 8, "F3");
    write("-".repeat(90), 8, "F3");
  }
  function amountLabel(amount: number) {
    return `${data.currency} ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  startPage();
  if (data.seller?.address) writeWrapped(data.seller.address);
  if (data.seller?.gstin) write(`Issuer GSTIN: ${data.seller.gstin}`);
  write(`Date: ${dateLabel(data.invoiceDate)}    Due date: ${dateLabel(data.dueDate)}`);
  const orderReference = data.companyOrderReference ?? (data.orderNo ? `ORD-${data.orderNo}` : null);
  if (orderReference) write(`Sales order: ${orderReference}`);
  if (data.salespersonName) writeWrapped(`Salesperson: ${data.salespersonName}`);
  if (data.warehouseName) writeWrapped(`Warehouse: ${data.warehouseName}`);
  y -= 8;
  write("Bill to", 10, "F2");
  writeWrapped(data.retailer.name);
  if (data.retailer.address) writeWrapped(data.retailer.address);
  if (data.retailer.deliveryCity) writeWrapped(data.retailer.deliveryCity);
  if (data.retailer.phone) writeWrapped(data.retailer.phone);
  if (data.retailer.gstin) write(`Buyer GSTIN: ${data.retailer.gstin}`);
  if (data.shipTo) {
    y -= 6;
    write("Deliver to", 10, "F2");
    writeWrapped(`${data.shipTo.address}, ${data.shipTo.city}`);
  }

  if (y < 120) startPage();
  tableHeader();
  for (const [itemIndex, item] of data.lines.entries()) {
    const descriptions = wrap(item.description, 35);
    const closingSpace = itemIndex === data.lines.length - 1 ? 124 : 58;
    if (y < closingSpace + 13 * descriptions.length && descriptions.length < 40) {
      startPage();
      tableHeader();
    }
    for (const [index, description] of descriptions.entries()) {
      if (y < 58) {
        startPage();
        tableHeader();
      }
      write(index === 0 ? tableRow(
        description,
        String(item.cases ?? "-"),
        String(item.weightKg ?? "-"),
        item.unitPrice.toFixed(2),
        item.taxAmount == null ? "-" : item.taxAmount.toFixed(2),
        item.lineTotal.toFixed(2),
      ) : tableRow(description), 8, "F3");
    }
  }

  if (y < 124) startPage();
  y -= 10;
  write(`Subtotal: ${amountLabel(data.subtotal)}`, 10);
  write(`Tax: ${amountLabel(data.taxTotal)}`, 10);
  write(`Total: ${amountLabel(data.total)}`, 13, "F2");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${6 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
  ];
  for (const [index, contentLines] of pages.entries()) {
    const content = [
      "BT",
      ...contentLines.map(line => `/${line.font} ${line.size} Tf 1 0 0 1 54 ${line.y} Tm (${pdfText(line.text)}) Tj`),
      `/F1 8 Tf 1 0 0 1 54 30 Tm (Page ${index + 1} of ${pages.length}) Tj`,
      "ET",
      "",
    ].join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${7 + index * 2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`,
    );
  }

  const chunks = ["%PDF-1.4\n"];
  let offset = Buffer.byteLength(chunks[0], "latin1");
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(offset);
    const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`;
    chunks.push(chunk);
    offset += Buffer.byteLength(chunk, "latin1");
  }
  chunks.push(
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
      .map(value => `${String(value).padStart(10, "0")} 00000 n \n`)
      .join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`,
  );
  return Buffer.from(chunks.join(""), "latin1");
}
