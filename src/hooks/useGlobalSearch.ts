import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GlobalSearchResult {
  id: string;
  type: 'service' | 'client' | 'invoice' | 'operator' | 'crane';
  title: string;
  subtitle: string;
  path: string;
}

export const useGlobalSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const searchServices = async (term: string): Promise<GlobalSearchResult[]> => {
    const { data, error } = await supabase
      .from('services')
      .select(`
        id,
        folio,
        origin,
        destination,
        clients:client_id (name)
      `)
      .or(`folio.ilike.%${term}%,origin.ilike.%${term}%,destination.ilike.%${term}%`)
      .limit(5);

    if (error) throw error;

    return (data || []).map(service => ({
      id: service.id,
      type: 'service' as const,
      title: `Servicio ${service.folio}`,
      subtitle: `${service.origin} → ${service.destination}`,
      path: `/services`
    }));
  };

  const searchClients = async (term: string): Promise<GlobalSearchResult[]> => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, rut, email')
      .or(`name.ilike.%${term}%,rut.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(5);

    if (error) throw error;

    return (data || []).map(client => ({
      id: client.id,
      type: 'client' as const,
      title: client.name,
      subtitle: client.rut || client.email || '',
      path: `/clients`
    }));
  };

  const searchInvoices = async (term: string): Promise<GlobalSearchResult[]> => {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id,
        folio,
        total,
        clients:client_id (name)
      `)
      .ilike('folio', `%${term}%`)
      .limit(5);

    if (error) throw error;

    return (data || []).map(invoice => ({
      id: invoice.id,
      type: 'invoice' as const,
      title: `Factura ${invoice.folio}`,
      subtitle: `Total: $${new Intl.NumberFormat('es-CL').format(invoice.total)}`,
      path: `/invoices`
    }));
  };

  const searchOperators = async (term: string): Promise<GlobalSearchResult[]> => {
    const { data, error } = await supabase
      .from('operators')
      .select('id, name, rut, license_number')
      .or(`name.ilike.%${term}%,rut.ilike.%${term}%,license_number.ilike.%${term}%`)
      .limit(3);

    if (error) throw error;

    return (data || []).map(operator => ({
      id: operator.id,
      type: 'operator' as const,
      title: operator.name,
      subtitle: `RUT: ${operator.rut}`,
      path: `/operators`
    }));
  };

  const searchCranes = async (term: string): Promise<GlobalSearchResult[]> => {
    const { data, error } = await supabase
      .from('cranes')
      .select('id, license_plate, brand, model')
      .or(`license_plate.ilike.%${term}%,brand.ilike.%${term}%,model.ilike.%${term}%`)
      .limit(3);

    if (error) throw error;

    return (data || []).map(crane => ({
      id: crane.id,
      type: 'crane' as const,
      title: `${crane.brand} ${crane.model}`,
      subtitle: `Patente: ${crane.license_plate}`,
      path: `/cranes`
    }));
  };

  const performSearch = async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const [services, clients, invoices, operators, cranes] = await Promise.allSettled([
        searchServices(term),
        searchClients(term),
        searchInvoices(term),
        searchOperators(term),
        searchCranes(term)
      ]);

      const allResults: GlobalSearchResult[] = [
        ...(services.status === 'fulfilled' ? services.value : []),
        ...(clients.status === 'fulfilled' ? clients.value : []),
        ...(invoices.status === 'fulfilled' ? invoices.value : []),
        ...(operators.status === 'fulfilled' ? operators.value : []),
        ...(cranes.status === 'fulfilled' ? cranes.value : [])
      ];

      setResults(allResults);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Error al realizar la búsqueda');
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        performSearch(searchTerm);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleResultClick = (result: GlobalSearchResult) => {
    navigate(result.path);
    setIsOpen(false);
    setSearchTerm('');
    setResults([]);
  };

  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    if (value.trim().length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleInputFocus = () => {
    if (searchTerm.trim().length >= 2) {
      setIsOpen(true);
    }
  };

  const handleInputBlur = () => {
    // Delay closing to allow clicking on results
    setTimeout(() => setIsOpen(false), 200);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
  };

  return {
    searchTerm,
    results,
    isLoading,
    isOpen,
    handleInputChange,
    handleInputFocus,
    handleInputBlur,
    handleResultClick,
    clearSearch
  };
};