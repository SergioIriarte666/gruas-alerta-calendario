import React from 'react';
import { cn } from '@/lib/utils';
import { getAnswerOptions } from '@/utils/checklists/checklistLogic';
import type { ChecklistAnswer, ChecklistAnswerType } from '@/types/checklists';

interface ChecklistAnswerButtonsProps {
  answerType: ChecklistAnswerType;
  value?: ChecklistAnswer;
  onChange?: (answer: ChecklistAnswer) => void;
  disabled?: boolean;
  /** Etiqueta accesible del grupo: el ítem al que responden estos botones. */
  itemLabel: string;
}

// Se llenan con guantes, en faena y con sol directo: área táctil grande (min-h-14),
// tipografía gruesa y colores sólidos al seleccionar. La opción no elegida queda
// con borde marcado para que se distinga sin depender del color.
const TONE_SELECTED: Record<string, string> = {
  positive: 'bg-success text-success-foreground border-success',
  negative: 'bg-danger text-danger-foreground border-danger',
  neutral: 'bg-muted-foreground text-background border-muted-foreground',
};

export const ChecklistAnswerButtons = ({
  answerType,
  value,
  onChange,
  disabled = false,
  itemLabel,
}: ChecklistAnswerButtonsProps) => {
  const options = getAnswerOptions(answerType);
  // "NO VIGENTE" no cabe a text-lg en un tercio de una pantalla de 375 px, y no
  // se abrevia porque es la palabra que queda en el documento firmado: baja de
  // cuerpo y se le permite envolver a dos líneas, conservando la altura táctil.
  const hasLongLabel = options.some((option) => option.label.length > 3);

  return (
    <div
      role="radiogroup"
      aria-label={`Respuesta para: ${itemLabel}`}
      className="grid grid-cols-3 gap-2"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.ariaLabel}
            disabled={disabled}
            onClick={() => onChange?.(option.value)}
            className={cn(
              'flex min-h-14 items-center justify-center rounded-2xl border-2 px-1 text-center font-extrabold leading-tight transition-colors',
              hasLongLabel ? 'text-sm tracking-normal' : 'text-lg tracking-wide',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              disabled && 'cursor-default opacity-90',
              selected
                ? TONE_SELECTED[option.tone]
                : 'border-border bg-background text-muted-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
