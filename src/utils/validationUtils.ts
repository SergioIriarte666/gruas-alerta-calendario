export const isDuplicateError = (error: any): boolean => {
  return error?.code === '23505' || error?.message?.includes('duplicate key value');
};

export const extractDuplicateField = (error: any): string | null => {
  const message = error?.message || '';
  
  // PostgreSQL unique constraint error patterns
  if (message.includes('clients_rut_key')) return 'rut';
  if (message.includes('cranes_license_plate_key')) return 'license_plate';
  if (message.includes('operators_rut_key')) return 'rut';
  if (message.includes('operators_license_number_key')) return 'license_number';
  if (message.includes('inventory_items_sku_key')) return 'sku';
  
  // Generic patterns
  if (message.includes('rut')) return 'rut';
  if (message.includes('license_plate')) return 'license_plate';
  if (message.includes('license_number')) return 'license_number';
  if (message.includes('sku')) return 'sku';
  
  return null;
};

export const getDuplicateErrorMessage = (entity: string, field: string, value: string): string => {
  const fieldNames: Record<string, string> = {
    rut: 'RUT',
    license_plate: 'patente',
    license_number: 'número de licencia',
    sku: 'SKU'
  };
  
  const fieldName = fieldNames[field] || field;
  return `Ya existe ${entity} registrado con ${fieldName} ${value}`;
};