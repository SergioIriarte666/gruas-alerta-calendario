
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, FileText, Camera, CheckCircle } from 'lucide-react';

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
  downloadUrl 
}: PDFProgressProps) => {
  if (!isGenerating && !downloadUrl) return null;

  const steps = [
    { icon: FileText, label: 'Preparando datos', threshold: 20 },
    { icon: Camera, label: 'Procesando fotos', threshold: 60 },
    { icon: Download, label: 'Generando PDF', threshold: 90 },
    { icon: CheckCircle, label: 'Completado', threshold: 100 }
  ];

  const currentStepIndex = steps.findIndex(step => step.threshold >= progress);
  
  return (
    <Card className="bg-card border-border fixed top-4 right-4 z-50 w-80">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Download className="size-4 text-primary animate-spin" />
            <span className="text-foreground font-medium">Generando PDF de Inspección</span>
          </div>
          
          <Progress value={progress} className="w-full" />
          
          <div className="text-sm text-muted-foreground">
            {currentStep || 'Iniciando...'}
          </div>
          
          <div className="flex flex-col gap-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStepIndex;
              const isCompleted = progress >= step.threshold;
              
              return (
                <div 
                  key={step.label} 
                  className={`flex items-center gap-2 text-sm ${
                    isActive ? 'text-primary' : 
                    isCompleted ? 'text-emerald-500' : 'text-muted-foreground'
                  }`}
                >
                  <Icon className={`size-3 ${isActive ? 'animate-pulse' : ''}`} />
                  <span>{step.label}</span>
                  {isCompleted && <CheckCircle className="size-3 text-emerald-500 ml-auto" />}
                </div>
              );
            })}
          </div>
          
          {downloadUrl && (
            <div className="pt-2 border-t border-border">
              <button
                onClick={onManualDownload}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-4 rounded flex items-center justify-center gap-2"
              >
                <Download className="size-4" />
                Descargar PDF
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
