-- Crear tabla de historial de cambios de servicios
CREATE TABLE public.service_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  service_folio TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL CHECK (change_type IN ('CREATE', 'UPDATE', 'DELETE')),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_context TEXT DEFAULT 'manual',
  change_summary TEXT
);

-- Índices para performance
CREATE INDEX idx_service_change_history_service_id ON service_change_history(service_id);
CREATE INDEX idx_service_change_history_changed_at ON service_change_history(changed_at DESC);
CREATE INDEX idx_service_change_history_field_name ON service_change_history(field_name);

-- Habilitar RLS
ALTER TABLE service_change_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view change history" ON service_change_history
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert" ON service_change_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Función para trackear cambios automáticamente
CREATE OR REPLACE FUNCTION track_service_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_field_labels JSONB := '{
    "value": "Valor del Servicio",
    "purchase_order": "Orden de Compra",
    "quote_number": "Número de Cotización",
    "status": "Estado",
    "operator_commission": "Comisión Operador",
    "client_covered_amount": "Monto Cubierto Cliente",
    "excess_amount": "Excedente",
    "insured_name": "Nombre Asegurado",
    "origin": "Origen",
    "destination": "Destino",
    "observations": "Observaciones",
    "vehicle_brand": "Marca Vehículo",
    "vehicle_model": "Modelo Vehículo",
    "license_plate": "Patente"
  }';
  v_field_name TEXT;
  v_old_value TEXT;
  v_new_value TEXT;
  v_label TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO service_change_history (service_id, service_folio, changed_by, change_type, field_name, new_value, change_summary)
    VALUES (NEW.id, NEW.folio, v_user_id, 'CREATE', 'servicio', NULL, 'Servicio creado');
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    -- Comparar campos clave
    FOREACH v_field_name IN ARRAY ARRAY['value', 'purchase_order', 'quote_number', 'status', 
      'operator_commission', 'client_covered_amount', 'excess_amount', 'insured_name',
      'origin', 'destination', 'observations', 'vehicle_brand', 'vehicle_model', 'license_plate'] LOOP
      
      EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', v_field_name, v_field_name) 
        INTO v_old_value, v_new_value USING OLD, NEW;
      
      IF v_old_value IS DISTINCT FROM v_new_value THEN
        v_label := COALESCE(v_field_labels->>v_field_name, v_field_name);
        
        INSERT INTO service_change_history (service_id, service_folio, changed_by, change_type, field_name, old_value, new_value, change_summary)
        VALUES (NEW.id, NEW.folio, v_user_id, 'UPDATE', v_field_name, v_old_value, v_new_value, 
          format('%s: %s → %s', v_label, COALESCE(v_old_value, 'vacío'), COALESCE(v_new_value, 'vacío')));
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    INSERT INTO service_change_history (service_id, service_folio, changed_by, change_type, field_name, old_value, change_summary)
    VALUES (OLD.id, OLD.folio, v_user_id, 'DELETE', 'servicio', OLD.folio, 'Servicio eliminado');
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para captura automática
CREATE TRIGGER trigger_track_service_changes
AFTER INSERT OR UPDATE OR DELETE ON services
FOR EACH ROW EXECUTE FUNCTION track_service_changes();