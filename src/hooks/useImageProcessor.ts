import { useState } from 'react';
import { toast } from 'sonner';

export const useImageProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const validateFile = (file: File): boolean => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (!validTypes.includes(file.type)) {
      toast.error("Formato no válido", {
        description: "Solo se permiten archivos PNG, JPG y SVG",
      });
      return false;
    }

    if (file.size > maxSize) {
      toast.error("Archivo muy grande", {
        description: "El archivo debe ser menor a 2MB",
      });
      return false;
    }

    return true;
  };

  const processImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      // For SVG, don't process, just return
      if (file.type === 'image/svg+xml') {
        resolve(file);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          console.log("useImageProcessor: Image loaded. Original dimensions:", img.width, "x", img.height);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
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
          
          canvas.toBlob((blob) => {
            if (blob) {
              const processedFile = new File([blob], file.name, {
                type: 'image/png',
                lastModified: Date.now(),
              });
              console.log("useImageProcessor: Canvas blob created. Processed size:", processedFile.size);
              resolve(processedFile);
            } else {
              console.error("useImageProcessor: Failed to create blob from canvas.");
              reject(new Error('Failed to create blob from canvas'));
            }
          }, 'image/png', 0.8);
        };
        img.onerror = () => {
            console.error("useImageProcessor: Error loading image.");
            reject(new Error('Error processing image'));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        console.error("useImageProcessor: Error reading file.");
        reject(new Error('Error reading file'));
      };
      reader.readAsDataURL(file);
    });
  };

  const processAndValidateFile = async (file: File): Promise<File | null> => {
    if (!validateFile(file)) return null;

    setIsProcessing(true);
    try {
      console.log("useImageProcessor: Starting image processing for:", file.name);
      const logoFile = await processImage(file);
      console.log("useImageProcessor: Image processing successful for:", logoFile.name);
      return logoFile;
    } catch (error) {
      console.error(error);
      toast.error("Error", {
        description: "Error al procesar la imagen",
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return { isProcessing, processAndValidateFile };
};
