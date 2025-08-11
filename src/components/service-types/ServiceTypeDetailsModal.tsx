import { Check, X, Info, Settings, Car, Wrench } from "lucide-react";
import { ServiceTypeConfig } from "@/types/serviceTypes";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ServiceTypeDetailsModalProps {
  serviceType: ServiceTypeConfig | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ServiceTypeDetailsModal({
  serviceType,
  isOpen,
  onClose,
}: ServiceTypeDetailsModalProps) {
  const formatPrice = (price?: number): string => {
    if (!price) return "No definido";
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
    }).format(price);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("es-CL", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const RequirementRow = ({ label, required }: { label: string; required: boolean }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {required ? (
          <>
            <Check className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">Requerido</span>
          </>
        ) : (
          <>
            <X className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Opcional</span>
          </>
        )}
      </div>
    </div>
  );

  if (!serviceType) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 border-b border-border flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {serviceType.name}
            <Badge variant={serviceType.isActive ? "default" : "secondary"}>
              {serviceType.isActive ? "Activo" : "Inactivo"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="vehicle" className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                Vehículo
              </TabsTrigger>
              <TabsTrigger value="requirements" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Requerimientos
              </TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="mt-0">
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Información General</h3>
                </div>
                
                {serviceType.description && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <label className="text-sm font-medium text-muted-foreground">
                      Descripción
                    </label>
                    <p className="mt-1 text-sm">{serviceType.description}</p>
                  </div>
                )}

                <div className="p-4 bg-muted/50 rounded-lg">
                  <label className="text-sm font-medium text-muted-foreground">
                    Precio Base
                  </label>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    {formatPrice(serviceType.basePrice)}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <label className="text-sm font-medium text-muted-foreground">
                      Fecha de Creación
                    </label>
                    <p className="mt-1 text-sm">{formatDate(serviceType.createdAt)}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <label className="text-sm font-medium text-muted-foreground">
                      Última Actualización
                    </label>
                    <p className="mt-1 text-sm">{formatDate(serviceType.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="vehicle" className="mt-0">
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Car className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Configuración de Vehículo</h3>
                </div>
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Información del vehículo</span>
                    <Badge variant={serviceType.vehicleInfoOptional ? "outline" : "default"}>
                      {serviceType.vehicleInfoOptional ? "Opcional" : "Obligatorio"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <RequirementRow 
                      label="Marca del vehículo" 
                      required={serviceType.vehicleBrandRequired} 
                    />
                  </div>
                  <div className="p-3 border rounded-lg">
                    <RequirementRow 
                      label="Modelo del vehículo" 
                      required={serviceType.vehicleModelRequired} 
                    />
                  </div>
                  <div className="p-3 border rounded-lg">
                    <RequirementRow 
                      label="Patente" 
                      required={serviceType.licensePlateRequired} 
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="requirements" className="mt-0">
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Wrench className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Requerimientos del Servicio</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <RequirementRow 
                      label="Orden de compra" 
                      required={serviceType.purchaseOrderRequired} 
                    />
                  </div>
                  <div className="p-3 border rounded-lg">
                    <RequirementRow 
                      label="Origen" 
                      required={serviceType.originRequired} 
                    />
                  </div>
                  <div className="p-3 border rounded-lg">
                    <RequirementRow 
                      label="Destino" 
                      required={serviceType.destinationRequired} 
                    />
                  </div>
                  <div className="p-3 border rounded-lg">
                    <RequirementRow 
                      label="Grúa" 
                      required={serviceType.craneRequired} 
                    />
                  </div>
                  <div className="p-3 border rounded-lg">
                    <RequirementRow 
                      label="Operador" 
                      required={serviceType.operatorRequired} 
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}