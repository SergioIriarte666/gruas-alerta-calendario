import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, Trash2, Plus, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuickEntry, QuickEntry } from '@/hooks/useQuickEntry';
import { QuickEntryForm } from './QuickEntryForm';
import { QuickEntryPreview } from './QuickEntryPreview';
import { useQuickEntryContext } from '@/contexts/QuickEntryContext';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { EnhancedServiceForm } from '@/components/services/EnhancedServiceForm';
import { useNavigate } from 'react-router-dom';
import { formatForInput } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("PendingEntriesView");
const TYPE_LABELS = {
  service: 'Servicio',
  cost: 'Costo/Gasto',
  inventory: 'Bodega',
  maintenance: 'Mantenimiento',
};

const TYPE_COLORS = {
  service: 'bg-blue-100 text-blue-800',
  cost: 'bg-red-100 text-red-800',
  inventory: 'bg-green-100 text-green-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
};

export function PendingEntriesView() {
  const [entries, setEntries] = useState<QuickEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<QuickEntry | null>(null);
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<QuickEntry | null>(null);
  const { getPendingEntries, updateEntryStatus, deleteEntry, deleteEntryWithPhotos } = useQuickEntry();
  const { refreshTrigger } = useQuickEntryContext();
  const navigate = useNavigate();

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const data = await getPendingEntries();
      setEntries(data);
    } catch (error) {
      logger.error('Error loading entries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  // Listen for refresh triggers from other components
  useEffect(() => {
    if (refreshTrigger > 0) {
      loadEntries();
    }
  }, [refreshTrigger]);

  // Helper function to prepare data for forms
  const prepareDataForForm = (entry: QuickEntry) => {
    const photos = (entry.data as any)?.photos as Array<{ path?: string; signedUrl?: string }> | undefined;
    const receiptPhotoPaths = photos?.map(p => p.path).filter(Boolean) as string[] | undefined;
    const receiptExtraction = (entry.data as any)?.receipt_extraction as any | undefined;
    const normalizedDate = formatForInput(entry.date);
    const baseData = {
      quickEntryId: entry.id,
      date: normalizedDate,
      description: entry.description,
      notes: entry.notes || '',
      amount: entry.amount || 0,
      receipt_photo_paths: receiptPhotoPaths,
      receipt_extraction: receiptExtraction,
    };

    switch (entry.type) {
      case 'service':
        return {
          ...baseData,
          value: entry.amount || 0,
          requestDate: normalizedDate,
          serviceDate: normalizedDate,
          observations: `${entry.description}${entry.notes ? '\nNotas: ' + entry.notes : ''}`,
        };
      case 'cost': {
        const document_type = (receiptExtraction?.documentType as string | undefined) || 'none';
        const document_number = (receiptExtraction?.documentNumber as string | undefined) || '';
        return {
          ...baseData,
          amount: entry.amount || 0,
          date: normalizedDate,
          description: entry.description,
          notes: entry.notes || '',
          document_type,
          document_number,
        };
      }
      default:
        return baseData;
    }
  };

  const handleShowPreview = (entry: QuickEntry) => {
    setPreviewEntry(entry);
    setIsPreviewOpen(true);
  };

  const handlePreviewComplete = (entry: QuickEntry) => {
    setIsPreviewOpen(false);
    setPreviewEntry(null);
    handleComplete(entry);
  };

  const handlePreviewDiscard = async (entry: QuickEntry) => {
    setIsPreviewOpen(false);
    setPreviewEntry(null);
    await deleteEntryWithPhotos(entry);
    loadEntries();
  };

  const handleComplete = async (entry: QuickEntry) => {
    setSelectedEntry(entry);
    
    try {
      switch (entry.type) {
        case 'service':
          setIsServiceFormOpen(true);
          break;
        case 'cost':
          navigate('/costs', { state: { prefilledData: prepareDataForForm(entry) } });
          break;
        case 'maintenance':
          navigate('/cranes', { state: { prefilledData: prepareDataForForm(entry) } });
          break;
        case 'inventory':
          navigate('/inventory', { state: { prefilledData: prepareDataForForm(entry) } });
          break;
        default:
          // Fallback to direct completion
          handleStatusUpdate(entry.id!, 'completed');
      }
    } catch (error) {
      logger.error('Error completing quick entry:', error);
    }
  };

  const handleStatusUpdate = async (id: string, status: 'completed' | 'discarded') => {
    await updateEntryStatus(id, status);
    loadEntries();
  };

  const handleServiceFormSubmit = async (_serviceData: any) => {
    // After service is created, delete the quick entry
    if (selectedEntry) {
      try {
        await deleteEntry(selectedEntry.id!);
      } catch (error) {
        logger.error('Error deleting quick entry after service creation:', error);
      }
      setSelectedEntry(null);
      setIsServiceFormOpen(false);
      loadEntries();
      navigate('/services');
    }
  };

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    loadEntries();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full size-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Clock className="size-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No hay registros pendientes</h3>
          <p className="text-muted-foreground">
            Los registros rápidos aparecerán aquí para ser completados
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Registros Pendientes</h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{entries.length} pendientes</Badge>
          <Button
            onClick={() => setIsFormOpen(true)}
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="size-4" />
            Nueva Entrada
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={TYPE_COLORS[entry.type]}>
                    {TYPE_LABELS[entry.type]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.created_at!), { 
                      addSuffix: true, 
                      locale: es 
                    })}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(entry.id!)}
                  className="size-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <CardTitle className="text-base">{entry.description}</CardTitle>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-3">
                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Fecha:</span>
                    <p className="font-medium">{new Date(entry.date).toLocaleDateString()}</p>
                  </div>
                  {entry.amount && (
                    <div>
                      <span className="text-muted-foreground">Monto:</span>
                      <p className="font-medium">${entry.amount.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {entry.notes && (
                  <div>
                    <span className="text-muted-foreground text-sm">Notas:</span>
                    <p className="text-sm">{entry.notes}</p>
                  </div>
                )}


                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShowPreview(entry)}
                    className="flex-1"
                  >
                    <Eye className="size-4 mr-2" />
                    Ver detalle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleComplete(entry)}
                    className="flex-1"
                  >
                    <CheckCircle className="size-4 mr-2" />
                    Completar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await deleteEntryWithPhotos(entry);
                      loadEntries();
                    }}
                    className="flex-1"
                  >
                    <XCircle className="size-4 mr-2" />
                    Descartar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <QuickEntryForm 
        isOpen={isFormOpen} 
        onClose={() => {
          setIsFormOpen(false);
          loadEntries();
        }}
      />

      {/* Preview Modal */}
      {previewEntry && (
        <QuickEntryPreview
          entry={previewEntry}
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewEntry(null);
          }}
          onComplete={handlePreviewComplete}
          onDiscard={handlePreviewDiscard}
        />
      )}

      {/* Service Form Modal */}
      {isServiceFormOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Completar Servicio</h2>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setIsServiceFormOpen(false);
                    setSelectedEntry(null);
                  }}
                >
                  <XCircle className="size-4" />
                </Button>
              </div>
              <EnhancedServiceForm
                prefilledData={prepareDataForForm(selectedEntry)}
                onSubmit={handleServiceFormSubmit}
                onCancel={() => {
                  setIsServiceFormOpen(false);
                  setSelectedEntry(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
