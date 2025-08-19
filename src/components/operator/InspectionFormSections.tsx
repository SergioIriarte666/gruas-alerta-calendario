
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
import { User, Gauge, Fuel, Key, FileText, PenTool } from 'lucide-react';

interface InspectionFormSectionsProps {
  form: UseFormReturn<InspectionFormValues>;
  phase?: 'initial' | 'final';
  isInitialCompleted?: boolean;
}

export const InspectionFormSections = ({ 
  form, 
  phase = 'initial', 
  isInitialCompleted = false 
}: InspectionFormSectionsProps) => {
  const { user } = useUser();
  const operatorSignatureRef = useRef<SignaturePadRef>(null);
  const clientSignatureRef = useRef<SignaturePadRef>(null);
  const receptionSignatureRef = useRef<SignaturePadRef>(null);

  return (
    <>
      <VehicleEquipmentChecklist form={form} />
      
      {/* Sección de Kilometraje y Combustible */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="w-5 h-5" />
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
                  <FormLabel className="flex items-center gap-2">
                    <Gauge className="w-4 h-4" />
                    Kilometraje Actual
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="number"
                      placeholder="Ej: 125000" 
                      {...field} 
                      className="bg-slate-900 border-slate-600 focus:border-tms-green" 
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
                  <FormLabel className="flex items-center gap-2">
                    <Fuel className="w-4 h-4" />
                    Nivel de Combustible
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: 3/4, 1/2, Lleno" 
                      {...field} 
                      className="bg-slate-900 border-slate-600 focus:border-tms-green" 
                    />
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
                  <FormLabel className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Llaves del Vehículo
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Entregadas, No disponibles" 
                      {...field} 
                      className="bg-slate-900 border-slate-600 focus:border-tms-green" 
                    />
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
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Documentación del Vehículo
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Completa, Incompleta" 
                      {...field} 
                      className="bg-slate-900 border-slate-600 focus:border-tms-green" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Sección de Set Fotográfico */}
      <FormField
        control={form.control}
        name="photographicSet"
        render={({ field }) => (
          <FormItem>
            <PhotographicSet
              photos={field.value?.filter(photo => photo.fileName) as Array<{
                fileName: string;
                category: 'izquierdo' | 'derecho' | 'frontal' | 'trasero' | 'interior' | 'motor';
              }> || []}
              onPhotosChange={field.onChange}
            />
            <FormMessage />
          </FormItem>
        )}
      />
      
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader><CardTitle>Observaciones y Firmas</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <FormField
            control={form.control}
            name="vehicleObservations"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observaciones del vehículo del cliente</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Añade cualquier observación sobre el estado del vehículo..." 
                    {...field} 
                    className="bg-slate-900 border-slate-600 focus:border-tms-green"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="clientName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <User className="w-4 h-4" /> 
                    Nombre del Cliente (si está presente)
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nombre de quien solicita el servicio" 
                      {...field} 
                      className="bg-slate-900 border-slate-600 focus:border-tms-green" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="receptionPersonName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <PenTool className="w-4 h-4" /> 
                    Nombre de quien recibe el vehículo
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nombre de quien recibe el vehículo" 
                      {...field} 
                      className="bg-slate-900 border-slate-600 focus:border-tms-green" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Sección de Firmas Digitales */}
          <div className="space-y-8">
            <h4 className="text-lg font-semibold text-white border-b border-slate-600 pb-2">
              Firmas Digitales
            </h4>
            
            <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="operatorSignature"
                render={({ field }) => (
                  <FormItem>
                    <SignaturePad
                      ref={operatorSignatureRef}
                      label="Firma del Operador"
                      personName={user?.name || user?.email || 'Operador'}
                      onSignatureChange={field.onChange}
                      signature={field.value}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="clientSignature"
                render={({ field }) => (
                  <FormItem>
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

              <FormField
                control={form.control}
                name="vehicleReceptionSignature"
                render={({ field }) => (
                  <FormItem>
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
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
