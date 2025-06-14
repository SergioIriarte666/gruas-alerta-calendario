
import { useState, useEffect } from 'react';
import { Operator } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useOperators = () => {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchOperators = async () => {
    try {
      const { data, error } = await supabase
        .from('operators')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedOperators: Operator[] = data.map(operator => ({
        id: operator.id,
        name: operator.name,
        rut: operator.rut,
        phone: operator.phone || '',
        licenseNumber: operator.license_number,
        examExpiry: operator.exam_expiry,
        isActive: operator.is_active || false,
        createdAt: operator.created_at,
        updatedAt: operator.updated_at
      }));

      setOperators(formattedOperators);
    } catch (error: any) {
      console.error('Error fetching operators:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los operadores.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperators();
  }, []);

  const createOperator = async (operatorData: Omit<Operator, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { data, error } = await supabase
        .from('operators')
        .insert({
          name: operatorData.name,
          rut: operatorData.rut,
          phone: operatorData.phone,
          license_number: operatorData.licenseNumber,
          exam_expiry: operatorData.examExpiry,
          is_active: operatorData.isActive
        })
        .select()
        .single();

      if (error) throw error;

      const newOperator: Operator = {
        id: data.id,
        name: data.name,
        rut: data.rut,
        phone: data.phone || '',
        licenseNumber: data.license_number,
        examExpiry: data.exam_expiry,
        isActive: data.is_active || false,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      setOperators(prev => [newOperator, ...prev]);
      
      toast({
        title: "Operador creado",
        description: `Operador ${operatorData.name} creado exitosamente.`,
      });

      return newOperator;
    } catch (error: any) {
      console.error('Error creating operator:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el operador.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateOperator = async (id: string, operatorData: Partial<Operator>) => {
    try {
      const updateData: any = {};
      
      if (operatorData.name !== undefined) updateData.name = operatorData.name;
      if (operatorData.rut !== undefined) updateData.rut = operatorData.rut;
      if (operatorData.phone !== undefined) updateData.phone = operatorData.phone;
      if (operatorData.licenseNumber !== undefined) updateData.license_number = operatorData.licenseNumber;
      if (operatorData.examExpiry !== undefined) updateData.exam_expiry = operatorData.examExpiry;
      if (operatorData.isActive !== undefined) updateData.is_active = operatorData.isActive;

      const { error } = await supabase
        .from('operators')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      setOperators(prev => prev.map(operator => 
        operator.id === id 
          ? { ...operator, ...operatorData, updatedAt: new Date().toISOString() }
          : operator
      ));

      toast({
        title: "Operador actualizado",
        description: "El operador ha sido actualizado exitosamente.",
      });
    } catch (error: any) {
      console.error('Error updating operator:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el operador.",
        variant: "destructive",
      });
    }
  };

  const deleteOperator = async (id: string) => {
    try {
      const { error } = await supabase
        .from('operators')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setOperators(prev => prev.filter(operator => operator.id !== id));
      
      toast({
        title: "Operador eliminado",
        description: "El operador ha sido eliminado exitosamente.",
      });
    } catch (error: any) {
      console.error('Error deleting operator:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el operador.",
        variant: "destructive",
      });
    }
  };

  const toggleOperatorStatus = async (id: string) => {
    try {
      const operator = operators.find(o => o.id === id);
      if (!operator) return;

      const { error } = await supabase
        .from('operators')
        .update({ is_active: !operator.isActive })
        .eq('id', id);

      if (error) throw error;

      setOperators(prev => prev.map(operator => 
        operator.id === id 
          ? { ...operator, isActive: !operator.isActive, updatedAt: new Date().toISOString() }
          : operator
      ));

      toast({
        title: "Estado actualizado",
        description: `Operador ${operator.isActive ? 'desactivado' : 'activado'} exitosamente.`,
      });
    } catch (error: any) {
      console.error('Error toggling operator status:', error);
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del operador.",
        variant: "destructive",
      });
    }
  };

  return {
    operators,
    loading,
    createOperator,
    updateOperator,
    deleteOperator,
    toggleOperatorStatus,
    refetch: fetchOperators
  };
};
