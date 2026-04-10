import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Check, History } from 'lucide-react';
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
  source = 'ai',
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

  const isHistory = source === 'history';
  const Icon = isHistory ? History : Sparkles;
  const sourceLabel = isHistory ? 'Historial' : 'IA';

  const label = subcategory
    ? `${categoryName} → ${subcategory}`
    : categoryName;

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <Badge
        variant="outline"
        className={cn(
          "text-xs cursor-pointer transition-colors gap-1.5 pr-1",
          isHistory
            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
            : "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40"
        )}
        onClick={onApply}
      >
        <Icon className="w-3 h-3" />
        <span>{sourceLabel}: {label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-5 w-5 p-0 ml-1 rounded-full",
            isHistory
              ? "hover:bg-blue-200 dark:hover:bg-blue-800"
              : "hover:bg-violet-200 dark:hover:bg-violet-800"
          )}
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
