
export const compressImageForPDF = async (imageData: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.warn('No se pudo obtener contexto 2D, usando imagen original');
          resolve(imageData);
          return;
        }
        
        // Calcular nuevas dimensiones
        const maxWidth = 600;
        const maxHeight = 450;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Dibujar imagen optimizada
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convertir con buena calidad
        const compressedData = canvas.toDataURL('image/jpeg', 0.85);
        console.log(`Imagen comprimida: ${imageData.length} -> ${compressedData.length} caracteres`);
        resolve(compressedData);
      };
      
      img.onerror = () => {
        console.warn('Error comprimiendo imagen, usando original');
        resolve(imageData);
      };
      
      img.src = imageData;
    } catch (error) {
      console.warn('Error en compresión:', error);
      resolve(imageData);
    }
  });
};
