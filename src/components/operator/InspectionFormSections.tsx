
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { VehicleEquipmentChecklist } from '@/components/operator/VehicleEquipmentChecklist';
import { PhotoCapture } from '@/components/operator/PhotoCapture';
import { InspectionFormValues } from '@/schemas/inspectionSchema';
import { User, Signature } from 'lucide-react';

interface InspectionFormSectionsProps {
  form: UseFormReturn<InspectionFormValues>;
}

export const InspectionFormSections = ({ form }: InspectionFormSectionsProps) => {
  return (
    <>
      <VehicleEquipmentChecklist form={form} />
      
      {/* Sección de Fotografías */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-white">Documentación Fotográfica</h3>
        
        <FormField
          control={form.control}
          name="photosBeforeService"
          render={({ field }) => (
            <PhotoCapture
              title="Fotos Antes del Servicio"
              photos={field.value}
              onPhotosChange={field.onChange}
            />
          )}
        />
        
        <FormField
          control={form.control}
          name="photosClientVehicle"
          render={({ field }) => (
            <PhotoCapture
              title="Fotos del Vehículo del Cliente"
              photos={field.value}
              onPhotosChange={field.onChange}
            />
          )}
        />
        
        <FormField
          control={form.control}
          name="photosEquipmentUsed"
          render={({ field }) => (
            <PhotoCapture
              title="Fotos del Equipo Utilizado"
              photos={field.value}
              onPhotosChange={field.onChange}
            />
          )}
        />
      </div>
      
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
                  <Textarea placeholder="Añade cualquier observación sobre el estado del vehículo..." {...field} className="bg-slate-900 border-slate-600 focus:border-tms-green"/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="operatorSignature"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><Signature className="w-4 h-4" /> Firma del Operador (Tu Nombre)</FormLabel>
                  <FormControl>
                    <Input placeholder="Escribe tu nombre completo" {...field} className="bg-slate-900 border-slate-600 focus:border-tms-green"/>
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
                  <FormLabel className="flex items-center gap-2"><User className="w-4 h-4" /> Nombre del Cliente (si está presente)</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre de quien recibe" {...field} className="bg-slate-900 border-slate-600 focus:border-tms-green" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
};
