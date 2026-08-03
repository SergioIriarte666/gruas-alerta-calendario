import React from 'react';
import { ChevronRight, ClipboardCheck, ClipboardList, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { businessClock } from '@/utils/businessClock';
import { countSnapshotItems, countAnsweredItems } from '@/utils/checklists/checklistLogic';
import { CHECKLIST_TEMPLATE_IDS } from '@/types/checklists';
import type { ChecklistListItem } from '@/types/checklists';

interface ChecklistListCardProps {
  checklist: ChecklistListItem;
  onOpen: (checklist: ChecklistListItem) => void;
}

export const ChecklistListCard = ({ checklist, onOpen }: ChecklistListCardProps) => {
  const isDraft = checklist.status === 'draft';
  const isPreoperacional = checklist.template_id === CHECKLIST_TEMPLATE_IDS.preoperacional;
  const total = countSnapshotItems(checklist.items_snapshot);
  const answered = countAnsweredItems(checklist.items_snapshot, checklist.answers);

  return (
    <button
      type="button"
      onClick={() => onOpen(checklist)}
      className="operator-inspection-card flex w-full items-center gap-3 rounded-3xl p-4 text-left transition-colors hover:bg-muted/40"
    >
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${
          isDraft ? 'bg-warning/10 text-warning-text' : 'bg-success/10 text-success-text'
        }`}
      >
        {isDraft ? <ClipboardList className="size-5" /> : <ClipboardCheck className="size-5" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">
          {isPreoperacional ? 'Pre-operacional grúa cama' : 'Fatiga y somnolencia'}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {businessClock.format(checklist.performed_at, 'dd/MM/yyyy HH:mm')}
          {isDraft ? ` · ${answered}/${total} respondidos` : ''}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={
              isDraft
                ? 'border-warning/30 bg-warning/10 text-warning-text'
                : 'border-success/30 bg-success/10 text-success-text'
            }
          >
            {isDraft ? 'Borrador' : 'Firmado'}
          </Badge>
          {checklist.crane_label && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Truck className="size-3.5" />
              {checklist.crane_label}
            </span>
          )}
          {checklist.service_folio && (
            <span className="text-xs text-muted-foreground">Folio {checklist.service_folio}</span>
          )}
        </div>
      </div>

      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </button>
  );
};
