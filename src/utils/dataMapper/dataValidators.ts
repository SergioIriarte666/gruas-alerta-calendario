import { toLocalDateString } from '@/utils/timezoneUtils';

const formatCalendarDate = (year: number, month: number, day: number): string => {
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    return '';
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export class DataValidators {
  fixDateFormat(value: any): string {
    if (!value) return '';
    
    // Handle Excel serial numbers
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      return formatCalendarDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
    
    // Handle string dates
    if (typeof value === 'string') {
      const trimmed = value.trim();
      const ymd = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
      const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

      if (ymd) {
        return formatCalendarDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
      }

      if (dmy) {
        return formatCalendarDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
      }

      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        return toLocalDateString(date);
      }

      return '';
    }
    
    // Handle Date objects
    if (value instanceof Date) {
      return formatCalendarDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
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
    
    if (!fixedDate) {
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
