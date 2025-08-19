
-- Verificar y habilitar RLS solo en las tablas que no lo tienen
DO $$
BEGIN
    -- Habilitar RLS en invoice_closures si no está habilitado
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'invoice_closures') THEN
        ALTER TABLE public.invoice_closures ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Crear políticas RLS para invoice_closures solo si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_closures' AND policyname = 'Users can view all invoice_closures') THEN
        CREATE POLICY "Users can view all invoice_closures" ON public.invoice_closures FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_closures' AND policyname = 'Users can insert invoice_closures') THEN
        CREATE POLICY "Users can insert invoice_closures" ON public.invoice_closures FOR INSERT WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_closures' AND policyname = 'Users can update invoice_closures') THEN
        CREATE POLICY "Users can update invoice_closures" ON public.invoice_closures FOR UPDATE USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_closures' AND policyname = 'Users can delete invoice_closures') THEN
        CREATE POLICY "Users can delete invoice_closures" ON public.invoice_closures FOR DELETE USING (true);
    END IF;
END $$;

-- Agregar constraints de CHECK solo si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_calendar_event_type') THEN
        ALTER TABLE public.calendar_events 
        ADD CONSTRAINT check_calendar_event_type 
        CHECK (type IN ('service', 'maintenance', 'meeting', 'deadline', 'other'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_calendar_event_status') THEN
        ALTER TABLE public.calendar_events 
        ADD CONSTRAINT check_calendar_event_status 
        CHECK (status IN ('scheduled', 'completed', 'cancelled'));
    END IF;
END $$;

-- Agregar foreign keys solo si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoice_closures_invoice_id') THEN
        ALTER TABLE public.invoice_closures 
        ADD CONSTRAINT fk_invoice_closures_invoice_id 
        FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoice_closures_closure_id') THEN
        ALTER TABLE public.invoice_closures 
        ADD CONSTRAINT fk_invoice_closures_closure_id 
        FOREIGN KEY (closure_id) REFERENCES public.service_closures(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Los índices ya tienen IF NOT EXISTS, así que son seguros de ejecutar
CREATE INDEX IF NOT EXISTS idx_invoice_closures_invoice_id ON public.invoice_closures(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_closures_closure_id ON public.invoice_closures(closure_id);
