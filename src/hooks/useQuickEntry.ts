import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';

export interface QuickEntry {
  id?: string;
  type: 'service' | 'cost' | 'inventory' | 'maintenance';
  description: string;
  amount?: number;
  date: string;
  notes?: string;
  status?: 'pending' | 'completed' | 'discarded';
  data?: Record<string, any>;
  photo_url?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export function useQuickEntry() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const createQuickEntry = async (entry: Omit<QuickEntry, 'id'>) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('quick_entries')
        .insert([entry])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Registro guardado",
        description: "El registro rápido se guardó correctamente",
        type: "success",
      });

      return data;
    } catch (error) {
      console.error('Error creating quick entry:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el registro",
        type: "error",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const getPendingEntries = async (): Promise<QuickEntry[]> => {
    try {
      const { data, error } = await supabase
        .from('quick_entries')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as QuickEntry[];
    } catch (error) {
      console.error('Error fetching pending entries:', error);
      return [];
    }
  };

  const updateEntryStatus = async (id: string, status: 'completed' | 'discarded') => {
    try {
      const { error } = await supabase
        .from('quick_entries')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Estado actualizado",
        description: status === 'completed' ? "Entrada completada" : "Entrada descartada",
        type: "success",
      });
    } catch (error) {
      console.error('Error updating entry status:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        type: "error",
      });
    }
  };

  // Prepare prefilled data for forms
  const prepareDataForForm = (entry: QuickEntry) => {
    const photos = (entry.data as any)?.photos as Array<{ path?: string; signedUrl?: string }> | undefined;
    const receiptPhotoPaths = photos?.map(p => p.path).filter(Boolean) as string[] | undefined;
    const baseData = {
      quickEntryId: entry.id,
      date: entry.date,
      description: entry.description,
      notes: entry.notes || '',
      amount: entry.amount,
      receipt_photo_paths: receiptPhotoPaths,
    };

    switch (entry.type) {
      case 'service':
        return {
          ...baseData,
          value: entry.amount || 0,
          requestDate: entry.date,
          serviceDate: entry.date,
          observations: `${entry.description}${entry.notes ? '\nNotas: ' + entry.notes : ''}`,
        };
      case 'cost':
        return {
          ...baseData,
          amount: entry.amount || 0,
          date: entry.date,
          description: entry.description,
          notes: entry.notes || '',
        };
      default:
        return baseData;
    }
  };


  const deleteEntry = async (id: string) => {
    try {
      // Delete the entry
      const { error } = await supabase
        .from('quick_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Registro eliminado",
        description: "El registro se eliminó correctamente",
        type: "success",
      });
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el registro",
        type: "error",
      });
    }
  };

  const deleteEntryWithPhotos = async (entry: QuickEntry) => {
    if (!entry.id) return;
    const photos = (entry.data as any)?.photos as Array<{ path?: string }> | undefined;
    const paths = (photos || []).map(p => p.path).filter(Boolean) as string[];
    if (paths.length > 0) {
      try {
        await supabase.storage.from('quick-entry-photos').remove(paths);
      } catch (error) {
        console.error('Error deleting quick entry photos:', error);
      }
    }
    await deleteEntry(entry.id);
  };

  return {
    createQuickEntry,
    getPendingEntries,
    updateEntryStatus,
    deleteEntry,
    deleteEntryWithPhotos,
    prepareDataForForm,
    isLoading
  };
}
