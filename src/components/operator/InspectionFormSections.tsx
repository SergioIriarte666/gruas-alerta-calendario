
import React, { useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { VehicleEquipmentChecklist } from '@/components/operator/VehicleEquipmentChecklist';
import { PhotographicSet } from '@/components/operator/PhotographicSet';
import { SignaturePad, SignaturePadRef } from '@/components/operator/SignaturePad';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { useUser } from '@/contexts/UserContext';
import { Gauge, Fuel, Key, FileText, Check, X } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface InspectionFormSectionsProps {
  form: UseFormReturn<InspectionFormValues>;
  phase?: 'initial' | 'final';
  isInitialCompleted?: boolean;
  serviceId: string;
  requiresDetail?: boolean;
  requiresPhotoSet?: boolean;
  isInSitu?: boolean;
  clientName?: string;
  operatorName?: string;
}

export const InspectionFormSections = ({
  form,
  phase = 'initial',
  isInitialCompleted: _isInitialCompleted = false,
  serviceId,
  requiresDetail = true,
  requiresPhotoSet = true,
  isInSitu = false,
  clientName = '',
  operatorName = '',
}: InspectionFormSectionsProps) => {
  const { user } = useUser();
  const operatorSignatureRef = useRef<SignaturePadRef>(null);
  const clientSignatureRef = useRef<SignaturePadRef>(null);
  const receptionSignatureRef = useRef<SignaturePadRef>(null);

  return (
    <>
      {/* Sección de Kilometraje y Combustible */}
      {requiresDetail && <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Gauge className="size-5" />
            Registro del Vehículo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FormField
              control={form.control}
              name="kilometraje"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-foreground">
                    <Gauge className="size-4" />
                    Kilometraje Actual
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      placeholder="Ej: 125000" 
                      {...field} 
                      className="bg-background border-input focus:border-primary"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="combustible"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-foreground">
                    <Fuel className="size-4" />
                    Nivel de Combustible
                  </FormLabel>
                  <FormControl>
                    <ToggleGroup 
                      type="single" 
                      value={field.value} 
                      onValueChange={(value) => value && field.onChange(value)}
                      className="flex flex-wrap gap-1"
                    >
                      {['0', '1/4', '1/2', '3/4', 'full'].map((level) => (
                        <ToggleGroupItem
                          key={level}
                          value={level}
                          className={`px-3 py-2 text-sm font-medium border rounded-md transition-colors ${
                            field.value === level
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'bg-background border-border text-foreground hover:bg-muted'
                          }`}
                        >
                          {level === 'full' ? 'Full' : level}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="llaves"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-foreground">
                    <Key className="size-4" />
                    Llaves del Vehículo
                  </FormLabel>
                  <FormControl>
                    <ToggleGroup 
                      type="single" 
                      value={field.value} 
                      onValueChange={(value) => value && field.onChange(value)}
                      className="flex gap-2"
                    >
                      <ToggleGroupItem
                        value="si"
                        className={`px-4 py-2 text-sm font-medium border rounded-md transition-colors flex items-center gap-2 ${
                          field.value === 'si'
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-background border-border text-foreground hover:bg-muted'
                        }`}
                      >
                        <Check className="size-4" />
                        SÍ
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="no"
                        className={`px-4 py-2 text-sm font-medium border rounded-md transition-colors flex items-center gap-2 ${
                          field.value === 'no'
                            ? 'bg-red-500 text-white border-red-500'
                            : 'bg-background border-border text-foreground hover:bg-muted'
                        }`}
                      >
                        <X className="size-4" />
                        NO
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="documentacion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-foreground">
                    <FileText className="size-4" />
                    Documentación del Vehículo
                  </FormLabel>
                  <FormControl>
                    <ToggleGroup 
                      type="single" 
                      value={field.value} 
                      onValueChange={(value) => value && field.onChange(value)}
                      className="flex gap-2"
                    >
                      <ToggleGroupItem
                        value="si"
                        className={`px-4 py-2 text-sm font-medium border rounded-md transition-colors flex items-center gap-2 ${
                          field.value === 'si'
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-background border-border text-foreground hover:bg-muted'
                        }`}
                      >
                        <Check className="size-4" />
                        SÍ
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="no"
                        className={`px-4 py-2 text-sm font-medium border rounded-md transition-colors flex items-center gap-2 ${
                          field.value === 'no'
                            ? 'bg-red-500 text-white border-red-500'
                            : 'bg-background border-border text-foreground hover:bg-muted'
                        }`}
                      >
                        <X className="size-4" />
                        NO
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>}

      {requiresDetail && <VehicleEquipmentChecklist form={form} />}

      {/* Sección de Set Fotográfico: visible siempre en final y cuando
          requiresPhotoSet=true. En servicios in-situ también se muestra,
          pero como opcional. */}
      {(phase === 'final' || requiresPhotoSet || isInSitu) && (
        <FormField
          control={form.control}
          name="photographicSet"
          render={({ field }) => (
            <FormItem>
              <PhotographicSet
                photos={field.value?.filter(photo => photo.fileName) as Array<{
                  fileName: string;
                  category: 'izquierdo' | 'derecho' | 'frontal' | 'trasero' | 'interior' | 'motor';
                  storageUrl?: string;
                }> || []}
                onPhotosChange={field.onChange}
                serviceId={serviceId}
                phase={phase}
                isOptional={isInSitu && phase === 'initial'}
              />
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-foreground">Observaciones y Firmas</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <FormField
            control={form.control}
            name="vehicleObservations"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">Observaciones del vehículo del cliente</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Añade cualquier observación sobre el estado del vehículo..." 
                    {...field} 
                    className="bg-background border-input focus:border-primary"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Sección de Firmas Digitales */}
          <div className="space-y-8">
            <h4 className="text-lg font-semibold text-foreground border-b border-border pb-2">
              Firmas Digitales
            </h4>
            
            <div className={phase === 'final' ? 'max-w-xl' : 'grid md:grid-cols-2 gap-6'}>
              {phase === 'initial' && (
              <FormField
                control={form.control}
                name="operatorSignature"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormField control={form.control} name="operatorName" render={({ field: nameField }) => (
                      <FormItem>
                        <FormLabel>Nombre del operador</FormLabel>
                        <FormControl><Input {...nameField} placeholder="Nombre del operador" /></FormControl>
                      </FormItem>
                    )} />
                    <SignaturePad
                      ref={operatorSignatureRef}
                      label="Firma del Operador"
                      personName={form.watch('operatorName') || operatorName || user?.name || user?.email || 'Operador'}
                      onSignatureChange={field.onChange}
                      signature={field.value}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              )}
              
              {phase === 'initial' && (
              <FormField
                control={form.control}
                name="clientSignature"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormField control={form.control} name="clientName" render={({ field: nameField }) => (
                      <FormItem>
                        <FormLabel>Nombre del cliente</FormLabel>
                        <FormControl><Input {...nameField} placeholder="Nombre del cliente" /></FormControl>
                      </FormItem>
                    )} />
                    <SignaturePad
                      ref={clientSignatureRef}
                      label="Firma del Cliente"
                      personName={form.watch('clientName') || clientName || 'Cliente'}
                      onSignatureChange={field.onChange}
                      signature={field.value}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              )}

              {phase === 'final' && (
              <FormField
                control={form.control}
                name="vehicleReceptionSignature"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormField control={form.control} name="receptionPersonName" render={({ field: nameField }) => (
                      <FormItem>
                        <FormLabel>Nombre de quien recibe el vehículo</FormLabel>
                        <FormControl><Input {...nameField} placeholder="Nombre de quien recibe el vehículo" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <SignaturePad
                      ref={receptionSignatureRef}
                      label="Recepción del Vehículo"
                      personName={form.watch('receptionPersonName') || 'Recepción'}
                      onSignatureChange={field.onChange}
                      signature={field.value}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
