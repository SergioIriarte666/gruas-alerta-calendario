
import React, { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { useImageProcessor } from '@/hooks/useImageProcessor';
import { LogoPreview } from './LogoPreview';
import { LogoDropzone } from './LogoDropzone';

interface LogoUploadProps {
  currentLogo?: string;
  onLogoChange: (file: File | null) => void;
  disabled?: boolean;
}

export const LogoUpload: React.FC<LogoUploadProps> = ({
  currentLogo,
  onLogoChange,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isProcessing, processAndValidateFile } = useImageProcessor();

  const handleFileSelect = async (file: File) => {
    const processedFile = await processAndValidateFile(file);
    if (processedFile) {
      onLogoChange(processedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled || isProcessing) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const removeLogo = () => {
    onLogoChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    if (disabled || isProcessing) return;
    fileInputRef.current?.click();
  };

  const isComponentDisabled = disabled || isProcessing;

  return (
    <div className="space-y-4">
      <Label className="text-gray-300">Logotipo de la Empresa</Label>

      {currentLogo ? (
        <LogoPreview
          currentLogo={currentLogo}
          onRemove={removeLogo}
          onChangeClick={triggerFileInput}
          disabled={isComponentDisabled}
        />
      ) : (
        <LogoDropzone
          onDrop={handleDrop}
          onClick={triggerFileInput}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => !isComponentDisabled && setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          isDragging={isDragging}
          isProcessing={isProcessing}
          disabled={isComponentDisabled}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml"
        onChange={handleFileInput}
        className="hidden"
        disabled={isComponentDisabled}
      />
    </div>
  );
};
