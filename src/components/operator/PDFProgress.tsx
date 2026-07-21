import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Download, FileText, Camera, CheckCircle, Loader2 } from 'lucide-react';

interface PDFProgressProps {
  isGenerating: boolean;
  progress: number;
  currentStep: string;
  onManualDownload?: () => void;
  downloadUrl?: string;
}

export const PDFProgress = ({
  isGenerating,
  progress,
  currentStep,
  onManualDownload,
  downloadUrl,
}: PDFProgressProps) => {
  if (!isGenerating && !downloadUrl) return null;

  const steps = [
    { icon: FileText,    label: 'Preparando datos', threshold: 20 },
    { icon: Camera,      label: 'Procesando fotos', threshold: 60 },
    { icon: Download,    label: 'Generando PDF',     threshold: 90 },
    { icon: CheckCircle, label: 'Completado',        threshold: 100 },
  ];

  const currentStepIndex = steps.findIndex((s) => s.threshold >= progress);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 50,
      }}
      className="bg-card border-t border-border shadow-lg"
    >
      <div className="px-4 pt-3 pb-2 space-y-2 max-w-lg mx-auto">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isGenerating ? (
              <Loader2 className="size-4 text-primary animate-spin" />
            ) : (
              <CheckCircle className="size-4 text-success-text" />
            )}
            <span className="text-sm font-medium text-foreground">
              {isGenerating ? 'Generando PDF…' : 'PDF listo'}
            </span>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="h-1.5 w-full" />

        {/* Current step label */}
        {isGenerating && (
          <p className="text-xs text-muted-foreground">{currentStep || 'Iniciando…'}</p>
        )}

        {/* Step indicators — only while generating */}
        {isGenerating && (
          <div className="flex items-center justify-between gap-1 pt-0.5">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStepIndex;
              const isCompleted = progress >= step.threshold;
              return (
                <div
                  key={step.label}
                  className={`flex items-center gap-1 text-xs ${
                    isCompleted
                      ? 'text-success-text'
                      : isActive
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  <Icon className={`size-3 ${isActive ? 'animate-pulse' : ''}`} />
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Download button — only when ready */}
        {downloadUrl && (
          <button
            onClick={onManualDownload}
            className="w-full bg-primary hover:bg-primary/90 active:scale-[0.98]
                       text-primary-foreground font-medium py-2.5 px-4 rounded-lg
                       flex items-center justify-center gap-2 transition-all text-sm"
          >
            <Download className="size-4" />
            Descargar PDF
          </button>
        )}
      </div>
    </div>
  );
};
