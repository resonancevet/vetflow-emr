"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

export type CatalogProduct = {
  id: string;
  name: string;
  sku: string | null;
  unitPrice: string;
  stockQuantity: number;
  units: string | null;
  category: string | null;
  lotNumber: string | null;
};

export function ProductPicker({
  value,
  onChange,
  category,
  placeholder = "Search inventory product...",
  className,
}: {
  value: CatalogProduct | null;
  onChange: (product: CatalogProduct | null) => void;
  category?: string;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const productsQuery = trpc.inventory.list.useQuery({
    search: query || undefined,
    category: category || undefined,
    limit: 50,
    offset: 0,
  });

  const options = useMemo(
    () => productsQuery.data?.items ?? [],
    [productsQuery.data]
  );

  return (
    <div className={cn("relative", className)}>
      <Input
        value={value ? `${value.name}${value.sku ? ` (${value.sku})` : ""}` : query}
        onChange={(e) => {
          onChange(null);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
      />
      {open && options.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-md border border-border bg-card shadow-md">
          {options.slice(0, 12).map((p) => (
            <button
              key={p.id}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({
                  id: p.id,
                  name: p.name,
                  sku: p.sku,
                  unitPrice: p.unitPrice,
                  stockQuantity: p.stockQuantity,
                  units: p.units,
                  category: p.category,
                  lotNumber: p.lotNumber,
                });
                setQuery("");
                setOpen(false);
              }}
            >
              <span className="font-medium">{p.name}</span>
              <span className="ml-2 text-muted-foreground">
                {p.sku ? `${p.sku} · ` : ""}
                {p.stockQuantity} {p.units ?? "on hand"}
              </span>
            </button>
          ))}
        </div>
      )}
      {value && (
        <p
          className={cn(
            "mt-1 text-xs",
            value.stockQuantity <= 0
              ? "text-amber-700"
              : "text-muted-foreground"
          )}
        >
          On hand: {value.stockQuantity}
          {value.units ? ` ${value.units}` : ""}
          {value.stockQuantity <= 0 ? " — will go negative" : ""}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
          >
            Clear
          </button>
        </p>
      )}
    </div>
  );
}

export function StockUseFields({
  product,
  quantity,
  onQuantityChange,
  note,
  onNoteChange,
}: {
  product: CatalogProduct | null;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  note: string;
  onNoteChange: (note: string) => void;
}) {
  if (!product) return null;
  const willGoNegative = quantity > product.stockQuantity;

  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-medium">Qty used</label>
        <Input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) =>
            onQuantityChange(Math.max(1, parseInt(e.target.value, 10) || 1))
          }
        />
      </div>
      {willGoNegative && (
        <p className="text-xs text-amber-700 sm:col-span-2">
          On hand is {product.stockQuantity}
          {product.units ? ` ${product.units}` : ""}. Saving will take stock
          negative.
        </p>
      )}
      <div className={willGoNegative ? "sm:col-span-2" : "sm:col-span-2"}>
        <label className="mb-1 block text-xs font-medium">
          Stock note {willGoNegative ? "(optional)" : "(optional)"}
        </label>
        <Input
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={
            willGoNegative ? "Why stock is going negative..." : "Optional note"
          }
        />
      </div>
    </>
  );
}
