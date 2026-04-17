/**
 * Auto-SKU generator for XML-imported products.
 *
 * Format: SKU-{YYYYMMDD}-{HEX4}
 * Example: SKU-20260417-A3F2
 *
 * Use ONLY when creating inventory items from XML imports where the
 * supplier did not provide a product code. Manual product creation
 * still requires an explicit SKU (see mem://constraints/inventory/manual-sku-enforcement-v2).
 */
export const generateAutoSku = (): string => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hex = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  return `SKU-${date}-${hex}`;
};
