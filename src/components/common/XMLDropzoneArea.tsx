import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { XMLCompleteParseResult } from '@/types/suppliers';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface XMLDropzoneAreaProps {
  selectedFile: File | null;
  parseResult: XMLCompleteParseResult | null;
  isAnalyzing: boolean;
  isDragActive: boolean;
  getRootProps: () => React.HTMLAttributes<HTMLDivElement>;
  getInputProps: () => React.InputHTMLAttributes<HTMLInputElement>;
  onAnalyze: () => void;
  onReset: () => void;
  badges?: string[];
}

export const XMLDropzoneArea: React.FC<XMLDropzoneAreaProps> = ({
  selectedFile,
  parseResult,
  isAnalyzing,
  isDragActive,
  getRootProps,
  getInputProps,
  onAnalyze,
  onReset,
  badges = ['Detección de duplicados', 'Categorización'],
}) => {
  if (!selectedFile) {
    return (
      <div
        {...getRootProps()}
        className={cn(
          'group relative overflow-hidden rounded-2xl border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-[border-color,background-color,box-shadow] sm:p-10',
          isDragActive
            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
            : 'border-border/80 bg-background/80 hover:border-primary/50 hover:bg-primary/5'
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_52%)]" />
        <input {...getInputProps()} />
        <div className="relative mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5">
          <Upload className="size-7" aria-hidden="true" />
        </div>
        <p className="relative font-semibold text-base">
          {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra un archivo XML o haz clic para seleccionarlo'}
        </p>
        <p className="relative mt-1 text-sm text-muted-foreground">Formato XML · selección segura desde tu equipo</p>
        <div className="relative mt-4 flex flex-wrap justify-center gap-2">
          {badges.map(label => (
            <Badge key={label} variant="secondary" className="bg-background/80">{label}</Badge>
          ))}
        </div>
      </div>
    );
  }

  if (!parseResult) {
    return (
      <Card className="overflow-hidden border border-primary/20 bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-x-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="size-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button onClick={onAnalyze} disabled={isAnalyzing} variant="default" className="shadow-sm">
                {isAnalyzing
                  ? <Loader2 className="size-4 mr-2 animate-spin" />
                  : <FileText className="size-4 mr-2" />}
                Analizar XML
              </Button>
              <Button variant="outline" onClick={onReset}>
                <X className="size-4 mr-2" />
                Quitar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};
