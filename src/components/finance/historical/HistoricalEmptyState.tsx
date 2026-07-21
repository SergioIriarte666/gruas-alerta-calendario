import { FileQuestion, FilterX, AlertTriangle } from 'lucide-react';

type EmptyStateVariant = 'none' | 'filtered' | 'missing-import';

interface HistoricalEmptyStateProps {
  variant: EmptyStateVariant;
  /** Texto adicional opcional, p.ej. para precisar qué tabla está vacía. */
  detail?: string;
  className?: string;
}

const CONFIG: Record<EmptyStateVariant, { icon: typeof FileQuestion; title: string }> = {
  none: {
    icon: FileQuestion,
    title: 'Aún no hay registros. Importa tu histórico para comenzar.',
  },
  filtered: {
    icon: FilterX,
    title: 'No hay resultados para los filtros o el período seleccionados. Ajusta el rango, el origen o limpia los filtros.',
  },
  'missing-import': {
    icon: AlertTriangle,
    title: 'Posible importación faltante para este período.',
  },
};

export const HistoricalEmptyState = ({ variant, detail, className }: HistoricalEmptyStateProps) => {
  const { icon: Icon, title } = CONFIG[variant];
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-8 text-center ${className || ''}`}>
      <Icon className={`size-8 ${variant === 'missing-import' ? 'text-warning-text' : 'text-muted-foreground/40'}`} />
      <p className="text-sm text-muted-foreground max-w-sm">{title}</p>
      {detail && <p className="text-xs text-muted-foreground/70">{detail}</p>}
    </div>
  );
};
