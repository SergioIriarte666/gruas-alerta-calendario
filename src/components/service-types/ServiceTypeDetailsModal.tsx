import { Check, X, Info, Settings, Car, Wrench } from "lucide-react";
import { ServiceTypeConfig } from "@/types/serviceTypes";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ServiceTypeDetailsModalProps {
  serviceType: ServiceTypeConfig | null;
  isOpen: boolean;
  onClose: () => void;
}

const RequirementRow = ({ label, required }: { label: string; required: boolean }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-sm text-muted-foreground">{label}</span>
    <div className="flex items-center gap-2">
      {required ? (
        <>
          <Check className="size-4 text-green-600" />
          <span className="text-sm font-medium text-green-600">Requerido</span>
        </>
      ) : (
        <>
          <X className="size-4 text-gray-400" />
          <span className="text-sm text-gray-500">Opcional</span>
        </>
      )}
    </div>
  </div>
);

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

  if (!serviceType) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-[95vw] h-[90vh] flex flex-col p-0">
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
                <Info className="size-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="vehicle" className="flex items-center gap-2">
                <Car className="size-4" />
                Vehículo
              </TabsTrigger>
              <TabsTrigger value="requirements" className="flex items-center gap-2">
                <Settings className="size-4" />
                Requerimientos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-0">
              <div className="space-y-4">
                <div className="rounded-lg border border-border border-l-4 border-l-blue-500 bg-blue-500/5 p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <div className="p-1 rounded bg-blue-500/10 text-blue-600">
                      <Info className="size-4" />
                    </div>
                    Información General
                  </h3>
                  
                  {serviceType.description && (
                    <div className="mb-3">
                      <label className="text-sm font-medium text-muted-foreground">Descripción</label>
                      <p className="mt-1 text-sm">{serviceType.description}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Precio Base</label>
                    <p className="mt-1 text-lg font-semibold text-primary">
                      {formatPrice(serviceType.basePrice)}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border border-l-4 border-l-amber-500 bg-amber-500/5 p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <div className="p-1 rounded bg-amber-500/10 text-amber-600">
                      <Settings className="size-4" />
                    </div>
                    Fechas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Fecha de Creación</label>
                      <p className="mt-1 text-sm">{formatDate(serviceType.createdAt)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Última Actualización</label>
                      <p className="mt-1 text-sm">{formatDate(serviceType.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="vehicle" className="mt-0">
              <div className="space-y-4">
                <div className="rounded-lg border border-border border-l-4 border-l-emerald-500 bg-emerald-500/5 p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <div className="p-1 rounded bg-emerald-500/10 text-emerald-600">
                      <Car className="size-4" />
                    </div>
                    Configuración de Vehículo
                  </h3>
                  
                  <div className="flex items-center justify-between p-3 bg-background rounded border mb-3">
                    <span className="text-sm font-medium">Información del vehículo</span>
                    <Badge variant={serviceType.vehicleInfoOptional ? "outline" : "default"}>
                      {serviceType.vehicleInfoOptional ? "Opcional" : "Obligatorio"}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="p-3 border rounded-lg border-l-4 border-l-emerald-300 bg-background">
                      <RequirementRow label="Marca del vehículo" required={serviceType.vehicleBrandRequired} />
                    </div>
                    <div className="p-3 border rounded-lg border-l-4 border-l-emerald-300 bg-background">
                      <RequirementRow label="Modelo del vehículo" required={serviceType.vehicleModelRequired} />
                    </div>
                    <div className="p-3 border rounded-lg border-l-4 border-l-emerald-300 bg-background">
                      <RequirementRow label="Patente" required={serviceType.licensePlateRequired} />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="requirements" className="mt-0">
              <div className="space-y-4">
                <div className="rounded-lg border border-border border-l-4 border-l-violet-500 bg-violet-500/5 p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-violet-700 dark:text-violet-300">
                    <div className="p-1 rounded bg-violet-500/10 text-violet-600">
                      <Wrench className="size-4" />
                    </div>
                    Requerimientos del Servicio
                  </h3>
                  
                  <div className="space-y-2">
                    <div className="p-3 border rounded-lg border-l-4 border-l-violet-300 bg-background">
                      <RequirementRow label="Orden de compra" required={serviceType.purchaseOrderRequired} />
                    </div>
                    <div className="p-3 border rounded-lg border-l-4 border-l-violet-300 bg-background">
                      <RequirementRow label="Origen" required={serviceType.originRequired} />
                    </div>
                    <div className="p-3 border rounded-lg border-l-4 border-l-violet-300 bg-background">
                      <RequirementRow label="Destino" required={serviceType.destinationRequired} />
                    </div>
                    <div className="p-3 border rounded-lg border-l-4 border-l-violet-300 bg-background">
                      <RequirementRow label="Grúa" required={serviceType.craneRequired} />
                    </div>
                    <div className="p-3 border rounded-lg border-l-4 border-l-violet-300 bg-background">
                      <RequirementRow label="Operador" required={serviceType.operatorRequired} />
                    </div>
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
