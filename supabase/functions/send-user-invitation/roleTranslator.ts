
export const roleLabels: Record<string, string> = {
  'admin': 'Administrador',
  'operator': 'Operador', 
  'viewer': 'Visualizador',
  'client': 'Cliente'
};

export const translateRole = (role: string): string => {
  return roleLabels[role] || role;
};
