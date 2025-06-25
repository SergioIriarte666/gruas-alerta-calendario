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
import { User } from 'lucide-react';

interface InspectionFormSectionsProps {
  form: UseFormReturn<InspectionFormValues>;
}

export const InspectionFormSections = ({ form }: InspectionFormSectionsProps) => {
  const { user } = useUser();
  const operatorSignatureRef = useRef<SignaturePadRef>(null);
  const clientSignatureRef = useRef<SignaturePadRef>(null);

  return (
    <>
      <VehicleEquipmentChecklist form={form} />
      
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
                    placeholder="Nombre de quien recibe" 
                    {...field} 
                    className="bg-slate-900 border-slate-600 focus:border-tms-green" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Sección de Firmas Digitales */}
          <div className="space-y-8">
            <h4 className="text-lg font-semibold text-white border-b border-slate-600 pb-2">
              Firmas Digitales
            </h4>
            
            <div className="grid md:grid-cols-2 gap-8">
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
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
