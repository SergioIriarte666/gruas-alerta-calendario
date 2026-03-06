
-- Create suppliers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    name TEXT NOT NULL,
    rut TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    contact_name TEXT,
    category TEXT,
    payment_terms TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    metadata JSONB
);

-- Add columns to suppliers if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'created_by') THEN
        ALTER TABLE public.suppliers ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'updated_by') THEN
        ALTER TABLE public.suppliers ADD COLUMN updated_by UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'metadata') THEN
        ALTER TABLE public.suppliers ADD COLUMN metadata JSONB;
    END IF;
END $$;

-- Enable RLS for suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create policies for suppliers if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Enable read access for all users') THEN
        CREATE POLICY "Enable read access for all users" ON public.suppliers FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Enable insert access for authenticated users') THEN
        CREATE POLICY "Enable insert access for authenticated users" ON public.suppliers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Enable update access for authenticated users') THEN
        CREATE POLICY "Enable update access for authenticated users" ON public.suppliers FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'Enable delete access for authenticated users') THEN
        CREATE POLICY "Enable delete access for authenticated users" ON public.suppliers FOR DELETE USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Create supplier_invoices table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    issue_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    amount NUMERIC,
    tax_amount NUMERIC,
    net_amount NUMERIC,
    status TEXT,
    description TEXT,
    payment_terms NUMERIC,
    paid_amount NUMERIC DEFAULT 0,
    balance NUMERIC GENERATED ALWAYS AS (amount - COALESCE(paid_amount, 0)) STORED,
    currency TEXT,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    metadata JSONB
);

-- Add columns to supplier_invoices if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'supplier_invoices' AND column_name = 'created_by') THEN
        ALTER TABLE public.supplier_invoices ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'supplier_invoices' AND column_name = 'metadata') THEN
        ALTER TABLE public.supplier_invoices ADD COLUMN metadata JSONB;
    END IF;
END $$;

-- Add unique constraint for upsert
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_invoices_supplier_id_invoice_number_key') THEN
        ALTER TABLE public.supplier_invoices ADD CONSTRAINT supplier_invoices_supplier_id_invoice_number_key UNIQUE (supplier_id, invoice_number);
    END IF;
END $$;

-- Enable RLS for supplier_invoices
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

-- Create policies for supplier_invoices if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_invoices' AND policyname = 'Enable read access for all users') THEN
        CREATE POLICY "Enable read access for all users" ON public.supplier_invoices FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_invoices' AND policyname = 'Enable insert access for authenticated users') THEN
        CREATE POLICY "Enable insert access for authenticated users" ON public.supplier_invoices FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_invoices' AND policyname = 'Enable update access for authenticated users') THEN
        CREATE POLICY "Enable update access for authenticated users" ON public.supplier_invoices FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'supplier_invoices' AND policyname = 'Enable delete access for authenticated users') THEN
        CREATE POLICY "Enable delete access for authenticated users" ON public.supplier_invoices FOR DELETE USING (auth.role() = 'authenticated');
    END IF;
END $$;
