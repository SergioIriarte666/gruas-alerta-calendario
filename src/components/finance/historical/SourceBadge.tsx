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
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200') +
        ' text-[9px] px-1.5 py-0' +
        (className ? ` ${className}` : '')
      }
    >
      {isHistorico ? SOURCE_LABELS.historico : SOURCE_LABELS.sistema}
    </Badge>
  );
};
