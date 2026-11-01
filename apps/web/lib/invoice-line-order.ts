import {
  isLineCreditDiscount,
  isPromptPaymentDiscount,
} from "@/lib/line-credit";

export type OrderableInvoiceItem = {
  id: string;
  itemType: string;
  discountKind?: string | null;
  linkedItemId?: string | null;
};

/**
 * Order invoice lines for client-facing display:
 * each product/service line, then its linked line credits, then
 * orphan credits, then prompt-payment discounts at the end.
 */
export function orderInvoiceItemsForDisplay<T extends OrderableInvoiceItem>(
  items: T[]
): T[] {
  const creditsByLinked = new Map<string, T[]>();
  const promptPayments: T[] = [];
  const positives: T[] = [];
  const orphanCredits: T[] = [];

  for (const item of items) {
    if (isLineCreditDiscount(item)) {
      if (item.linkedItemId) {
        const list = creditsByLinked.get(item.linkedItemId) ?? [];
        list.push(item);
        creditsByLinked.set(item.linkedItemId, list);
      } else {
        orphanCredits.push(item);
      }
      continue;
    }
    if (isPromptPaymentDiscount(item)) {
      promptPayments.push(item);
      continue;
    }
    positives.push(item);
  }

  const ordered: T[] = [];
  for (const item of positives) {
    ordered.push(item);
    const credits = creditsByLinked.get(item.id);
    if (credits?.length) {
      ordered.push(...credits);
      creditsByLinked.delete(item.id);
    }
  }

  for (const leftover of creditsByLinked.values()) {
    ordered.push(...leftover);
  }
  ordered.push(...orphanCredits);
  ordered.push(...promptPayments);
  return ordered;
}

type PdfSourceItem = OrderableInvoiceItem & {
  description: string | null;
  quantity: number | null;
  unitPrice: string;
  total: string;
};

export type InvoicePdfLineItem = {
  description: string;
  quantity: number;
  unitPrice: string;
  total: string;
  /** Indent under the related charge line on the PDF. */
  isLineCredit?: boolean;
};

/** Build PDF line items with credits nested under their linked charges. */
export function buildInvoicePdfItems(
  items: PdfSourceItem[],
  formatMoney: (value: string | number) => string
): InvoicePdfLineItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = orderInvoiceItemsForDisplay(items);

  return ordered.map((item) => {
    const isCredit = isLineCreditDiscount(item);
    let description = item.description?.trim() || "—";
    if (isCredit && item.linkedItemId) {
      const parent = byId.get(item.linkedItemId);
      const parentName = parent?.description?.trim();
      // Keep association clear even if a credit ends up separated from its parent.
      if (parentName && !description.toLowerCase().includes(parentName.toLowerCase())) {
        description = `${description} — ${parentName}`;
      }
    }

    return {
      description,
      quantity: Number(item.quantity ?? 1),
      unitPrice: formatMoney(item.unitPrice),
      total: formatMoney(item.total),
      isLineCredit: isCredit || undefined,
    };
  });
}
