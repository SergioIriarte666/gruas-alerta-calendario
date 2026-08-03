
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
import { Gauge, Fuel, Key, FileText } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatRut } from '@/utils/rutFormatter';

interface InspectionFormSectionsProps {
  form: UseFormReturn<InspectionFormValues>;
  phase?: 'initial' | 'final';
  isInitialCompleted?: boolean;
  serviceId: string;
  requiresDetail?: boolean;
  requiresPhotoSet?: boolean;
  isInSitu?: boolean;
  operatorName?: string;
}

const FUEL_LEVELS = [
  { value: '0', label: 'Vacío', filledBars: 0 },
  { value: '1/4', label: '¼', filledBars: 1 },
  { value: '1/2', label: '½', filledBars: 2 },
  { value: '3/4', label: '¾', filledBars: 3 },
  { value: 'full', label: 'Lleno', filledBars: 4 },
] as const;

export const InspectionFormSections = ({
  form,
  phase = 'initial',
  isInitialCompleted: _isInitialCompleted = false,
  serviceId,
  requiresDetail = true,
  requiresPhotoSet = true,
  isInSitu = false,
  operatorName = '',
}: InspectionFormSectionsProps) => {
  const { user } = useUser();
  const operatorSignatureRef = useRef<SignaturePadRef>(null);
  const clientSignatureRef = useRef<SignaturePadRef>(null);
  const receptionSignatureRef = useRef<SignaturePadRef>(null);

  return (
    <>
      {/* Sección de Kilometraje y Combustible */}
      {requiresDetail && <Card className="operator-inspection-card rounded-3xl bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-foreground">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Gauge className="size-5" />
            </span>
            <div>
              <p className="operator-native-eyebrow">Paso 1</p>
              <p className="text-lg">Registro del vehículo</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="operator-vehicle-fields grid gap-5">
            <FormField
              control={form.control}
              name="kilometraje"
              render={({ field }) => (
                <FormItem className="operator-vehicle-field operator-vehicle-field--mileage">
                  <FormLabel className="flex items-center gap-2 text-foreground">
                    <Gauge className="size-4" />
                    Kilometraje Actual
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      placeholder="Ej: 125000" 
                      {...field} 
                      className="min-h-12 rounded-xl bg-background text-base"
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
                <FormItem className="operator-vehicle-field operator-vehicle-field--fuel">
                  <FormLabel className="flex items-center gap-2 text-foreground">
                    <Fuel className="size-4" />
                    Nivel de Combustible
                  </FormLabel>
                  <FormControl>
                    <ToggleGroup 
                      type="single" 
                      value={field.value} 
                      onValueChange={(value) => value && field.onChange(value)}
                      className="operator-fuel-selector"
                    >
                      {FUEL_LEVELS.map((level) => (
                        <ToggleGroupItem
                          key={level.value}
                          value={level.value}
                          aria-label={`${level.label}, nivel ${level.value === 'full' ? 'completo' : level.value}`}
                          className="operator-fuel-option"
                        >
                          <span className="operator-fuel-gauge" aria-hidden="true">
                            {[0, 1, 2, 3].map((barIndex) => (
                              <span
                                key={barIndex}
                                className={barIndex < level.filledBars ? 'is-filled' : undefined}
                              />
                            ))}
                          </span>
                          <span className="operator-fuel-label">{level.label}</span>
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
                <FormItem className="operator-vehicle-field operator-vehicle-field--binary">
                  <FormLabel className="flex items-center gap-2 text-foreground">
                    <Key className="size-4" />
                    Llaves del Vehículo
                  </FormLabel>
                  <FormControl>
                    <ToggleGroup 
                      type="single" 
                      value={field.value} 
                      onValueChange={(value) => value && field.onChange(value)}
                      className="operator-binary-selector grid grid-cols-2 gap-1.5"
                    >
                      <ToggleGroupItem
                        value="si"
                        className={`operator-binary-option flex min-h-11 items-center justify-center rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${
                          field.value === 'si'
                            ? 'border-success/30 bg-success text-success-foreground'
                            : 'bg-background border-border text-foreground hover:bg-muted'
                        }`}
                      >
                        SÍ
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="no"
                        className={`operator-binary-option flex min-h-11 items-center justify-center rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${
                          field.value === 'no'
                            ? 'border-danger/30 bg-danger text-danger-foreground'
                            : 'bg-background border-border text-foreground hover:bg-muted'
                        }`}
                      >
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
                <FormItem className="operator-vehicle-field operator-vehicle-field--binary">
                  <FormLabel className="flex items-center gap-2 text-foreground">
                    <FileText className="size-4" />
                    Documentación del Vehículo
                  </FormLabel>
                  <FormControl>
                    <ToggleGroup 
                      type="single" 
                      value={field.value} 
                      onValueChange={(value) => value && field.onChange(value)}
                      className="operator-binary-selector grid grid-cols-2 gap-1.5"
                    >
                      <ToggleGroupItem
                        value="si"
                        className={`operator-binary-option flex min-h-11 items-center justify-center rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${
                          field.value === 'si'
                            ? 'border-success/30 bg-success text-success-foreground'
                            : 'bg-background border-border text-foreground hover:bg-muted'
                        }`}
                      >
                        SÍ
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="no"
                        className={`operator-binary-option flex min-h-11 items-center justify-center rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${
                          field.value === 'no'
                            ? 'border-danger/30 bg-danger text-danger-foreground'
                            : 'bg-background border-border text-foreground hover:bg-muted'
                        }`}
                      >
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

      <Card className="operator-inspection-card rounded-3xl bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">
            <p className="operator-native-eyebrow">Último paso</p>
            <p className="mt-1 text-lg">Observaciones y firmas</p>
          </CardTitle>
        </CardHeader>
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
                    className="min-h-28 rounded-2xl bg-background text-base"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Sección de Firmas Digitales */}
          <div className="space-y-8">
            <h4 className="border-b border-border pb-3 text-base font-semibold text-foreground">
              Firmas digitales
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
                        <FormControl><Input {...nameField} placeholder="Nombre del operador" className="min-h-12 rounded-xl text-base" /></FormControl>
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
                    {/* Identidad de la PERSONA que entrega el vehículo, escrita
                        por el operador. No se prellena con la razón social del
                        cliente: el acta la usa como firmante. */}
                    <FormField control={form.control} name="clientName" render={({ field: nameField }) => (
                      <FormItem>
                        <FormLabel>Nombre de quien entrega el vehículo *</FormLabel>
                        <FormControl>
                          <Input
                            {...nameField}
                            value={nameField.value ?? ''}
                            placeholder="Nombre y apellido"
                            className="min-h-12 rounded-xl text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="clientRut" render={({ field: rutField }) => (
                      <FormItem>
                        <FormLabel>RUT de quien entrega *</FormLabel>
                        <FormControl>
                          <Input
                            {...rutField}
                            value={rutField.value ?? ''}
                            onChange={(event) => rutField.onChange(formatRut(event.target.value))}
                            inputMode="text"
                            autoCapitalize="characters"
                            placeholder="12.345.678-9"
                            className="min-h-12 rounded-xl text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <SignaturePad
                      ref={clientSignatureRef}
                      label="Firma del Cliente"
                      personName={form.watch('clientName') || 'Cliente'}
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
                    {/* Identidad del RECEPTOR. Par propio (receiver_name /
                        receiver_rut): escribirla sobre client_* borraría a
                        quien entregó el vehículo en el retiro. */}
                    <FormField control={form.control} name="receptionPersonName" render={({ field: nameField }) => (
                      <FormItem>
                        <FormLabel>Nombre de quien recibe el vehículo *</FormLabel>
                        <FormControl>
                          <Input
                            {...nameField}
                            value={nameField.value ?? ''}
                            placeholder="Nombre y apellido"
                            className="min-h-12 rounded-xl text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="receptionPersonRut" render={({ field: rutField }) => (
                      <FormItem>
                        <FormLabel>RUT de quien recibe *</FormLabel>
                        <FormControl>
                          <Input
                            {...rutField}
                            value={rutField.value ?? ''}
                            onChange={(event) => rutField.onChange(formatRut(event.target.value))}
                            inputMode="text"
                            autoCapitalize="characters"
                            placeholder="12.345.678-9"
                            className="min-h-12 rounded-xl text-base"
                          />
                        </FormControl>
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
