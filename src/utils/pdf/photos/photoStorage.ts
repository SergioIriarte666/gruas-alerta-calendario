
export const getPhotoFromStorage = (photoName: string): string | null => {
  if (!photoName || typeof photoName !== 'string') {
    console.warn(`Nombre de foto inválido: ${photoName}`);
    return null;
  }

  // Verificar múltiples posibles claves en localStorage
  let photoData = localStorage.getItem(`photo-${photoName}`);
  
  // Si no se encuentra, intentar solo con el nombre
  if (!photoData) {
    photoData = localStorage.getItem(photoName);
  }
  
  console.log(`Buscando foto: photo-${photoName}, encontrada: ${!!photoData}`);
  
  return photoData && photoData.startsWith('data:image') ? photoData : null;
};
