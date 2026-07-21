import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Check, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SuggestionSource } from '@/hooks/useAutoClassify';

interface AiCategorySuggestionProps {
  categoryName: string | null;
  subcategory: string | null;
  isClassifying: boolean;
  onApply: () => void;
  source?: SuggestionSource | null;
  className?: string;
}

export const AiCategorySuggestion = ({
  categoryName,
  subcategory,
  isClassifying,
  onApply,
  source: _source = 'history',
  className,
}: AiCategorySuggestionProps) => {
  if (isClassifying) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground animate-pulse", className)}>
        <Loader2 className="size-3 animate-spin" />
        <span>Buscando en historial...</span>
      </div>
    );
  }

  if (!categoryName) return null;

  const label = subcategory
    ? `${categoryName} → ${subcategory}`
    : categoryName;

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <Badge
        variant="outline"
        className="bg-info-soft border-info/30 text-info-text hover:bg-info-soft text-xs cursor-pointer transition-colors gap-1.5 pr-1"
        onClick={onApply}
      >
        <History className="size-3" />
        <span>Historial: {label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-5 p-0 ml-1 rounded-full hover:bg-info-soft"
          onClick={(e) => {
            e.stopPropagation();
            onApply();
          }}
        >
          <Check className="size-3" />
        </Button>
      </Badge>
    </div>
  );
};
