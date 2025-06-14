
import { useState, useEffect } from 'react';
import { ServiceClosure } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useServiceClosures = () => {
  const [closures, setClosures] = useState<ServiceClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchClosures = async () => {
    try {
      const { data, error } = await supabase
        .from('service_closures')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedClosures: ServiceClosure[] = data.map(closure => ({
        id: closure.id,
        folio: closure.folio,
        serviceIds: [], // Will be populated by junction table
        dateRange: {
          from: closure.date_from,
          to: closure.date_to
        },
        clientId: closure.client_id || undefined,
        total: Number(closure.total),
        status: closure.status as ServiceClosure['status'],
        createdAt: closure.created_at,
        updatedAt: closure.updated_at
      }));

      setClosures(formattedClosures);
    } catch (error: any) {
      console.error('Error fetching closures:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los cierres.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosures();
  }, []);

  const createClosure = async (closureData: Omit<ServiceClosure, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Generate folio
      const count = await supabase
        .from('service_closures')
        .select('id', { count: 'exact' });
      
      const folio = `CIE-${String((count.count || 0) + 1).padStart(3, '0')}`;

      const { data, error } = await supabase
        .from('service_closures')
        .insert({
          folio,
          date_from: closureData.dateRange.from,
          date_to: closureData.dateRange.to,
          client_id: closureData.clientId || null,
          total: closureData.total,
          status: closureData.status
        })
        .select()
        .single();

      if (error) throw error;

      const newClosure: ServiceClosure = {
        id: data.id,
        folio: data.folio,
        serviceIds: closureData.serviceIds,
        dateRange: {
          from: data.date_from,
          to: data.date_to
        },
        clientId: data.client_id || undefined,
        total: Number(data.total),
        status: data.status as ServiceClosure['status'],
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      setClosures(prev => [newClosure, ...prev]);
      
      toast({
        title: "Cierre creado",
        description: `Cierre ${folio} creado exitosamente.`,
      });

      return newClosure;
    } catch (error: any) {
      console.error('Error creating closure:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el cierre.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateClosure = async (id: string, closureData: Partial<ServiceClosure>) => {
    try {
      const updateData: any = {};
      
      if (closureData.dateRange) {
        updateData.date_from = closureData.dateRange.from;
        updateData.date_to = closureData.dateRange.to;
      }
      if (closureData.clientId !== undefined) {
        updateData.client_id = closureData.clientId;
      }
      if (closureData.total !== undefined) {
        updateData.total = closureData.total;
      }
      if (closureData.status !== undefined) {
        updateData.status = closureData.status;
      }

      const { error } = await supabase
        .from('service_closures')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      setClosures(prev => prev.map(closure => 
        closure.id === id 
          ? { ...closure, ...closureData, updatedAt: new Date().toISOString() }
          : closure
      ));

      toast({
        title: "Cierre actualizado",
        description: "El cierre ha sido actualizado exitosamente.",
      });
    } catch (error: any) {
      console.error('Error updating closure:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el cierre.",
        variant: "destructive",
      });
    }
  };

  const deleteClosure = async (id: string) => {
    try {
      const { error } = await supabase
        .from('service_closures')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setClosures(prev => prev.filter(closure => closure.id !== id));
      
      toast({
        title: "Cierre eliminado",
        description: "El cierre ha sido eliminado exitosamente.",
      });
    } catch (error: any) {
      console.error('Error deleting closure:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el cierre.",
        variant: "destructive",
      });
    }
  };

  const closeClosure = async (id: string) => {
    try {
      const { error } = await supabase
        .from('service_closures')
        .update({ status: 'closed' })
        .eq('id', id);

      if (error) throw error;

      setClosures(prev => prev.map(closure => 
        closure.id === id 
          ? { ...closure, status: 'closed' as const, updatedAt: new Date().toISOString() }
          : closure
      ));

      toast({
        title: "Cierre procesado",
        description: "El cierre ha sido procesado exitosamente.",
      });
    } catch (error: any) {
      console.error('Error closing closure:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar el cierre.",
        variant: "destructive",
      });
    }
  };

  return {
    closures,
    loading,
    createClosure,
    updateClosure,
    deleteClosure,
    closeClosure,
    refetch: fetchClosures
  };
};
