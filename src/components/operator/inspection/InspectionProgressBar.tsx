import React, { useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { Gauge, ClipboardList, Camera, PenTool, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InspectionProgressBarProps {
  form: UseFormReturn<InspectionFormValues>;
  phase: 'initial' | 'final';
}

interface Section {
  id: string;
  label: string;
  icon: React.ElementType;
  check: (values: Partial<InspectionFormValues>) => boolean;
  phaseOnly?: 'initial' | 'final';
}

const SECTIONS: Section[] = [
  {
    id: 'vehicle',
    label: 'Vehículo',
    icon: Gauge,
    check: (v) =>
      !!v.kilometraje?.trim() && !!v.combustible && !!v.llaves && !!v.documentacion,
  },
  {
    id: 'equipment',
    label: 'Equipamiento',
    icon: ClipboardList,
    check: (v) => Array.isArray(v.equipment) && v.equipment.length > 0,
    phaseOnly: 'initial',
  },
  {
    id: 'photos',
    label: 'Fotos',
    icon: Camera,
    check: (v) => Array.isArray(v.photographicSet) && v.photographicSet.length > 0,
  },
  {
    id: 'signatures_initial',
    label: 'Firma operador',
    icon: PenTool,
    check: (v) => !!v.operatorSignature?.trim(),
    phaseOnly: 'initial',
  },
  {
    id: 'signatures_final',
    label: 'Firma recepción',
    icon: PenTool,
    check: (v) =>
      !!v.vehicleReceptionSignature?.trim() && !!v.receptionPersonName?.trim(),
    phaseOnly: 'final',
  },
];

export const InspectionProgressBar = ({ form, phase }: InspectionProgressBarProps) => {
  const values = form.watch();

  const visibleSections = useMemo(
    () => SECTIONS.filter((s) => !s.phaseOnly || s.phaseOnly === phase),
    [phase]
  );

  const completedCount = useMemo(
    () => visibleSections.filter((s) => s.check(values)).length,
    [visibleSections, values]
  );

  const totalCount = visibleSections.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allDone = completedCount === totalCount;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {allDone ? (
            <CheckCircle className="size-4 text-emerald-500" />
          ) : (
            <span className="size-4 rounded-full border-2 border-violet-500 inline-flex items-center justify-center">
              <span className="size-1.5 rounded-full bg-violet-500" />
            </span>
          )}
          <span className="text-sm font-medium text-foreground">
            {phase === 'initial' ? 'Inspección inicial' : 'Fase de entrega'}
          </span>
        </div>
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            allDone ? 'text-emerald-500' : 'text-violet-500'
          )}
        >
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Progress track */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            allDone ? 'bg-emerald-500' : 'bg-violet-500'
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Section indicators */}
      <div className="flex items-center justify-between gap-1">
        {visibleSections.map((section) => {
          const done = section.check(values);
          const Icon = section.icon;
          return (
            <div key={section.id} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div
                className={cn(
                  'size-7 rounded-full flex items-center justify-center border-2 transition-colors duration-300',
                  done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-muted border-border text-muted-foreground'
                )}
              >
                {done ? (
                  <CheckCircle className="size-3.5" />
                ) : (
                  <Icon className="size-3.5" />
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] text-center leading-tight truncate w-full px-0.5',
                  done ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'
                )}
              >
                {section.label}
              </span>
            </div>
          );
        })}
      </div>

      {allDone && (
        <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 font-medium">
          ✓ Todo completo — listo para enviar
        </p>
      )}
    </div>
  );
};
