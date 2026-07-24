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
import DatePickerInput from "@/components/common/DatePickerInput";
import { createLogger } from "@/lib/logger";
import { Check, ClipboardList, Route, Send, Truck } from "lucide-react";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalServiceTypeCombobox } from "@/components/portal/PortalServiceTypeCombobox";

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
  const selectedServiceType =
    serviceTypes.find((serviceType) => serviceType.id === selectedServiceTypeId) ||
    null;

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
    <div className="portal-page portal-request-page">
      <PortalPageHeader
        eyebrow="Nueva operación"
        title="Solicitar servicio"
        description="Cuéntanos qué necesitas trasladar. Revisaremos la solicitud y coordinaremos los recursos adecuados."
        icon={Route}
      />
      <Card className="portal-form-shell border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Detalles de la solicitud</CardTitle>
          <CardDescription className="text-muted-foreground">
            Los campos se adaptan automáticamente al tipo de servicio
            seleccionado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="portal-request-steps" aria-label="Etapas de la solicitud">
            <div className="is-current">
              <span><ClipboardList /></span>
              <p><strong>Datos del servicio</strong><small>Ruta y programación</small></p>
            </div>
            <i />
            <div>
              <span><Truck /></span>
              <p><strong>Vehículo</strong><small>Información requerida</small></p>
            </div>
            <i />
            <div>
              <span><Check /></span>
              <p><strong>Confirmación</strong><small>Revisión del equipo</small></p>
            </div>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Tipo de Servicio */}
            <div>
              <Label
                htmlFor="service_type_id"
                className="text-sm text-foreground"
              >
                Tipo de Servicio *
              </Label>
              <PortalServiceTypeCombobox
                serviceTypes={serviceTypes}
                value={selectedServiceTypeId}
                loading={loadingServiceTypes}
                onValueChange={(value) =>
                  setValue("service_type_id", value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              {errors.service_type_id && (
                <p className="text-danger-text text-sm mt-1">
                  {errors.service_type_id.message}
                </p>
              )}
            </div>

            <div className="portal-request-grid grid grid-cols-1 gap-6 md:grid-cols-2">
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
                    Teléfono de contacto{" "}
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
                className="portal-request-submit font-medium"
                disabled={isPending || !selectedServiceTypeId}
              >
                <Send className="mr-2 size-4" />
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
