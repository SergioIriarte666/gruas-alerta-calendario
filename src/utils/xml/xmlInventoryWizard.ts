import type { LineConsumption } from './xmlInventoryConsumption';

export function applyCraneToSelectedLines(
  lines: { key: string; quantity: number }[], selectedKeys: Set<string>,
  consumptions: Record<string, LineConsumption>, craneId: string,
) {
  const next = { ...consumptions };
  for (const line of lines) {
    if (!selectedKeys.has(line.key)) continue;
    next[line.key] = { immediate: true, quantity: consumptions[line.key]?.immediate ? consumptions[line.key].quantity : line.quantity, craneId };
  }
  return next;
}

export function isImportDateValid(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
