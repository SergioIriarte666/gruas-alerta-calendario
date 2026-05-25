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
  source = 'history',
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
        className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs cursor-pointer transition-colors gap-1.5 pr-1"
        onClick={onApply}
      >
        <History className="size-3" />
        <span>Historial: {label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-5 p-0 ml-1 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
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
