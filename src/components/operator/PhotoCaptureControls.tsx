
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
          className="flex items-center gap-2 border-info/30 bg-info-soft text-info-text hover:border-info/40 hover:bg-info-soft/80"
        >
          <Camera className="size-4" />
          Tomar Foto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFileUpload}
          disabled={disabled || isLoading}
          className="flex items-center gap-2 border-success/30 bg-success-soft text-success-text hover:border-success/40 hover:bg-success-soft/80"
        >
          <Upload className="size-4" />
          Subir Foto
        </Button>
        {showRefresh && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1 border-border bg-muted text-muted-foreground hover:border-foreground/30 hover:bg-muted/80"
          >
            <RefreshCw className={`size-3 ${isLoading ? 'animate-spin' : ''}`} />
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
