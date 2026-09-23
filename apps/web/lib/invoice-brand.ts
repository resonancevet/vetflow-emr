import { ROMA_INVOICE_LOGO_PNG_BASE64 } from "./roma-invoice-logo-base64";

/** Roma Veterinary Care brand colors from the invoice template. */
export const ROMA_TEAL = "#009B8A";
export const ROMA_NAVY = "#003366";
export const ROMA_DARK = "#333333";
export const ROMA_GRAY = "#666666";
export const ROMA_LINE = "#CCCCCC";

export const INVOICE_FONT = "Montserrat";

let fontsReady: Promise<void> | null = null;
const registeredDocs = new WeakSet<object>();

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadFontBase64(fileName: string): Promise<string> {
  if (typeof window === "undefined") {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const candidates = [
      join(process.cwd(), "apps/web/public/fonts", fileName),
      join(process.cwd(), "public/fonts", fileName),
    ];
    let lastErr: unknown;
    for (const path of candidates) {
      try {
        const buf = await readFile(path);
        return buf.toString("base64");
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error(`Could not load font ${fileName}`);
  }

  const res = await fetch(`/fonts/${fileName}`);
  if (!res.ok) throw new Error(`Failed to fetch font ${fileName}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return bytesToBase64(buf);
}

async function ensureFontFilesLoaded(): Promise<{
  regular: string;
  bold: string;
  italic: string;
}> {
  if (!fontsReady) {
    fontsReady = Promise.resolve();
  }
  const [regular, bold, italic] = await Promise.all([
    loadFontBase64("Montserrat-Regular.ttf"),
    loadFontBase64("Montserrat-Bold.ttf"),
    loadFontBase64("Montserrat-Italic.ttf"),
  ]);
  return { regular, bold, italic };
}

/** Register Montserrat on a jsPDF instance (client or server). */
export async function registerInvoiceFonts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any
): Promise<void> {
  if (registeredDocs.has(doc)) return;
  const fonts = await ensureFontFilesLoaded();
  doc.addFileToVFS("Montserrat-Regular.ttf", fonts.regular);
  doc.addFont("Montserrat-Regular.ttf", INVOICE_FONT, "normal");
  doc.addFileToVFS("Montserrat-Bold.ttf", fonts.bold);
  doc.addFont("Montserrat-Bold.ttf", INVOICE_FONT, "bold");
  doc.addFileToVFS("Montserrat-Italic.ttf", fonts.italic);
  doc.addFont("Montserrat-Italic.ttf", INVOICE_FONT, "italic");
  registeredDocs.add(doc);
}

export function romaLogoDataUrl(): string {
  return `data:image/png;base64,${ROMA_INVOICE_LOGO_PNG_BASE64}`;
}
