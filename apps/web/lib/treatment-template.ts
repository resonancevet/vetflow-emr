import { chargePriceEach } from "@/lib/inventory-price";
import { planDisplayName } from "@/lib/plan-name";

export const TEMPLATE_ITEM_TYPES = ["product", "service", "kit"] as const;
export type TemplateItemType = (typeof TEMPLATE_ITEM_TYPES)[number];

export type InvoiceLineFromTemplate = {
  description: string;
  quantity: number;
  unitPrice: string;
  itemType: "service" | "product";
  itemId?: string;
};

export type KitForTemplate = {
  id: string;
  name: string;
  planName?: string | null;
  kind?: string | null;
  isActive?: boolean;
  items: Array<{
    productId: string;
    quantity: number;
    productName: string;
    productPlanName?: string | null;
    unitPrice?: string | number | null;
    costPrice?: string | number | null;
  }>;
};

export function kitDisplayName(kit: {
  name: string;
  planName?: string | null;
}): string {
  return planDisplayName(kit.planName, kit.name);
}

/** Inventory kit name for Settings / template pickers (not the SOAP plan label). */
export function kitInventoryName(kit: { name: string }): string {
  return kit.name.trim();
}

export function kitChargeTotal(kit: KitForTemplate): string {
  const total = kit.items.reduce((sum, item) => {
    const each = parseFloat(
      chargePriceEach({
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
      })
    );
    return sum + each * item.quantity;
  }, 0);
  return total.toFixed(2);
}

export function expandTemplateItem(
  item: {
    itemType: string;
    itemId?: string | null;
    description: string;
    defaultQuantity: number;
    defaultUnitPrice: string;
  },
  kits: KitForTemplate[]
): InvoiceLineFromTemplate[] {
  if (item.itemType !== "kit") {
    return [
      {
        description: item.description,
        quantity: item.defaultQuantity,
        unitPrice: item.defaultUnitPrice,
        itemType: item.itemType === "service" ? "service" : "product",
        itemId: item.itemId ?? undefined,
      },
    ];
  }

  const kit = kits.find((row) => row.id === item.itemId);
  if (!kit || kit.items.length === 0) {
    return [
      {
        description: kit ? kitDisplayName(kit) : item.description,
        quantity: item.defaultQuantity,
        unitPrice: item.defaultUnitPrice,
        itemType: "product",
      },
    ];
  }

  const multiplier = Math.max(1, item.defaultQuantity);
  return kit.items.map((kitItem) => ({
    description:
      planDisplayName(kitItem.productPlanName, kitItem.productName) ||
      kitDisplayName(kit) ||
      item.description,
    quantity: kitItem.quantity * multiplier,
    unitPrice: chargePriceEach({
      unitPrice: kitItem.unitPrice,
      costPrice: kitItem.costPrice,
    }),
    itemType: "product" as const,
    itemId: kitItem.productId,
  }));
}

export function expandTemplateItems(
  items: Array<{
    itemType: string;
    itemId?: string | null;
    description: string;
    defaultQuantity: number;
    defaultUnitPrice: string;
  }>,
  kits: KitForTemplate[]
): InvoiceLineFromTemplate[] {
  return items.flatMap((item) => expandTemplateItem(item, kits));
}
