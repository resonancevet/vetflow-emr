import { eq, and, isNull } from "drizzle-orm";
import {
  products,
  stockMovements,
  inventoryUsages,
} from "@openpims/db";

export type StockMovementType =
  | "receive"
  | "reverse_receive"
  | "use"
  | "invoice"
  | "adjustment";

export type InventoryUsageSource =
  | "vaccination"
  | "prescription"
  | "administration"
  | "supply";

type StockCtx = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  practiceId: string;
  userId?: string;
  user?: { id: string };
};

function actorId(ctx: StockCtx) {
  return ctx.userId ?? ctx.user?.id ?? null;
}

export async function applyStockChange(
  ctx: StockCtx,
  input: {
    productId: string;
    quantity: number;
    type: StockMovementType;
    note?: string | null;
    orderItemId?: string | null;
    usageId?: string | null;
    invoiceItemId?: string | null;
  }
): Promise<{
  previous: number;
  balanceAfter: number;
  warned: boolean;
}> {
  const [product] = await ctx.db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, input.productId),
        eq(products.practiceId, ctx.practiceId),
        isNull(products.deletedAt)
      )
    )
    .limit(1);

  if (!product) throw new Error("Product not found");

  const previous = product.stockQuantity;
  if (input.quantity === 0) {
    return { previous, balanceAfter: previous, warned: previous < 0 };
  }

  const balanceAfter = previous + input.quantity;

  await ctx.db
    .update(products)
    .set({ stockQuantity: balanceAfter, updatedAt: new Date() })
    .where(eq(products.id, product.id));

  await ctx.db.insert(stockMovements).values({
    practiceId: ctx.practiceId,
    productId: product.id,
    quantity: input.quantity,
    balanceAfter,
    type: input.type,
    note: input.note?.trim() || null,
    createdBy: actorId(ctx),
    orderItemId: input.orderItemId ?? null,
    usageId: input.usageId ?? null,
    invoiceItemId: input.invoiceItemId ?? null,
  });

  return {
    previous,
    balanceAfter,
    warned: balanceAfter < 0,
  };
}

export async function recordProductUsage(
  ctx: StockCtx,
  input: {
    patientId: string;
    productId: string;
    quantity: number;
    sourceType: InventoryUsageSource;
    sourceId?: string | null;
    appointmentId?: string | null;
    note?: string | null;
  }
) {
  if (input.quantity < 1) {
    throw new Error("Usage quantity must be at least 1");
  }

  const [product] = await ctx.db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, input.productId),
        eq(products.practiceId, ctx.practiceId),
        isNull(products.deletedAt)
      )
    )
    .limit(1);

  if (!product) throw new Error("Product not found");

  const [usage] = await ctx.db
    .insert(inventoryUsages)
    .values({
      practiceId: ctx.practiceId,
      patientId: input.patientId,
      appointmentId: input.appointmentId ?? null,
      productId: product.id,
      quantity: input.quantity,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      note: input.note?.trim() || null,
      createdBy: actorId(ctx),
    })
    .returning();

  const stock = await applyStockChange(ctx, {
    productId: product.id,
    quantity: -input.quantity,
    type: "use",
    note: input.note,
    usageId: usage!.id,
  });

  return {
    usage: usage!,
    product,
    ...stock,
  };
}
