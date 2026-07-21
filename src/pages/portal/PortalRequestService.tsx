import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  portalRequestServiceSchema,
  PortalRequestServiceSchema,
} from "@/schemas/portalRequestServiceSchema";
import { useServiceRequest } from "@/hooks/portal/useServiceRequest";
import { useServiceTypesForPortal } from "@/hooks/portal/useServiceTypesForPortal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DatePickerInput from "@/components/common/DatePickerInput";
import { createLogger } from "@/lib/logger";

const logger = createLogger("PortalRequestService");
const PortalRequestService = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<PortalRequestServiceSchema>({
    resolver: zodResolver(portalRequestServiceSchema),
    defaultValues: {
      urgency: "normal",
    },
  });
  const { mutate: requestService, isPending } = useServiceRequest();
  const { serviceTypes, loading: loadingServiceTypes } =
    useServiceTypesForPortal();

  const selectedServiceTypeId = watch("service_type_id");
  const [selectedServiceType, setSelectedServiceType] = useState<any>(null);

  // Actualizar el tipo de servicio seleccionado cuando cambia
  useEffect(() => {
    if (selectedServiceTypeId && serviceTypes.length > 0) {
      const serviceType = serviceTypes.find(
        (st) => st.id === selectedServiceTypeId,
      );
      setSelectedServiceType(serviceType);
    } else {
      setSelectedServiceType(null);
    }
  }, [selectedServiceTypeId, serviceTypes]);

  const onSubmit = (data: PortalRequestServiceSchema) => {
    logger.debug("Enviando solicitud con datos:", data);
    requestService(data);
  };

  const isLicensePlateRequired =
    selectedServiceType?.license_plate_required || false;
  const isVehicleBrandRequired =
    selectedServiceType?.vehicle_brand_required || false;
  const isVehicleModelRequired =
    selectedServiceType?.vehicle_model_required || false;
  const showVehicleFields =
    selectedServiceType &&
    (isLicensePlateRequired ||
      isVehicleBrandRequired ||
      isVehicleModelRequired ||
      selectedServiceType.vehicle_info_optional);

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-foreground sm:text-2xl">
        Solicitar Nuevo Servicio
      </h1>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">
            Detalles de la Solicitud
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Complete el formulario para solicitar un nuevo servicio de grúa. Su
            solicitud será revisada y se asignarán los recursos necesarios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Tipo de Servicio */}
            <div>
              <Label
                htmlFor="service_type_id"
                className="text-sm text-foreground"
              >
                Tipo de Servicio *
              </Label>
              <Select
                onValueChange={(value) => setValue("service_type_id", value)}
                disabled={loadingServiceTypes}
              >
                <SelectTrigger className="border-border bg-muted/40 text-foreground">
                  <SelectValue
                    placeholder={
                      loadingServiceTypes
                        ? "Cargando..."
                        : "Selecciona un tipo de servicio"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((serviceType) => (
                    <SelectItem key={serviceType.id} value={serviceType.id}>
                      {serviceType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.service_type_id && (
                <p className="text-danger-text text-sm mt-1">
                  {errors.service_type_id.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Columna Izquierda */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="origin" className="text-sm text-foreground">
                    Origen{" "}
                    {selectedServiceType?.origin_required && (
                      <span className="text-danger-text">*</span>
                    )}
                    {!selectedServiceType?.origin_required && (
                      <span className="text-muted-foreground text-sm">
                        (Opcional)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="origin"
                    {...register("origin")}
                    className="border-input bg-muted/40 text-foreground focus:border-primary"
                  />
                  {errors.origin && (
                    <p className="text-danger-text text-sm mt-1">
                      {errors.origin.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label
                    htmlFor="destination"
                    className="text-sm text-foreground"
                  >
                    Destino{" "}
                    {selectedServiceType?.destination_required && (
                      <span className="text-danger-text">*</span>
                    )}
                    {!selectedServiceType?.destination_required && (
                      <span className="text-muted-foreground text-sm">
                        (Opcional)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="destination"
                    {...register("destination")}
                    className="border-input bg-muted/40 text-foreground focus:border-primary"
                  />
                  {errors.destination && (
                    <p className="text-danger-text text-sm mt-1">
                      {errors.destination.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label
                    htmlFor="service_date"
                    className="text-sm text-foreground"
                  >
                    Fecha de Servicio *
                  </Label>
                  <DatePickerInput
                    id="service_date"
                    value={watch("service_date") || ""}
                    onChange={(value) => setValue("service_date", value)}
                    placeholder="Seleccionar fecha"
                    className="border-border bg-muted/40 text-foreground"
                  />
                  {errors.service_date && (
                    <p className="text-danger-text text-sm mt-1">
                      {errors.service_date.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label
                    htmlFor="observations"
                    className="text-sm text-foreground"
                  >
                    Observaciones
                  </Label>
                  <Textarea
                    id="observations"
                    {...register("observations")}
                    className="border-input bg-muted/40 text-foreground focus:border-primary"
                  />
                </div>
                <div>
                  <Label className="text-sm text-foreground">Urgencia</Label>
                  <div className="mt-1 flex gap-3">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        value="normal"
                        {...register("urgency")}
                        defaultChecked
                      />
                      <span className="text-sm text-foreground">Normal</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        value="urgent"
                        {...register("urgency")}
                      />
                      <span className="text-sm text-danger-text">Urgente</span>
                    </label>
                  </div>
                </div>
                <div>
                  <Label
                    htmlFor="preferred_time"
                    className="text-sm text-foreground"
                  >
                    Hora preferida{" "}
                    <span className="text-muted-foreground text-sm">
                      (Opcional)
                    </span>
                  </Label>
                  <Input
                    id="preferred_time"
                    type="time"
                    {...register("preferred_time")}
                    className="border-input bg-muted/40 text-foreground focus:border-primary"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="contact_phone"
                    className="text-sm text-foreground"
                  >
                    Telefono de contacto{" "}
                    <span className="text-muted-foreground text-sm">
                      (Opcional)
                    </span>
                  </Label>
                  <Input
                    id="contact_phone"
                    {...register("contact_phone")}
                    placeholder="Ej: +56 9 1234 5678"
                    className="border-input bg-muted/40 text-foreground focus:border-primary"
                  />
                  {errors.contact_phone && (
                    <p className="text-danger-text text-sm mt-1">
                      {errors.contact_phone.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Columna Derecha - Información del Vehículo */}
              <div className="space-y-4">
                {selectedServiceType &&
                  !isLicensePlateRequired &&
                  !isVehicleBrandRequired &&
                  !isVehicleModelRequired && (
                    <div className="rounded-md border border-info/30 bg-info-soft p-3">
                      <p className="text-sm text-info-text">
                        ℹ️ Para este tipo de servicio, toda la información del
                        vehículo es opcional.
                      </p>
                    </div>
                  )}

                {showVehicleFields && (
                  <>
                    <div>
                      <Label
                        htmlFor="license_plate"
                        className="text-sm text-foreground"
                      >
                        Patente del Vehículo{" "}
                        {isLicensePlateRequired && (
                          <span className="text-danger-text">*</span>
                        )}
                      </Label>
                      <Input
                        id="license_plate"
                        {...register("license_plate")}
                        className="border-input bg-muted/40 text-foreground focus:border-primary"
                        placeholder="Ej: AB-CD-12"
                      />
                      {errors.license_plate && (
                        <p className="text-danger-text text-sm mt-1">
                          {errors.license_plate.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label
                        htmlFor="vehicle_brand"
                        className="text-sm text-foreground"
                      >
                        Marca del Vehículo{" "}
                        {isVehicleBrandRequired && (
                          <span className="text-danger-text">*</span>
                        )}
                      </Label>
                      <Input
                        id="vehicle_brand"
                        {...register("vehicle_brand")}
                        className="border-input bg-muted/40 text-foreground focus:border-primary"
                        placeholder="Ej: Toyota"
                      />
                      {errors.vehicle_brand && (
                        <p className="text-danger-text text-sm mt-1">
                          {errors.vehicle_brand.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label
                        htmlFor="vehicle_model"
                        className="text-sm text-foreground"
                      >
                        Modelo del Vehículo{" "}
                        {isVehicleModelRequired && (
                          <span className="text-danger-text">*</span>
                        )}
                      </Label>
                      <Input
                        id="vehicle_model"
                        {...register("vehicle_model")}
                        className="border-input bg-muted/40 text-foreground focus:border-primary"
                        placeholder="Ej: Corolla"
                      />
                      {errors.vehicle_model && (
                        <p className="text-danger-text text-sm mt-1">
                          {errors.vehicle_model.message}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {selectedServiceType && !showVehicleFields && (
                  <div className="rounded-md border border-border bg-muted/40 p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Este tipo de servicio no requiere información del
                      vehículo.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Botón de envío */}
            <div className="flex justify-end">
              <Button
                type="submit"
                className="bg-primary font-medium text-primary-foreground hover:bg-primary/90"
                disabled={isPending || !selectedServiceTypeId}
              >
                {isPending ? "Enviando..." : "Enviar Solicitud"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PortalRequestService;
