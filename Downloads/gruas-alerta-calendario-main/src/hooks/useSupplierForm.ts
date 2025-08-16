import { useState, useEffect } from 'react';
import { Supplier } from '@/types/supplierPayments';

interface SupplierFormData {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  rut: string;
  payment_terms: string;
  delivery_time_days: number;
  is_active: boolean;
}

interface SupplierFormErrors {
  name?: string;
  rut?: string;
  email?: string;
  phone?: string;
  payment_terms?: string;
  delivery_time_days?: string;
}

const initialFormData: SupplierFormData = {
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  address: '',
  rut: '',
  payment_terms: '30',
  delivery_time_days: 7,
  is_active: true,
};

export const useSupplierForm = (supplier?: Supplier) => {
  const [formData, setFormData] = useState<SupplierFormData>(initialFormData);
  const [errors, setErrors] = useState<SupplierFormErrors>({});
  const [isDirty, setIsDirty] = useState(false);

  // Cargar datos del proveedor si está editando
  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || '',
        contact_person: supplier.contact_person || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        rut: supplier.rut || '',
        payment_terms: supplier.payment_terms || '30',
        delivery_time_days: supplier.delivery_time_days || 7,
        is_active: supplier.is_active ?? true,
      });
    }
  }, [supplier]);

  const updateField = (field: keyof SupplierFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    
    // Limpiar error del campo cuando se modifica
    if (errors[field as keyof SupplierFormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateRUT = (rut: string): boolean => {
    // Validación básica de RUT chileno
    const cleanRUT = rut.replace(/[^0-9kK]/g, '');
    if (cleanRUT.length < 8 || cleanRUT.length > 9) return false;
    
    const body = cleanRUT.slice(0, -1);
    const dv = cleanRUT.slice(-1).toLowerCase();
    
    let sum = 0;
    let multiplier = 2;
    
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    
    const remainder = sum % 11;
    const calculatedDV = remainder < 2 ? remainder.toString() : (11 - remainder === 10 ? 'k' : (11 - remainder).toString());
    
    return dv === calculatedDV;
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors: SupplierFormErrors = {};

    // Validaciones requeridas
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.rut.trim()) {
      newErrors.rut = 'El RUT es requerido';
    } else if (!validateRUT(formData.rut)) {
      newErrors.rut = 'El RUT no es válido';
    }

    // Validaciones opcionales
    if (formData.email && !validateEmail(formData.email)) {
      newErrors.email = 'El email no es válido';
    }

    if (formData.delivery_time_days < 0) {
      newErrors.delivery_time_days = 'Los días de entrega no pueden ser negativos';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setErrors({});
    setIsDirty(false);
  };

  const formatRUT = (rut: string): string => {
    const cleanRUT = rut.replace(/[^0-9kK]/g, '');
    if (cleanRUT.length <= 1) return cleanRUT;
    
    const body = cleanRUT.slice(0, -1);
    const dv = cleanRUT.slice(-1);
    
    // Formatear con puntos
    const formattedBody = body.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    
    return `${formattedBody}-${dv}`;
  };

  return {
    formData,
    errors,
    isDirty,
    updateField,
    validateForm,
    resetForm,
    formatRUT,
    isValid: Object.keys(errors).length === 0 && formData.name.trim() && formData.rut.trim(),
  };
};