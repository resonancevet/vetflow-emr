export function planDisplayName(
  planName?: string | null,
  inventoryName?: string | null
): string {
  return planName?.trim() || inventoryName?.trim() || "";
}
