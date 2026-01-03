-- Add report column configuration to system_settings
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS report_column_config JSONB DEFAULT '{
  "columns": {
    "fecha": {"visible": true, "width": 6, "label": "Fecha"},
    "folio": {"visible": true, "width": 6, "label": "Folio"},
    "cliente": {"visible": true, "width": 11, "label": "Cliente"},
    "asegurado": {"visible": true, "width": 11, "label": "Asegurado"},
    "cotizacion": {"visible": true, "width": 6, "label": "Cotización"},
    "oc": {"visible": true, "width": 5, "label": "OC"},
    "factura": {"visible": true, "width": 4, "label": "Factura"},
    "tipoServicio": {"visible": true, "width": 7, "label": "Tipo Servicio"},
    "patente": {"visible": true, "width": 7, "label": "Patente"},
    "origen": {"visible": true, "width": 12, "label": "Origen"},
    "destino": {"visible": true, "width": 12, "label": "Destino"},
    "estado": {"visible": true, "width": 6, "label": "Estado"},
    "valor": {"visible": true, "width": 7, "label": "Valor"}
  }
}'::jsonb;