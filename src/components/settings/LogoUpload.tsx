
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Upload, Image, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LogoUploadProps {
  currentLogo?: string;
  onLogoChange: (logoData: string | null) => void;
  disabled?: boolean;
}

export const LogoUpload: React.FC<LogoUploadProps> = ({
  currentLogo,
  onLogoChange,
  disabled = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): boolean => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (!validTypes.includes(file.type)) {
      toast({
        title: "Formato no válido",
        description: "Solo se permiten archivos PNG, JPG y SVG",
        variant: "destructive",
      });
      return false;
    }

    if (file.size > maxSize) {
      toast({
        title: "Archivo muy grande",
        description: "El archivo debe ser menor a 2MB",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calculate new dimensions (max 200x200, maintain aspect ratio)
          const maxSize = 200;
          let { width, height } = img;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/png', 0.8);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Error processing image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    if (!validateFile(file)) return;

    setIsProcessing(true);
    try {
      const logoData = await processImage(file);
      onLogoChange(logoData);
      toast({
        title: "Logotipo cargado",
        description: "El logotipo se ha cargado correctamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al procesar la imagen",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
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
  };

  const removeLogo = () => {
    onLogoChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast({
      title: "Logotipo eliminado",
      description: "El logotipo se ha eliminado correctamente",
    });
  };

  return (
    <div className="space-y-4">
      <Label className="text-gray-300">Logotipo de la Empresa</Label>
      
      {currentLogo ? (
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center">
                <img
                  src={currentLogo}
                  alt="Company Logo"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm">Logotipo actual</p>
                <p className="text-gray-400 text-xs">Se muestra en informes y facturas</p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isProcessing}
                  className="border-gray-700 text-gray-300"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Cambiar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={removeLogo}
                  disabled={disabled || isProcessing}
                  className="border-gray-700 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card 
          className={`glass-card transition-colors ${
            isDragging ? 'border-tms-green' : 'border-gray-700'
          } ${disabled ? 'opacity-50' : 'cursor-pointer hover:border-gray-600'}`}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                <Image className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <p className="text-white font-medium">
                  {isProcessing ? 'Procesando imagen...' : 'Subir Logotipo'}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Arrastra una imagen aquí o haz clic para seleccionar
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  PNG, JPG o SVG • Máximo 2MB • Se redimensionará automáticamente
                </p>
              </div>
              <Button 
                variant="outline" 
                disabled={disabled || isProcessing}
                className="border-gray-700 text-gray-300"
              >
                <Upload className="w-4 h-4 mr-2" />
                Seleccionar Archivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml"
        onChange={handleFileInput}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
};
