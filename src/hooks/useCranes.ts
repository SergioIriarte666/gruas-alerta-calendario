
import { useState, useEffect } from 'react';
import { Crane } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useCranes = () => {
  const [cranes, setCranes] = useState<Crane[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCranes = async () => {
    try {
      const { data, error } = await supabase
        .from('cranes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedCranes: Crane[] = data.map(crane => ({
        id: crane.id,
        licensePlate: crane.license_plate,
        brand: crane.brand,
        model: crane.model,
        type: crane.type as Crane['type'],
        circulationPermitExpiry: crane.circulation_permit_expiry,
        insuranceExpiry: crane.insurance_expiry,
        technicalReviewExpiry: crane.technical_review_expiry,
        isActive: crane.is_active || false,
        createdAt: crane.created_at,
        updatedAt: crane.updated_at
      }));

      setCranes(formattedCranes);
    } catch (error: any) {
      console.error('Error fetching cranes:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las grúas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCranes();
  }, []);

  const createCrane = async (craneData: Omit<Crane, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const { data, error } = await supabase
        .from('cranes')
        .insert({
          license_plate: craneData.licensePlate,
          brand: craneData.brand,
          model: craneData.model,
          type: craneData.type,
          circulation_permit_expiry: craneData.circulationPermitExpiry,
          insurance_expiry: craneData.insuranceExpiry,
          technical_review_expiry: craneData.technicalReviewExpiry,
          is_active: craneData.isActive
        })
        .select()
        .single();

      if (error) throw error;

      const newCrane: Crane = {
        id: data.id,
        licensePlate: data.license_plate,
        brand: data.brand,
        model: data.model,
        type: data.type as Crane['type'],
        circulationPermitExpiry: data.circulation_permit_expiry,
        insuranceExpiry: data.insurance_expiry,
        technicalReviewExpiry: data.technical_review_expiry,
        isActive: data.is_active || false,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      setCranes(prev => [newCrane, ...prev]);
      
      toast({
        title: "Grúa creada",
        description: `Grúa ${craneData.licensePlate} creada exitosamente.`,
      });

      return newCrane;
    } catch (error: any) {
      console.error('Error creating crane:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la grúa.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateCrane = async (id: string, craneData: Partial<Crane>) => {
    try {
      const updateData: any = {};
      
      if (craneData.licensePlate !== undefined) updateData.license_plate = craneData.licensePlate;
      if (craneData.brand !== undefined) updateData.brand = craneData.brand;
      if (craneData.model !== undefined) updateData.model = craneData.model;
      if (craneData.type !== undefined) updateData.type = craneData.type;
      if (craneData.circulationPermitExpiry !== undefined) updateData.circulation_permit_expiry = craneData.circulationPermitExpiry;
      if (craneData.insuranceExpiry !== undefined) updateData.insurance_expiry = craneData.insuranceExpiry;
      if (craneData.technicalReviewExpiry !== undefined) updateData.technical_review_expiry = craneData.technicalReviewExpiry;
      if (craneData.isActive !== undefined) updateData.is_active = craneData.isActive;

      const { error } = await supabase
        .from('cranes')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      setCranes(prev => prev.map(crane => 
        crane.id === id 
          ? { ...crane, ...craneData, updatedAt: new Date().toISOString() }
          : crane
      ));

      toast({
        title: "Grúa actualizada",
        description: "La grúa ha sido actualizada exitosamente.",
      });
    } catch (error: any) {
      console.error('Error updating crane:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la grúa.",
        variant: "destructive",
      });
    }
  };

  const deleteCrane = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cranes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCranes(prev => prev.filter(crane => crane.id !== id));
      
      toast({
        title: "Grúa eliminada",
        description: "La grúa ha sido eliminada exitosamente.",
      });
    } catch (error: any) {
      console.error('Error deleting crane:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la grúa.",
        variant: "destructive",
      });
    }
  };

  const toggleCraneStatus = async (id: string) => {
    try {
      const crane = cranes.find(c => c.id === id);
      if (!crane) return;

      const { error } = await supabase
        .from('cranes')
        .update({ is_active: !crane.isActive })
        .eq('id', id);

      if (error) throw error;

      setCranes(prev => prev.map(crane => 
        crane.id === id 
          ? { ...crane, isActive: !crane.isActive, updatedAt: new Date().toISOString() }
          : crane
      ));

      toast({
        title: "Estado actualizado",
        description: `Grúa ${crane.isActive ? 'desactivada' : 'activada'} exitosamente.`,
      });
    } catch (error: any) {
      console.error('Error toggling crane status:', error);
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado de la grúa.",
        variant: "destructive",
      });
    }
  };

  return {
    cranes,
    loading,
    createCrane,
    updateCrane,
    deleteCrane,
    toggleCraneStatus,
    refetch: fetchCranes
  };
};
