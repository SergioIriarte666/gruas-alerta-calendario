// Tipo compartido para información del creador
export interface CreatorInfo {
  id: string;
  full_name: string | null;
  email: string;
}

// Helper para obtener el nombre a mostrar del creador
export const getCreatorDisplayName = (creator?: CreatorInfo | null): string => {
  if (!creator) return 'Usuario desconocido';
  return creator.full_name || creator.email || 'Usuario desconocido';
};
