import React from 'react';
import { Check, Building2, Phone, FolderTree } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ClientFormStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  isCompleted: boolean;
  hasError: boolean;
}

interface ClientFormStepNavigationProps {
  steps: ClientFormStep[];
  currentStep: number;
  onStepClick: (stepId: number) => void;
}

export const ClientFormStepNavigation = ({
  steps,
  currentStep,
  onStepClick,
}: ClientFormStepNavigationProps) => {
  return (
    <div className="space-y-2">
      {steps.map((step) => {
        const isActive = step.id === currentStep;
        const isPast = step.id < currentStep;
        const isClickable = step.id <= currentStep || step.isCompleted;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => isClickable && onStepClick(step.id)}
            disabled={!isClickable}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left",
              isActive && "bg-violet-500/10 border border-violet-500/30",
              isPast && !isActive && "bg-muted/50",
              !isActive && !isPast && "hover:bg-muted/30",
              step.hasError && "border-destructive/50 bg-destructive/5",
              !isClickable && "opacity-50 cursor-not-allowed"
            )}
          >
            <div
              className={cn(
                "flex-shrink-0 size-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                isActive && "bg-violet-600 text-white",
                step.isCompleted && !isActive && "bg-violet-500 text-white",
                step.hasError && "bg-destructive text-destructive-foreground",
                !isActive && !step.isCompleted && !step.hasError && "bg-muted text-muted-foreground"
              )}
            >
              {step.isCompleted && !step.hasError ? (
                <Check className="size-4" />
              ) : (
                step.id
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-sm font-medium truncate",
                  isActive && "text-violet-700 dark:text-violet-300",
                  step.hasError && "text-destructive"
                )}
              >
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {step.description}
              </p>
            </div>

            <div
              className={cn(
                "flex-shrink-0 text-muted-foreground",
                isActive && "text-violet-600 dark:text-violet-400"
              )}
            >
              {step.icon}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export const getClientFormSteps = (): Omit<ClientFormStep, 'isCompleted' | 'hasError'>[] => [
  {
    id: 1,
    title: 'Datos Básicos',
    description: 'Nombre y RUT',
    icon: <Building2 className="size-4" />,
  },
  {
    id: 2,
    title: 'Contacto',
    description: 'Teléfono, email y dirección',
    icon: <Phone className="size-4" />,
  },
  {
    id: 3,
    title: 'Departamentos',
    description: 'Áreas y estado',
    icon: <FolderTree className="size-4" />,
  },
];
