
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, RefreshCw } from 'lucide-react';

interface PhotoCaptureControlsProps {
  onFileSelect: (files: FileList | null) => void;
  onRefresh: () => void;
  disabled: boolean;
  isLoading: boolean;
  showRefresh: boolean;
}

export const PhotoCaptureControls = ({ 
  onFileSelect, 
  onRefresh, 
  disabled, 
  isLoading, 
  showRefresh 
}: PhotoCaptureControlsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCameraCapture}
          disabled={disabled || isLoading}
          className="flex items-center gap-2"
        >
          <Camera className="w-4 h-4" />
          Tomar Foto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFileUpload}
          disabled={disabled || isLoading}
          className="flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Subir Foto
        </Button>
        {showRefresh && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => onFileSelect(e.target.files)}
        className="hidden"
      />
    </div>
  );
};
