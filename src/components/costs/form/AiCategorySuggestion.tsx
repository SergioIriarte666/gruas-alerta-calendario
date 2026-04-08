import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiCategorySuggestionProps {
  categoryName: string | null;
  subcategory: string | null;
  isClassifying: boolean;
  onApply: () => void;
  className?: string;
}

export const AiCategorySuggestion = ({
  categoryName,
  subcategory,
  isClassifying,
  onApply,
  className,
}: AiCategorySuggestionProps) => {
  if (isClassifying) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground animate-pulse", className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Clasificando con IA...</span>
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
        className="bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300 text-xs cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors gap-1.5 pr-1"
        onClick={onApply}
      >
        <Sparkles className="w-3 h-3" />
        <span>Sugerencia: {label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 ml-1 rounded-full hover:bg-violet-200 dark:hover:bg-violet-800"
          onClick={(e) => {
            e.stopPropagation();
            onApply();
          }}
        >
          <Check className="w-3 h-3" />
        </Button>
      </Badge>
    </div>
  );
};
