
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
        isDragging ? 'border-tms-green' : 'border-gray-700'
      } ${disabled ? 'opacity-50' : 'cursor-pointer hover:border-gray-600'}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onClick={onClick}
    >
      <CardContent className="p-8">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
            <Image className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <p className="text-white font-medium">
              {isProcessing ? 'Procesando imagen...' : isDragging ? 'Suelta para subir' : 'Subir Logotipo'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Arrastra una imagen aquí o haz clic para seleccionar
            </p>
            <p className="text-gray-500 text-xs mt-2">
              PNG, JPG o SVG • Máximo 2MB • Se redimensionará a 200px
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
