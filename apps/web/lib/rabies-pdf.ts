import jsPDF from "jspdf";

const FONT = "helvetica";
const MARGIN = 18;
const PAGE_W = 216; // letter width mm approx used by jsPDF letter
const COLOR_DARK = "#1a1a1a";
const COLOR_GRAY = "#555555";
const COLOR_NAVY = "#1e3a5f";

function setHex(doc: jsPDF, hex: string) {
  const h = hex.replace("#", "");
  doc.setTextColor(
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16)
  );
}

export type RabiesCertificateData = {
  practiceName: string;
  practiceAddress?: string;
  practicePhone?: string;
  clientName: string;
  clientAddress?: string;
  clientCityStateZip?: string;
  patientName: string;
  breed?: string;
  sex?: string;
  color?: string;
  age?: string;
  weight?: string;
  tagNumber: string;
  vaccinationDate: string;
  nextDueDate?: string;
  veterinarianName: string;
  licenseNumber?: string;
  manufacturer?: string;
  lotNumber?: string;
  lotExpiration?: string;
  administrationSite?: string;
};

function formatSexLabel(sex?: string | null): string {
  switch (sex) {
    case "male":
      return "Male";
    case "female":
      return "Female";
    case "male_neutered":
      return "Male-Neutered";
    case "female_spayed":
      return "Female-Spayed";
    default:
      return sex?.trim() || "—";
  }
}

/** Roma-style Certificate of Vaccination (rabies). */
export function generateRabiesCertificatePdf(
  data: RabiesCertificateData
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - MARGIN * 2;
  let y = MARGIN;

  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  setHex(doc, COLOR_NAVY);
  doc.text("CERTIFICATE OF VACCINATION", pageW / 2, y, { align: "center" });
  y += 10;

  doc.setFont(FONT, "normal");
  doc.setFontSize(11);
  setHex(doc, COLOR_DARK);
  doc.text(`Date of Rabies Vaccination: ${data.vaccinationDate}`, MARGIN, y);
  y += 6;
  doc.text(
    `Next Rabies Vaccination On: ${data.nextDueDate?.trim() || "—"}`,
    MARGIN,
    y
  );
  y += 10;

  const colMid = pageW / 2;
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  setHex(doc, COLOR_NAVY);
  doc.text("VETERINARY CLINIC", MARGIN, y);
  doc.text("OWNER OF ANIMAL", colMid + 4, y);
  y += 5;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setHex(doc, COLOR_DARK);
  const clinicLines = [
    data.practiceName,
    data.practiceAddress,
    data.practicePhone,
  ].filter(Boolean) as string[];
  const ownerLines = [
    data.clientName,
    data.clientAddress,
    data.clientCityStateZip,
  ].filter(Boolean) as string[];

  const leftStart = y;
  let leftY = y;
  for (const line of clinicLines) {
    const wrapped = doc.splitTextToSize(line, contentW / 2 - 6);
    doc.text(wrapped, MARGIN, leftY);
    leftY += wrapped.length * 5;
  }
  let rightY = leftStart;
  for (const line of ownerLines) {
    const wrapped = doc.splitTextToSize(line, contentW / 2 - 6);
    doc.text(wrapped, colMid + 4, rightY);
    rightY += wrapped.length * 5;
  }
  y = Math.max(leftY, rightY) + 8;

  doc.setFont(FONT, "italic");
  doc.setFontSize(10);
  setHex(doc, COLOR_GRAY);
  doc.text("This is to certify…", MARGIN, y);
  y += 5;
  doc.setFont(FONT, "bold");
  setHex(doc, COLOR_DARK);
  doc.text(
    "THAT I HAVE VACCINATED AGAINST RABIES THE ANIMAL DESCRIBED BELOW.",
    MARGIN,
    y
  );
  y += 10;

  const rows: Array<[string, string]> = [
    ["PATIENT:", data.patientName],
    ["BREED:", data.breed?.trim() || "—"],
    ["SEX:", formatSexLabel(data.sex)],
    ["COLOR:", data.color?.trim() || "—"],
    ["AGE:", data.age?.trim() || "—"],
    ["WEIGHT:", data.weight?.trim() || "—"],
    ["RABIES TAG:", data.tagNumber],
  ];
  doc.setFontSize(11);
  for (const [label, value] of rows) {
    doc.setFont(FONT, "bold");
    doc.text(label, MARGIN, y);
    doc.setFont(FONT, "normal");
    doc.text(value, MARGIN + 38, y);
    y += 6;
  }

  y += 8;
  doc.setFont(FONT, "normal");
  doc.text("Signed __________________________________________", MARGIN, y);
  y += 7;
  doc.setFont(FONT, "bold");
  doc.text(data.veterinarianName || "—", MARGIN, y);
  doc.setFont(FONT, "normal");
  doc.text(
    `License#: ${data.licenseNumber?.trim() || "—"}`,
    MARGIN + 70,
    y
  );
  y += 12;

  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  setHex(doc, COLOR_NAVY);
  doc.text("Rabies Vaccine Information:", MARGIN, y);
  y += 6;
  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setHex(doc, COLOR_DARK);
  doc.text(`MFG BY: ${data.manufacturer?.trim() || "—"}`, MARGIN, y);
  y += 5;
  doc.text(`SER.NO / LOT: ${data.lotNumber?.trim() || "—"}`, MARGIN, y);
  y += 5;
  doc.text(`LOT EXP: ${data.lotExpiration?.trim() || "—"}`, MARGIN, y);
  y += 5;
  doc.text(`ADM: ${data.administrationSite?.trim() || "—"}`, MARGIN, y);

  return doc;
}

export type RabiesSwornStatementData = {
  practiceName?: string;
  ownerName?: string;
  patientName?: string;
};

/** NH-style sworn statement blank for same-day owner attestation. */
export function generateRabiesSwornStatementPdf(
  data: RabiesSwornStatementData = {}
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = MARGIN + 4;

  doc.setFont(FONT, "bold");
  doc.setFontSize(16);
  setHex(doc, COLOR_NAVY);
  doc.text("Rabies Vaccination Sworn Statement", pageW / 2, y, {
    align: "center",
  });
  y += 12;

  if (data.practiceName?.trim()) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    setHex(doc, COLOR_GRAY);
    doc.text(data.practiceName.trim(), pageW / 2, y, { align: "center" });
    y += 8;
  }

  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  setHex(doc, COLOR_DARK);
  doc.text("I.", MARGIN, y);
  doc.setFont(FONT, "normal");
  const intro =
    "Before vaccinating any dog, cat, or ferret for rabies, the veterinarian shall receive the following statement completed by the dog's, cat's, or ferret's owner in the veterinarian's presence on the same day:";
  const introLines = doc.splitTextToSize(intro, pageW - MARGIN * 2 - 8);
  doc.text(introLines, MARGIN + 8, y);
  y += introLines.length * 5 + 8;

  const ownerBlank = data.ownerName?.trim()
    ? data.ownerName.trim()
    : "_______________________________________________________";
  const swear = `I, ${ownerBlank} (owner's name), swear that to my knowledge this dog, cat, or ferret${
    data.patientName?.trim() ? ` (${data.patientName.trim()})` : ""
  } has not bitten anyone within 10 days. The veterinarian shall retain the statement in the veterinarian's files until the dog's, cat's, or ferret's next vaccination.`;
  const swearLines = doc.splitTextToSize(swear, pageW - MARGIN * 2);
  doc.text(swearLines, MARGIN, y);
  y += swearLines.length * 5 + 10;

  doc.setFont(FONT, "bold");
  doc.text("II.", MARGIN, y);
  doc.setFont(FONT, "normal");
  const penalty =
    "Any owner who submits a false statement shall be guilty of a misdemeanor.";
  const penaltyLines = doc.splitTextToSize(penalty, pageW - MARGIN * 2 - 8);
  doc.text(penaltyLines, MARGIN + 8, y);
  y += penaltyLines.length * 5 + 16;

  doc.text("Owner signature: ________________________________", MARGIN, y);
  y += 8;
  doc.text("Date: ____________________", MARGIN, y);
  y += 8;
  doc.text("Veterinarian / witness: ____________________________", MARGIN, y);

  return doc;
}

export { formatSexLabel };
