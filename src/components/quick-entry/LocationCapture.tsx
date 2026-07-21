import React, { useState } from 'react';
import { MapPin, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("LocationCapture");
interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

interface LocationCaptureProps {
  onLocationChange: (location: LocationData | null) => void;
}

export function LocationCapture({ onLocationChange }: LocationCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLocationCapture = () => {
    if (!('geolocation' in navigator)) {
      const errorMsg = 'La geolocalización no está disponible en este dispositivo';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setIsCapturing(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          // Try to get address from coordinates (optional)
          try {
            const response = await fetch(
              `https://api.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
            );
            if (response.ok) {
              const data = await response.json();
              locationData.address = data.display_name;
            }
          } catch (addressError) {
            logger.warn('Could not get address:', addressError);
            // Continue without address
          }

          setLocation(locationData);
          onLocationChange(locationData);
          toast.success('Ubicación capturada correctamente');
        } catch (error) {
          logger.error('Error processing location:', error);
          toast.error('Error al procesar la ubicación');
        } finally {
          setIsCapturing(false);
        }
      },
      (error) => {
        setIsCapturing(false);
        let errorMsg = 'Error al obtener ubicación';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Permisos de ubicación denegados';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'Ubicación no disponible';
            break;
          case error.TIMEOUT:
            errorMsg = 'Tiempo de espera agotado';
            break;
        }
        
        setError(errorMsg);
        toast.error(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const clearLocation = () => {
    setLocation(null);
    setError(null);
    onLocationChange(null);
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={location ? clearLocation : handleLocationCapture}
        disabled={isCapturing}
        className="w-full"
      >
        {isCapturing ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" />
            Obteniendo ubicación...
          </>
        ) : location ? (
          <>
            <Check className="size-4 mr-2 text-success" />
            Ubicación guardada
          </>
        ) : error ? (
          <>
            <AlertCircle className="size-4 mr-2 text-danger" />
            Reintentar ubicación
          </>
        ) : (
          <>
            <MapPin className="size-4 mr-2" />
            Capturar Ubicación
          </>
        )}
      </Button>

      {location && (
        <div className="text-xs text-muted-foreground p-2 bg-muted rounded-md">
          <p>📍 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
          {location.address && (
            <p className="mt-1 truncate">{location.address}</p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-danger-soft p-2 text-xs text-danger-text">
          {error}
        </div>
      )}
    </div>
  );
}
