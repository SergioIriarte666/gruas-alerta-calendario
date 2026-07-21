import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { useCreateDocumentAlert, useUpdateDocumentAlert, DocumentAlert } from '@/hooks/useDocumentAlerts';
import { createLogger } from "@/lib/logger";


const logger = createLogger("DocumentSettingsForm");
const documentSettingsSchema = z.object({
  alertDays: z.number().min(1, 'Debe ser al menos 1 día').max(365, 'Máximo 365 días'),
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  isActive: z.boolean()
});

type DocumentSettingsFormData = z.infer<typeof documentSettingsSchema>;

interface DocumentSettingsFormProps {
  isOpen: boolean;
  onClose: () => void;
  craneId: string;
  documents: Array<{
    name: string;
    type: string;
    expiryDate: string;
    icon: any;
    required: boolean;
  }>;
  existingAlerts: DocumentAlert[];
}

export const DocumentSettingsForm = ({ 
  isOpen, 
  onClose, 
  craneId, 
  documents, 
  existingAlerts 
}: DocumentSettingsFormProps) => {
  const createAlert = useCreateDocumentAlert();
  const updateAlert = useUpdateDocumentAlert();
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<DocumentSettingsFormData>({
    resolver: zodResolver(documentSettingsSchema),
    defaultValues: {
      alertDays: 30,
      emailNotifications: true,
      pushNotifications: true,
      isActive: true
    }
  });

  const handleDocumentSelect = (docType: string) => {
    setSelectedDocument(docType);
    const existingAlert = existingAlerts.find(a => a.documentType === docType);
    
    if (existingAlert) {
      setValue('alertDays', existingAlert.alertDays);
      setValue('emailNotifications', existingAlert.emailNotifications);
      setValue('pushNotifications', existingAlert.pushNotifications);
      setValue('isActive', existingAlert.isActive);
    } else {
      reset({
        alertDays: 30,
        emailNotifications: true,
        pushNotifications: true,
        isActive: true
      });
    }
  };

  const onSubmit = async (data: DocumentSettingsFormData) => {
    if (!selectedDocument) return;

    try {
      const existingAlert = existingAlerts.find(a => a.documentType === selectedDocument);
      
      if (existingAlert) {
        await updateAlert.mutateAsync({
          id: existingAlert.id,
          updates: data
        });
      } else {
        await createAlert.mutateAsync({
          craneId,
          documentType: selectedDocument as any,
          alertDays: data.alertDays,
          emailNotifications: data.emailNotifications,
          pushNotifications: data.pushNotifications,
          isActive: data.isActive
        });
      }
      
      setSelectedDocument(null);
      reset();
    } catch (error) {
      logger.error('Error saving document alert:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="resources-dialog max-w-4xl border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Configuración de Alertas de Documentos
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lista de Documentos */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">Seleccionar Documento</h3>
            {documents.map((doc) => {
              const existingAlert = existingAlerts.find(a => a.documentType === doc.type);
              const isSelected = selectedDocument === doc.type;
              
              return (
                <Card 
                  key={doc.type}
                  className={`cursor-pointer transition-colors ${
                    isSelected 
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => handleDocumentSelect(doc.type)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <doc.icon className="size-5 text-primary" />
                        <div>
                          <h4 className="text-foreground font-medium">{doc.name}</h4>
                          <p className="text-muted-foreground text-sm">
                            Vence: {new Date(doc.expiryDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {existingAlert ? (
                        <div className="text-right">
                          <p className="text-primary text-sm">✓ Configurado</p>
                          <p className="text-muted-foreground text-xs">
                            {existingAlert.alertDays} días antes
                          </p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">Sin configurar</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Formulario de Configuración */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground">
              {selectedDocument ? 'Configurar Alertas' : 'Selecciona un documento'}
            </h3>
            
            {selectedDocument ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="alertDays" className="text-foreground">
                    Días de anticipación
                  </Label>
                  <Input
                    {...register('alertDays', { valueAsNumber: true })}
                    type="number"
                    min="1"
                    max="365"
                    className="bg-card border-primary/30 text-foreground"
                    placeholder="30"
                  />
                  {errors.alertDays && (
                    <p className="text-danger-text text-sm mt-1">{errors.alertDays.message}</p>
                  )}
                  <p className="text-muted-foreground text-sm mt-1">
                    Se enviará una alerta este número de días antes del vencimiento
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-foreground">Notificaciones por Email</Label>
                      <p className="text-muted-foreground text-sm">
                        Recibir alertas por correo electrónico
                      </p>
                    </div>
                    <Switch
                      checked={watch('emailNotifications')}
                      onCheckedChange={(checked) => setValue('emailNotifications', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-foreground">Notificaciones Push</Label>
                      <p className="text-muted-foreground text-sm">
                        Recibir notificaciones en el navegador
                      </p>
                    </div>
                    <Switch
                      checked={watch('pushNotifications')}
                      onCheckedChange={(checked) => setValue('pushNotifications', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-foreground">Activar Alertas</Label>
                      <p className="text-muted-foreground text-sm">
                        Habilitar/deshabilitar las alertas para este documento
                      </p>
                    </div>
                    <Switch
                      checked={watch('isActive')}
                      onCheckedChange={(checked) => setValue('isActive', checked)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedDocument(null)}
                    className="border-border text-muted-foreground"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={createAlert.isPending || updateAlert.isPending}
                  >
                    {existingAlerts.find(a => a.documentType === selectedDocument) ? 'Actualizar' : 'Crear'} Alerta
                  </Button>
                </div>
              </form>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Selecciona un documento de la lista para configurar sus alertas
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
