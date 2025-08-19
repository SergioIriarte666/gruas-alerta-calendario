
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
          className="flex items-center gap-2 border-blue-500/50 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500"
          style={{
            borderColor: 'rgba(59, 130, 246, 0.5)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            color: '#3b82f6'
          }}
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
          className="flex items-center gap-2 border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-500"
          style={{
            borderColor: 'rgba(34, 197, 94, 0.5)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            color: '#22c55e'
          }}
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
            className="flex items-center gap-1 border-gray-400/50 bg-gray-400/10 text-gray-300 hover:bg-gray-400/20 hover:border-gray-400"
            style={{
              borderColor: 'rgba(156, 163, 175, 0.5)',
              backgroundColor: 'rgba(156, 163, 175, 0.1)',
              color: '#d1d5db'
            }}
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
