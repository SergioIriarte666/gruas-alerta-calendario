
export class DataValidators {
  fixDateFormat(value: any): string {
    if (!value) return '';
    
    // Handle Excel serial numbers
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    // Handle string dates
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    // Handle Date objects
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    
    return value.toString();
  }

  validateNumericValue(value: any, fieldName: string): { isValid: boolean; error?: string } {
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) {
      return { isValid: false, error: `${fieldName} inválido: ${value}` };
    }
    
    if (fieldName === 'value' && numValue <= 0) {
      return { isValid: false, error: `Valor debe ser mayor a cero: ${value}` };
    }
    
    if (fieldName === 'operatorCommission' && numValue < 0) {
      return { isValid: false, error: `Comisión no puede ser negativa: ${value}` };
    }
    
    return { isValid: true };
  }

  validateDate(value: any, fieldName: string): { isValid: boolean; error?: string; fixedDate?: string } {
    const fixedDate = this.fixDateFormat(value);
    
    if (!fixedDate || fixedDate === 'Invalid Date') {
      return { isValid: false, error: `${fieldName} inválida: ${value}` };
    }
    
    return { isValid: true, fixedDate };
  }
}
