import jsPDF from "jspdf";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const COLOR_TEAL = "#0d9488";
const COLOR_DARK = "#333333";
const COLOR_GRAY = "#666666";
const COLOR_LIGHT_GRAY = "#eeeeee";
const FONT = "helvetica";
const PAGE_MARGIN = 20; // mm
const PAGE_WIDTH = 210; // A4 / letter approximate usable width
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const FOOTER_RESERVED = 22; // mm — NH Vet 701.01(b)(1)/(b)(2) identifier bar

/** Owner/patient identifiers repeated on every exported record page. */
export interface RecordPageIdentifiers {
  patientName: string;
  microchip?: string;
  clientName: string;
  clientAddress?: string;
  clientPhone?: string;
}

function applyRecordPageFooters(
  doc: jsPDF,
  identifiers: RecordPageIdentifiers,
  options?: { generatedLabel?: string }
) {
  const pageCount = doc.getNumberOfPages();
  const today = new Date().toLocaleDateString();
  const generatedLabel =
    options?.generatedLabel ?? `Generated on ${today} — For reference only`;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    const barY = pageHeight - FOOTER_RESERVED;

    doc.setFont(FONT, "normal");
    doc.setFontSize(7);
    setColor(doc, COLOR_GRAY);

    const ownerParts = [`Owner: ${identifiers.clientName}`];
    if (identifiers.clientAddress) ownerParts.push(identifiers.clientAddress);
    if (identifiers.clientPhone) ownerParts.push(`Ph: ${identifiers.clientPhone}`);
    const ownerLine = doc.splitTextToSize(ownerParts.join(" | "), CONTENT_WIDTH)[0] as string;

    let patientLine = `Patient: ${identifiers.patientName}`;
    if (identifiers.microchip) patientLine += ` | Microchip: ${identifiers.microchip}`;

    doc.text(ownerLine, PAGE_MARGIN, barY);
    doc.text(patientLine, PAGE_MARGIN, barY + 3.5);

    doc.setFont(FONT, "italic");
    doc.setFontSize(7);
    doc.text(generatedLabel, PAGE_WIDTH / 2, barY + 8, { align: "center" });
    doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH - PAGE_MARGIN, barY + 8, {
      align: "right",
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function setColor(doc: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

function drawLine(doc: jsPDF, y: number) {
  const [r, g, b] = hexToRgb(COLOR_LIGHT_GRAY);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
}

/**
 * Check remaining space on page; add a new page if needed.
 * Returns the (potentially reset) y position.
 */
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - FOOTER_RESERVED) {
    doc.addPage();
    return PAGE_MARGIN;
  }
  return y;
}

// ---------------------------------------------------------------------------
// 1. Invoice PDF (Roma Veterinary Care template)
// ---------------------------------------------------------------------------

export interface InvoiceData {
  practiceName: string;
  practiceAddress?: string;
  practicePhone?: string;
  practiceEmail?: string;
  clientName: string;
  clientEmail?: string;
  /** Street line (and/or preformatted full address). */
  clientAddress?: string;
  clientCity?: string;
  clientState?: string;
  clientZip?: string;
  clientDisplayId?: string;
  patientName?: string;
  invoiceNumber?: string | number | null;
  invoiceDate: string;
  dueDate?: string;
  /** When true (or status is paid / balance is 0), Payment Due shows PAID. */
  isPaid?: boolean;
  status: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: string;
    total: string;
  }>;
  subtotal: string;
  tax: string;
  total: string;
  paidAmount: string;
  /** Optional Venmo handle shown as payment instructions. */
  venmoHandle?: string;
}

function moneyToNumber(value: string): number {
  const n = parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Build mailing-address lines from street + city/state/zip. */
export function formatInvoiceAddressLines(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string[] {
  const lines: string[] = [];
  const street = parts.address?.trim();
  if (street) {
    for (const line of street
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)) {
      lines.push(line);
    }
  }
  const cityStateZip = [
    parts.city?.trim(),
    [parts.state?.trim(), parts.zip?.trim()].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  if (cityStateZip) lines.push(cityStateZip);

  // If we only have a single comma-separated address blob (common for practice
  // address), split street vs city/state/zip onto separate lines.
  if (lines.length === 1 && !parts.city && !parts.state && !parts.zip) {
    const only = lines[0]!;
    const match = only.match(
      /^(.+?),?\s+([A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/
    );
    if (match) {
      const streetPart = match[1]!.replace(/,$/, "").trim();
      const cityPart = match[2]!.trim();
      const statePart = match[3]!.trim();
      const zipPart = match[4]!.trim();
      return [`${streetPart},`, `${cityPart}, ${statePart} ${zipPart}`];
    }
  }

  // Ensure trailing comma on street line when followed by city line (Roma layout).
  if (lines.length >= 2 && !lines[0]!.endsWith(",")) {
    const first = lines[0]!;
    // Only add comma for short street lines (not already multi-part)
    if (!first.includes(",") || first.split(",").length <= 2) {
      lines[0] = first.replace(/,$/, "") + ",";
    }
  }

  return lines;
}

/**
 * Roma-branded invoice PDF. Async so Montserrat fonts can load on client/server.
 */
export async function generateInvoicePdf(data: InvoiceData): Promise<jsPDF> {
  const {
    ROMA_TEAL,
    ROMA_NAVY,
    ROMA_DARK,
    ROMA_GRAY,
    ROMA_LINE,
    INVOICE_FONT,
    registerInvoiceFonts,
    romaLogoDataUrl,
  } = await import("./invoice-brand");

  const doc = new jsPDF({ unit: "mm", format: "letter" });
  await registerInvoiceFonts(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 16;

  const setHex = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    doc.setTextColor(r, g, b);
  };
  const drawHexLine = (atY: number, color = ROMA_LINE) => {
    const [r, g, b] = hexToRgb(color);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.3);
    doc.line(margin, atY, pageW - margin, atY);
  };
  const ensureY = (needed: number) => {
    if (y + needed > pageH - 20) {
      doc.addPage();
      y = margin;
    }
  };

  // --- Header: logo + practice name + meta ---------------------------------
  const logoSize = 28;
  try {
    doc.addImage(romaLogoDataUrl(), "PNG", margin, y - 2, logoSize, logoSize);
  } catch {
    // Logo optional if image decode fails
  }

  const headerLeft = margin + logoSize + 6;
  doc.setFont(INVOICE_FONT, "bold");
  doc.setFontSize(18);
  setHex(ROMA_TEAL);
  doc.text(data.practiceName, headerLeft, y + 8);

  const metaX = pageW - margin;
  let metaY = y + 4;
  doc.setFont(INVOICE_FONT, "normal");
  doc.setFontSize(10);
  setHex(ROMA_DARK);

  const invoiceLabel =
    data.invoiceNumber != null && data.invoiceNumber !== ""
      ? String(data.invoiceNumber).padStart(4, "0")
      : "—";
  doc.text(`Invoice:  ${invoiceLabel}`, metaX, metaY, { align: "right" });
  metaY += 5;
  doc.text(`Date:  ${data.invoiceDate}`, metaX, metaY, { align: "right" });
  metaY += 5;

  const totalAmt = moneyToNumber(data.total);
  const paidAmt = moneyToNumber(data.paidAmount);
  const balanceAmt = Math.max(0, totalAmt - paidAmt);
  const showPaid =
    data.isPaid === true ||
    data.status === "paid" ||
    balanceAmt <= 0.009;
  const paymentDue = showPaid ? "PAID" : data.dueDate || "—";
  doc.text(`Payment Due:  ${paymentDue}`, metaX, metaY, { align: "right" });

  y = Math.max(y + logoSize + 4, metaY + 8);

  // --- Bill To (name / client ID / pet on separate readable lines) ----------
  doc.setFont(INVOICE_FONT, "bold");
  doc.setFontSize(11);
  setHex(ROMA_DARK);
  doc.text("Bill To:", margin, y);
  y += 6;

  doc.setFont(INVOICE_FONT, "normal");
  doc.setFontSize(10);
  setHex(ROMA_DARK);

  // Three-column row matching Roma template: Name | Client ID | Pet
  const spaceW = doc.getTextWidth(" ");
  const col1 = margin;
  const col2 = margin + contentW * 0.42;
  const col3 = margin + contentW * 0.68 + 3 * spaceW;
  const nameLines = doc.splitTextToSize(data.clientName || "—", contentW * 0.4);
  const idText = data.clientDisplayId
    ? `Client ID: ${data.clientDisplayId}`
    : "";
  const petText = data.patientName ? `Pet: ${data.patientName}` : "";
  const idLines = idText ? doc.splitTextToSize(idText, contentW * 0.24) : [];
  const petMaxW = Math.max(20, pageW - margin - col3);
  const petLines = petText ? doc.splitTextToSize(petText, petMaxW) : [];
  const billRowLines = Math.max(
    nameLines.length,
    idLines.length || 1,
    petLines.length || 1
  );
  for (let i = 0; i < billRowLines; i++) {
    if (nameLines[i]) doc.text(nameLines[i], col1, y);
    if (idLines[i]) doc.text(idLines[i], col2, y);
    if (petLines[i]) doc.text(petLines[i], col3, y);
    y += 5;
  }

  const addressLines = formatInvoiceAddressLines({
    address: data.clientAddress,
    city: data.clientCity,
    state: data.clientState,
    zip: data.clientZip,
  });
  for (const line of addressLines) {
    const wrapped = doc.splitTextToSize(line, contentW);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5;
  }
  if (data.clientEmail) {
    doc.text(data.clientEmail, margin, y);
    y += 5;
  }
  y += 6;

  // --- Line items table ------------------------------------------------------
  const rowH = 8;
  const [nr, ng, nb] = hexToRgb(ROMA_NAVY);
  doc.setFillColor(nr, ng, nb);
  doc.rect(margin, y, contentW, rowH, "F");
  doc.setFont(INVOICE_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("Description", margin + 3, y + 5.5);
  doc.text("Price", pageW - margin - 3, y + 5.5, { align: "right" });
  y += rowH + 4;

  doc.setFont(INVOICE_FONT, "normal");
  doc.setFontSize(10);
  setHex(ROMA_DARK);
  for (const item of data.items) {
    const desc =
      item.quantity > 1
        ? `${item.description} × ${item.quantity}`
        : item.description;
    const lines = doc.splitTextToSize(desc, contentW - 40);
    const needed = Math.max(6, lines.length * 5);
    ensureY(needed + 4);
    doc.text(lines, margin + 3, y);
    doc.text(item.total, pageW - margin - 3, y, { align: "right" });
    y += needed;
  }

  y += 2;
  drawHexLine(y);
  y += 8;

  // --- Totals ----------------------------------------------------------------
  ensureY(40);
  const totalsLabelX = pageW - margin - 55;
  const totalsValX = pageW - margin;

  doc.setFont(INVOICE_FONT, "normal");
  doc.setFontSize(10);
  setHex(ROMA_DARK);
  doc.text("Subtotal:", totalsLabelX, y);
  doc.text(data.subtotal, totalsValX, y, { align: "right" });
  y += 6;
  doc.text("Tax:", totalsLabelX, y);
  doc.text(data.tax, totalsValX, y, { align: "right" });
  y += 4;
  drawHexLine(y);
  y += 7;

  doc.setFont(INVOICE_FONT, "bold");
  doc.setFontSize(11);
  setHex(ROMA_DARK);
  doc.text("Total:", totalsLabelX, y);
  doc.text(data.total, totalsValX, y, { align: "right" });
  y += 6;

  doc.setFont(INVOICE_FONT, "normal");
  doc.setFontSize(10);
  doc.text("Paid:", totalsLabelX, y);
  doc.text(data.paidAmount, totalsValX, y, { align: "right" });
  y += 6;

  doc.setFont(INVOICE_FONT, "bold");
  doc.setFontSize(11);
  setHex(ROMA_TEAL);
  doc.text("Balance Due:", totalsLabelX, y);
  doc.text(`$${balanceAmt.toFixed(2)}`, totalsValX, y, { align: "right" });
  y += 14;

  // --- Pay by Mail / Venmo ---------------------------------------------------
  // Keep practice name, street, and city/state/zip on separate lines.
  const practiceAddrLines = formatInvoiceAddressLines({
    address: data.practiceAddress,
  });
  const mailBodyLines = [
    data.practiceName?.trim(),
    ...practiceAddrLines,
  ].filter(Boolean) as string[];

  const mailHeightEstimate = Math.max(16, mailBodyLines.length * 5 + 10);
  ensureY(mailHeightEstimate + 22);

  const colW = contentW / 2 - 6;
  doc.setFont(INVOICE_FONT, "normal");
  doc.setFontSize(10);
  // Half-page column starts at margin+colW+8; shift Venmo 18 character-spaces left.
  const spaceWPay = doc.getTextWidth(" ");
  const venmoX = margin + colW + 8 - 18 * spaceWPay;

  doc.setFont(INVOICE_FONT, "bold");
  doc.setFontSize(10);
  setHex(ROMA_DARK);
  doc.text("Pay by Mail", margin, y);
  doc.text("Pay via Venmo", venmoX, y);
  y += 6;

  const bodyStartY = y;
  doc.setFont(INVOICE_FONT, "normal");
  doc.setFontSize(10);
  setHex(ROMA_DARK);

  let mailY = bodyStartY;
  if (mailBodyLines.length === 0) {
    doc.text("—", margin, mailY);
    mailY += 5;
  } else {
    // Draw each address line separately (do not reflow into one paragraph).
    for (const line of mailBodyLines) {
      doc.text(String(line), margin, mailY);
      mailY += 5;
    }
  }

  const venmoValue = data.venmoHandle?.trim() || "—";
  doc.text(venmoValue, venmoX, bodyStartY);

  y = Math.max(mailY, bodyStartY + 5) + 14;

  // --- Thank you (after payment block, never overlapping it) -----------------
  ensureY(12);
  const thanksPet = data.patientName?.trim() || "your pet";
  doc.setFont(INVOICE_FONT, "italic");
  doc.setFontSize(11);
  setHex(ROMA_TEAL);
  doc.text(
    `Thank you for trusting me with ${thanksPet}'s Care!`,
    pageW / 2,
    y,
    { align: "center" }
  );

  return doc;
}

// ---------------------------------------------------------------------------
// 2. Prescription Label PDF
// ---------------------------------------------------------------------------

export interface PrescriptionLabelData {
  practiceName: string;
  practicePhone?: string;
  patientName: string;
  clientName: string;
  species: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  prescribedBy: string;
  startDate: string;
  quantity?: string;
  refillsRemaining?: number;
}

export function generatePrescriptionLabelPdf(
  data: PrescriptionLabelData
): jsPDF {
  // 4" x 2" landscape at 72 DPI  ➜  288 x 144 points
  const doc = new jsPDF({ format: [144, 288], orientation: "landscape" });

  // Convert points to mm for internal use (1 pt = 0.3528 mm)
  const W = 288 * 0.3528; // ~101.6 mm
  const H = 144 * 0.3528; // ~50.8 mm
  const M = 4; // margin in mm
  let y = M + 3;

  // Practice info
  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  setColor(doc, COLOR_TEAL);
  doc.text(data.practiceName, W / 2, y, { align: "center" });
  y += 3.5;

  if (data.practicePhone) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(7);
    setColor(doc, COLOR_GRAY);
    doc.text(data.practicePhone, W / 2, y, { align: "center" });
    y += 3;
  }

  // Divider
  const [lr, lg, lb] = hexToRgb(COLOR_LIGHT_GRAY);
  doc.setDrawColor(lr, lg, lb);
  doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y);
  y += 3;

  // Patient / Client
  doc.setFont(FONT, "normal");
  doc.setFontSize(7);
  setColor(doc, COLOR_DARK);
  doc.text(`Patient: ${data.patientName} (${data.species})`, M, y);
  doc.text(`Owner: ${data.clientName}`, W - M, y, { align: "right" });
  y += 4;

  // Medication (bold, larger)
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);
  doc.text(data.medicationName, M, y);
  y += 4;

  // Dosage & frequency
  doc.setFontSize(8);
  doc.text(`${data.dosage}  —  ${data.frequency}`, M, y);
  y += 4;

  // Instructions
  if (data.instructions) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(7);
    setColor(doc, COLOR_DARK);
    const lines = doc.splitTextToSize(data.instructions, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 3;
  }

  y += 1;

  // Prescriber & date
  doc.setFont(FONT, "normal");
  doc.setFontSize(6.5);
  setColor(doc, COLOR_GRAY);
  doc.text(`Prescribed by: ${data.prescribedBy}`, M, y);
  doc.text(`Date: ${data.startDate}`, W - M, y, { align: "right" });
  y += 3;

  // Quantity & refills
  const extras: string[] = [];
  if (data.quantity) extras.push(`Qty: ${data.quantity}`);
  if (data.refillsRemaining !== undefined)
    extras.push(`Refills: ${data.refillsRemaining}`);
  if (extras.length > 0) {
    doc.text(extras.join("   |   "), M, y);
  }

  return doc;
}

// ---------------------------------------------------------------------------
// 3. Medical Record Summary PDF
// ---------------------------------------------------------------------------

export interface MedicalSummaryData {
  practiceName: string;
  practiceAddress?: string;
  practicePhone?: string;
  patientName: string;
  species: string;
  breed?: string;
  sex?: string;
  dob?: string;
  color?: string;
  microchip?: string;
  clientName: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  allergies: Array<{ allergen: string; severity: string }>;
  problems: Array<{ description: string; status: string; onsetDate?: string }>;
  vaccinations: Array<{ name: string; date: string; nextDue?: string }>;
  recentNotes: Array<{
    date: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  }>;
  prescriptions: Array<{
    medication: string;
    dosage: string;
    frequency: string;
    status: string;
  }>;
}

export function generateMedicalSummaryPdf(data: MedicalSummaryData): jsPDF {
  const doc = new jsPDF();
  let y = PAGE_MARGIN;

  // ---- Helper: section heading ---------------------------------------------
  function sectionHeading(title: string) {
    y = ensureSpace(doc, y, 16);
    y += 4;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_TEAL);
    doc.text(title, PAGE_MARGIN, y);
    y += 2;
    const [r, g, b] = hexToRgb(COLOR_TEAL);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.5);
    doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
    y += 6;
  }

  // ---- Header ---------------------------------------------------------------
  doc.setFont(FONT, "bold");
  doc.setFontSize(20);
  setColor(doc, COLOR_TEAL);
  doc.text(data.practiceName, PAGE_MARGIN, y);
  y += 7;

  doc.setFont(FONT, "normal");
  doc.setFontSize(9);
  setColor(doc, COLOR_GRAY);
  if (data.practiceAddress) {
    doc.text(data.practiceAddress, PAGE_MARGIN, y);
    y += 4;
  }
  if (data.practicePhone) {
    doc.text(data.practicePhone, PAGE_MARGIN, y);
    y += 4;
  }

  // Title
  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  setColor(doc, COLOR_DARK);
  doc.text("MEDICAL RECORD SUMMARY", PAGE_WIDTH - PAGE_MARGIN, PAGE_MARGIN, {
    align: "right",
  });

  y = Math.max(y, PAGE_MARGIN + 14) + 4;
  drawLine(doc, y);
  y += 8;

  // ---- Patient Info ---------------------------------------------------------
  sectionHeading("Patient Information");

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);

  const patientFields: [string, string | undefined][] = [
    ["Name", data.patientName],
    ["Species", data.species],
    ["Breed", data.breed],
    ["Sex", data.sex],
    ["Date of Birth", data.dob],
    ["Color", data.color],
    ["Microchip", data.microchip],
  ];

  const colMid = PAGE_MARGIN + CONTENT_WIDTH / 2;
  let col = 0;
  for (const [label, value] of patientFields) {
    if (value === undefined) continue;
    const xPos = col === 0 ? PAGE_MARGIN : colMid;
    doc.setFont(FONT, "bold");
    doc.text(`${label}: `, xPos, y);
    const labelW = doc.getTextWidth(`${label}: `);
    doc.setFont(FONT, "normal");
    doc.text(value, xPos + labelW, y);
    col++;
    if (col === 2) {
      col = 0;
      y += 6;
    }
  }
  if (col !== 0) y += 6;

  // ---- Owner Info -----------------------------------------------------------
  sectionHeading("Owner Information");

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setColor(doc, COLOR_DARK);

  doc.setFont(FONT, "bold");
  doc.text("Name: ", PAGE_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.text(data.clientName, PAGE_MARGIN + doc.getTextWidth("Name: "), y);
  y += 6;

  if (data.clientAddress) {
    doc.setFont(FONT, "bold");
    doc.text("Address: ", PAGE_MARGIN, y);
    doc.setFont(FONT, "normal");
    const addrLines = doc.splitTextToSize(
      data.clientAddress,
      CONTENT_WIDTH - doc.getTextWidth("Address: ")
    );
    doc.text(addrLines, PAGE_MARGIN + doc.getTextWidth("Address: "), y);
    y += addrLines.length * 5 + 2;
  }
  if (data.clientPhone) {
    doc.setFont(FONT, "bold");
    doc.text("Phone: ", PAGE_MARGIN, y);
    doc.setFont(FONT, "normal");
    doc.text(
      data.clientPhone,
      PAGE_MARGIN + doc.getTextWidth("Phone: "),
      y
    );
    y += 6;
  }
  if (data.clientEmail) {
    doc.setFont(FONT, "bold");
    doc.text("Email: ", PAGE_MARGIN, y);
    doc.setFont(FONT, "normal");
    doc.text(
      data.clientEmail,
      PAGE_MARGIN + doc.getTextWidth("Email: "),
      y
    );
    y += 6;
  }

  // ---- Allergies ------------------------------------------------------------
  if (data.allergies.length > 0) {
    sectionHeading("Allergies");

    doc.setFontSize(10);
    for (const allergy of data.allergies) {
      y = ensureSpace(doc, y, 8);
      // Highlight background for allergies
      const [ar, ag, ab] = hexToRgb("#fef2f2"); // light red
      doc.setFillColor(ar, ag, ab);
      doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 7, "F");

      doc.setFont(FONT, "bold");
      setColor(doc, "#dc2626");
      doc.text(allergy.allergen, PAGE_MARGIN + 2, y);
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_GRAY);
      doc.text(`(${allergy.severity})`, PAGE_MARGIN + 2 + doc.getTextWidth(allergy.allergen + " "), y);
      y += 8;
    }
  }

  // ---- Active Problems ------------------------------------------------------
  if (data.problems.length > 0) {
    sectionHeading("Active Problems");

    doc.setFontSize(10);
    for (const problem of data.problems) {
      y = ensureSpace(doc, y, 8);
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_DARK);
      let text = `• ${problem.description}`;
      if (problem.onsetDate) text += ` (onset: ${problem.onsetDate})`;
      doc.text(text, PAGE_MARGIN + 2, y);
      doc.setFont(FONT, "italic");
      setColor(doc, COLOR_GRAY);
      doc.text(`[${problem.status}]`, PAGE_WIDTH - PAGE_MARGIN, y, {
        align: "right",
      });
      y += 6;
    }
  }

  // ---- Vaccination History --------------------------------------------------
  if (data.vaccinations.length > 0) {
    sectionHeading("Vaccination History");

    // Table header
    const vColName = PAGE_MARGIN;
    const vColDate = PAGE_MARGIN + CONTENT_WIDTH * 0.5;
    const vColNext = PAGE_WIDTH - PAGE_MARGIN;

    const [lr, lg, lb] = hexToRgb(COLOR_LIGHT_GRAY);
    doc.setFillColor(lr, lg, lb);
    doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 8, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    setColor(doc, COLOR_DARK);
    doc.text("Vaccine", vColName + 2, y);
    doc.text("Date Given", vColDate, y);
    doc.text("Next Due", vColNext - 2, y, { align: "right" });
    y += 8;

    doc.setFont(FONT, "normal");
    for (const vax of data.vaccinations) {
      y = ensureSpace(doc, y, 7);
      setColor(doc, COLOR_DARK);
      doc.text(vax.name, vColName + 2, y);
      doc.text(vax.date, vColDate, y);
      setColor(doc, COLOR_GRAY);
      doc.text(vax.nextDue ?? "—", vColNext - 2, y, { align: "right" });
      y += 6;
    }
  }

  // ---- Recent SOAP Notes ----------------------------------------------------
  if (data.recentNotes.length > 0) {
    sectionHeading("Recent SOAP Notes");

    const notesToShow = data.recentNotes.slice(0, 5);
    for (const note of notesToShow) {
      y = ensureSpace(doc, y, 30);

      doc.setFont(FONT, "bold");
      doc.setFontSize(10);
      setColor(doc, COLOR_DARK);
      doc.text(note.date, PAGE_MARGIN, y);
      y += 6;

      doc.setFontSize(9);
      const soapSections: [string, string | undefined][] = [
        ["S: ", note.subjective],
        ["O: ", note.objective],
        ["A: ", note.assessment],
        ["P: ", note.plan],
      ];

      for (const [prefix, content] of soapSections) {
        if (!content) continue;
        y = ensureSpace(doc, y, 10);
        doc.setFont(FONT, "bold");
        setColor(doc, COLOR_TEAL);
        doc.text(prefix, PAGE_MARGIN + 4, y);
        doc.setFont(FONT, "normal");
        setColor(doc, COLOR_DARK);
        const lines = doc.splitTextToSize(content, CONTENT_WIDTH - 14);
        doc.text(lines, PAGE_MARGIN + 14, y);
        y += lines.length * 4 + 2;
      }

      y += 4;
      drawLine(doc, y);
      y += 4;
    }
  }

  // ---- Current Prescriptions ------------------------------------------------
  if (data.prescriptions.length > 0) {
    sectionHeading("Current Prescriptions");

    // Table header
    const pColMed = PAGE_MARGIN;
    const pColDose = PAGE_MARGIN + CONTENT_WIDTH * 0.35;
    const pColFreq = PAGE_MARGIN + CONTENT_WIDTH * 0.6;
    const pColStat = PAGE_WIDTH - PAGE_MARGIN;

    const [lr2, lg2, lb2] = hexToRgb(COLOR_LIGHT_GRAY);
    doc.setFillColor(lr2, lg2, lb2);
    doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, 8, "F");
    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    setColor(doc, COLOR_DARK);
    doc.text("Medication", pColMed + 2, y);
    doc.text("Dosage", pColDose, y);
    doc.text("Frequency", pColFreq, y);
    doc.text("Status", pColStat - 2, y, { align: "right" });
    y += 8;

    doc.setFont(FONT, "normal");
    for (const rx of data.prescriptions) {
      y = ensureSpace(doc, y, 7);
      setColor(doc, COLOR_DARK);
      doc.text(rx.medication, pColMed + 2, y);
      doc.text(rx.dosage, pColDose, y);
      doc.text(rx.frequency, pColFreq, y);
      setColor(doc, COLOR_GRAY);
      doc.text(rx.status, pColStat - 2, y, { align: "right" });
      y += 6;
    }
  }

  applyRecordPageFooters(doc, {
    patientName: data.patientName,
    microchip: data.microchip,
    clientName: data.clientName,
    clientAddress: data.clientAddress,
    clientPhone: data.clientPhone,
  });

  return doc;
}

// ---------------------------------------------------------------------------
// 4. Discharge Instructions
// ---------------------------------------------------------------------------

export interface DischargeInstructionsData {
  practiceName: string;
  practicePhone?: string;
  patientName: string;
  species: string;
  microchip?: string;
  clientName: string;
  clientAddress?: string;
  clientPhone?: string;
  visitDate: string;
  doctorName?: string;
  diagnosis?: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    instructions?: string;
  }>;
  instructions: string[];
  followUpDate?: string;
  followUpNotes?: string;
  restrictions?: string[];
  emergencyNotes?: string;
}

export function generateDischargeInstructions(
  data: DischargeInstructionsData
): jsPDF {
  const doc = new jsPDF();
  let y = PAGE_MARGIN;

  // Header
  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  setColor(doc, COLOR_TEAL);
  doc.text(data.practiceName || "Veterinary Practice", PAGE_MARGIN, y);
  y += 6;

  if (data.practicePhone) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    setColor(doc, COLOR_GRAY);
    doc.text(data.practicePhone, PAGE_MARGIN, y);
    y += 4;
  }
  y += 4;

  // Title
  doc.setFont(FONT, "bold");
  doc.setFontSize(18);
  setColor(doc, COLOR_DARK);
  doc.text("DISCHARGE INSTRUCTIONS", PAGE_MARGIN, y);
  y += 10;
  drawLine(doc, y);
  y += 8;

  // Patient & Visit Info
  doc.setFontSize(10);
  doc.setFont(FONT, "bold");
  setColor(doc, COLOR_DARK);
  doc.text("Patient:", PAGE_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.text(`${data.patientName} (${data.species})`, PAGE_MARGIN + 22, y);

  doc.setFont(FONT, "bold");
  doc.text("Owner:", PAGE_WIDTH / 2, y);
  doc.setFont(FONT, "normal");
  doc.text(data.clientName, PAGE_WIDTH / 2 + 20, y);
  y += 6;

  doc.setFont(FONT, "bold");
  doc.text("Visit Date:", PAGE_MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.text(data.visitDate, PAGE_MARGIN + 28, y);

  if (data.doctorName) {
    doc.setFont(FONT, "bold");
    doc.text("Doctor:", PAGE_WIDTH / 2, y);
    doc.setFont(FONT, "normal");
    doc.text(data.doctorName, PAGE_WIDTH / 2 + 20, y);
  }
  y += 10;

  // Diagnosis
  if (data.diagnosis) {
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text("Diagnosis", PAGE_MARGIN, y);
    y += 6;
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    const diagLines = doc.splitTextToSize(data.diagnosis, CONTENT_WIDTH);
    doc.text(diagLines, PAGE_MARGIN, y);
    y += diagLines.length * 5 + 6;
  }

  // Medications
  if (data.medications.length > 0) {
    y = ensureSpace(doc, y, 30);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text("Medications", PAGE_MARGIN, y);
    y += 8;

    for (const med of data.medications) {
      y = ensureSpace(doc, y, 20);
      doc.setFont(FONT, "bold");
      doc.setFontSize(10);
      doc.text(`${med.name} — ${med.dosage}`, PAGE_MARGIN + 4, y);
      y += 5;
      doc.setFont(FONT, "normal");
      setColor(doc, COLOR_GRAY);
      doc.text(`Frequency: ${med.frequency}`, PAGE_MARGIN + 4, y);
      y += 5;
      if (med.instructions) {
        const instrLines = doc.splitTextToSize(med.instructions, CONTENT_WIDTH - 8);
        setColor(doc, COLOR_DARK);
        doc.text(instrLines, PAGE_MARGIN + 4, y);
        y += instrLines.length * 5;
      }
      y += 4;
    }
  }

  // Care Instructions
  if (data.instructions.length > 0) {
    y = ensureSpace(doc, y, 20);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text("Care Instructions", PAGE_MARGIN, y);
    y += 8;

    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    for (const instruction of data.instructions) {
      y = ensureSpace(doc, y, 10);
      const lines = doc.splitTextToSize(`• ${instruction}`, CONTENT_WIDTH - 4);
      doc.text(lines, PAGE_MARGIN + 4, y);
      y += lines.length * 5 + 2;
    }
    y += 4;
  }

  // Restrictions
  if (data.restrictions && data.restrictions.length > 0) {
    y = ensureSpace(doc, y, 20);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text("Restrictions", PAGE_MARGIN, y);
    y += 8;

    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    for (const restriction of data.restrictions) {
      y = ensureSpace(doc, y, 10);
      const lines = doc.splitTextToSize(`• ${restriction}`, CONTENT_WIDTH - 4);
      doc.text(lines, PAGE_MARGIN + 4, y);
      y += lines.length * 5 + 2;
    }
    y += 4;
  }

  // Follow-up
  if (data.followUpDate || data.followUpNotes) {
    y = ensureSpace(doc, y, 20);
    drawLine(doc, y);
    y += 6;
    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    setColor(doc, COLOR_DARK);
    doc.text("Follow-Up", PAGE_MARGIN, y);
    y += 7;

    doc.setFontSize(10);
    if (data.followUpDate) {
      doc.setFont(FONT, "bold");
      doc.text("Scheduled:", PAGE_MARGIN + 4, y);
      doc.setFont(FONT, "normal");
      doc.text(data.followUpDate, PAGE_MARGIN + 30, y);
      y += 6;
    }
    if (data.followUpNotes) {
      doc.setFont(FONT, "normal");
      const lines = doc.splitTextToSize(data.followUpNotes, CONTENT_WIDTH - 8);
      doc.text(lines, PAGE_MARGIN + 4, y);
      y += lines.length * 5;
    }
    y += 6;
  }

  // Emergency notes
  if (data.emergencyNotes) {
    y = ensureSpace(doc, y, 25);
    drawLine(doc, y);
    y += 6;
    const [r, g, b] = hexToRgb("#dc2626");
    doc.setTextColor(r, g, b);
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    doc.text("WHEN TO SEEK EMERGENCY CARE", PAGE_MARGIN, y);
    y += 7;
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    setColor(doc, COLOR_DARK);
    const emergLines = doc.splitTextToSize(data.emergencyNotes, CONTENT_WIDTH);
    doc.text(emergLines, PAGE_MARGIN, y);
  }

  applyRecordPageFooters(
    doc,
    {
      patientName: data.patientName,
      microchip: data.microchip,
      clientName: data.clientName,
      clientAddress: data.clientAddress,
      clientPhone: data.clientPhone,
    },
    {
      generatedLabel: data.practicePhone
        ? `Questions? Call ${data.practicePhone}`
        : "If you have questions, contact our office.",
    }
  );

  return doc;
}
