
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Image } from 'lucide-react';

interface LogoDropzoneProps {
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  isDragging: boolean;
  isProcessing: boolean;
  disabled: boolean;
}

export const LogoDropzone: React.FC<LogoDropzoneProps> = ({
  onDrop,
  onClick,
  onDragOver,
  onDragEnter,
  onDragLeave,
  isDragging,
  isProcessing,
  disabled
}) => {
  return (
    <Card 
      className={`glass-card transition-colors ${
        isDragging ? 'border-primary' : 'border-border'
      } ${disabled ? 'opacity-50' : 'cursor-pointer hover:border-primary/60'}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onClick={onClick}
    >
      <CardContent className="p-8">
        <div className="flex flex-col items-center justify-center text-center gap-y-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Image className="size-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {isProcessing ? 'Procesando imagen...' : isDragging ? 'Suelta para subir' : 'Subir Logotipo'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Arrastra una imagen aquí o haz clic para seleccionar
            </p>
            <p className="mt-2 text-xs text-muted-foreground/80">
              PNG, JPG o SVG • Máximo 2MB • Se redimensionará a 200px
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
