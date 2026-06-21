export type SourceFilter = 'all' | 'historico' | 'sistema';

export const SOURCE_FILTER_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'historico', label: 'Históricos' },
  { value: 'sistema', label: 'Sistema' },
];

export const SOURCE_LABELS: Record<'historico' | 'sistema', string> = {
  historico: 'Importada',
  sistema: 'Sistema',
};

export function matchesSource(
  itemSource: string | null | undefined,
  filter: SourceFilter
): boolean {
  if (filter === 'all') return true;
  const normalized = itemSource === 'historico' ? 'historico' : 'sistema';
  return normalized === filter;
}
