
export class PhotoProcessor {
  static generateFileName(prefix: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(7);
    return `${prefix}-${timestamp}-${random}.jpg`;
  }

  static processImage(file: File, titlePrefix: string): Promise<{ name: string; dataUrl: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('No se pudo crear el contexto del canvas'));
              return;
            }
            
            // Redimensionar imagen para optimizar tamaño
            const maxWidth = 800;
            const maxHeight = 600;
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
            
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const fileName = this.generateFileName(titlePrefix.toLowerCase().replace(/\s+/g, '-'));
            
            resolve({ name: fileName, dataUrl });
          } catch (error) {
            reject(new Error('Error procesando la imagen'));
          }
        };
        img.onerror = () => reject(new Error('Error cargando la imagen'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Error leyendo el archivo'));
      reader.readAsDataURL(file);
    });
  }

  static validateImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }
}
