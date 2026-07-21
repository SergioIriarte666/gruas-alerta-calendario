import { Badge } from '@/components/ui/badge';
import { SOURCE_LABELS } from './useSourceFilter';

interface SourceBadgeProps {
  source: string | null | undefined;
  className?: string;
}

export const SourceBadge = ({ source, className }: SourceBadgeProps) => {
  const isHistorico = source === 'historico';
  return (
    <Badge
      variant="outline"
      className={
        (isHistorico
          ? 'bg-info-soft text-info-text border-info'
          : 'bg-success-soft text-success-text border-success') +
        ' text-xs px-1.5 py-0' +
        (className ? ` ${className}` : '')
      }
    >
      {isHistorico ? SOURCE_LABELS.historico : SOURCE_LABELS.sistema}
    </Badge>
  );
};
