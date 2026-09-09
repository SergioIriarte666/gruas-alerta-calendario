import { toLocalDateString } from '@/utils/timezoneUtils';

export class DataValidators {
  fixDateFormat(value: any): string {
    if (!value) return '';
    
    // Handle Excel serial numbers
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      return toLocalDateString(date);
    }
    
    // Handle string dates
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return toLocalDateString(date);
      }
    }
    
    // Handle Date objects
    if (value instanceof Date) {
      return toLocalDateString(value);
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

  validateOptionalExpense(value: any, fieldName: string): { isValid: boolean; error?: string; amount?: number } {
    if (value === null || value === undefined || String(value).trim() === '') {
      return { isValid: true };
    }

    const amount = typeof value === 'number' ? value : Number(String(value).trim());

    if (!Number.isFinite(amount)) {
      return { isValid: false, error: `${fieldName} inválido: ${value}` };
    }

    if (amount < 0) {
      return { isValid: false, error: `${fieldName} no puede ser negativo: ${value}` };
    }

    return { isValid: true, amount };
  }

  validateDate(value: any, fieldName: string): { isValid: boolean; error?: string; fixedDate?: string } {
    const fixedDate = this.fixDateFormat(value);
    
    if (!fixedDate || fixedDate === 'Invalid Date') {
      return { isValid: false, error: `${fieldName} inválida: ${value}` };
    }
    
    return { isValid: true, fixedDate };
  }

  validateDepartment(department: string | undefined): { isValid: boolean; error?: string } {
    if (!department || department.trim() === '') {
      return { isValid: false, error: 'Departamento es requerido' };
    }
    
    return { isValid: true };
  }
}
