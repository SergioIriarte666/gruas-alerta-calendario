
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE app_role AS ENUM ('admin', 'operator', 'viewer');
CREATE TYPE service_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE crane_type AS ENUM ('light', 'medium', 'heavy', 'taxi', 'other');
CREATE TYPE closure_status AS ENUM ('open', 'closed', 'invoiced');

-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role app_role DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create company_data table
CREATE TABLE public.company_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name TEXT NOT NULL,
  rut TEXT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  website TEXT,
  logo_url TEXT,
  folio_format TEXT DEFAULT 'SRV-{number}',
  invoice_due_days INTEGER DEFAULT 30,
  vat_percentage DECIMAL(5,2) DEFAULT 19.00,
  legal_texts TEXT,
  alert_days INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  rut TEXT UNIQUE NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cranes table
CREATE TABLE public.cranes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_plate TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  type crane_type NOT NULL,
  circulation_permit_expiry DATE NOT NULL,
  insurance_expiry DATE NOT NULL,
  technical_review_expiry DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create operators table
CREATE TABLE public.operators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  rut TEXT UNIQUE NOT NULL,
  phone TEXT,
  license_number TEXT UNIQUE NOT NULL,
  exam_expiry DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create service_types table
CREATE TABLE public.service_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  base_price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio TEXT UNIQUE NOT NULL,
  request_date DATE NOT NULL,
  service_date DATE NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  purchase_order TEXT,
  vehicle_brand TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  license_plate TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  service_type_id UUID NOT NULL REFERENCES public.service_types(id),
  value DECIMAL(10,2) NOT NULL,
  crane_id UUID NOT NULL REFERENCES public.cranes(id),
  operator_id UUID NOT NULL REFERENCES public.operators(id),
  operator_commission DECIMAL(10,2) DEFAULT 0,
  status service_status DEFAULT 'pending',
  observations TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio TEXT UNIQUE NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  vat DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status invoice_status DEFAULT 'draft',
  payment_date DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create invoice_services junction table
CREATE TABLE public.invoice_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  UNIQUE(invoice_id, service_id)
);

-- Create service_closures table
CREATE TABLE public.service_closures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio TEXT UNIQUE NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  client_id UUID REFERENCES public.clients(id),
  total DECIMAL(10,2) NOT NULL,
  status closure_status DEFAULT 'open',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create closure_services junction table
CREATE TABLE public.closure_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  closure_id UUID NOT NULL REFERENCES public.service_closures(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  UNIQUE(closure_id, service_id)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cranes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closure_services ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS app_role AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.get_user_role() = 'admin');

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.get_user_role() = 'admin');

-- Create RLS policies for company_data
CREATE POLICY "Authenticated users can view company data" ON public.company_data
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage company data" ON public.company_data
  FOR ALL USING (public.get_user_role() = 'admin');

-- Create RLS policies for clients
CREATE POLICY "Authenticated users can view clients" ON public.clients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and operators can manage clients" ON public.clients
  FOR ALL USING (public.get_user_role() IN ('admin', 'operator'));

-- Create RLS policies for cranes
CREATE POLICY "Authenticated users can view cranes" ON public.cranes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and operators can manage cranes" ON public.cranes
  FOR ALL USING (public.get_user_role() IN ('admin', 'operator'));

-- Create RLS policies for operators
CREATE POLICY "Authenticated users can view operators" ON public.operators
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and operators can manage operators" ON public.operators
  FOR ALL USING (public.get_user_role() IN ('admin', 'operator'));

-- Create RLS policies for service_types
CREATE POLICY "Authenticated users can view service types" ON public.service_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage service types" ON public.service_types
  FOR ALL USING (public.get_user_role() = 'admin');

-- Create RLS policies for services
CREATE POLICY "Authenticated users can view services" ON public.services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and operators can manage services" ON public.services
  FOR ALL USING (public.get_user_role() IN ('admin', 'operator'));

-- Create RLS policies for invoices
CREATE POLICY "Authenticated users can view invoices" ON public.invoices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and operators can manage invoices" ON public.invoices
  FOR ALL USING (public.get_user_role() IN ('admin', 'operator'));

-- Create RLS policies for invoice_services
CREATE POLICY "Authenticated users can view invoice services" ON public.invoice_services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and operators can manage invoice services" ON public.invoice_services
  FOR ALL USING (public.get_user_role() IN ('admin', 'operator'));

-- Create RLS policies for service_closures
CREATE POLICY "Authenticated users can view closures" ON public.service_closures
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and operators can manage closures" ON public.service_closures
  FOR ALL USING (public.get_user_role() IN ('admin', 'operator'));

-- Create RLS policies for closure_services
CREATE POLICY "Authenticated users can view closure services" ON public.closure_services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and operators can manage closure services" ON public.closure_services
  FOR ALL USING (public.get_user_role() IN ('admin', 'operator'));

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'viewer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_data_updated_at BEFORE UPDATE ON public.company_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cranes_updated_at BEFORE UPDATE ON public.cranes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_operators_updated_at BEFORE UPDATE ON public.operators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_types_updated_at BEFORE UPDATE ON public.service_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_closures_updated_at BEFORE UPDATE ON public.service_closures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default company data
INSERT INTO public.company_data (
  business_name,
  rut,
  address,
  phone,
  email,
  folio_format,
  invoice_due_days,
  vat_percentage,
  alert_days
) VALUES (
  'TMS Grúas Ltda.',
  '12.345.678-9',
  'Av. Principal 1234, Santiago, Chile',
  '+56 2 2345 6789',
  'contacto@tmsgruas.cl',
  'SRV-{number}',
  30,
  19.00,
  30
);

-- Insert default service types
INSERT INTO public.service_types (name, description, base_price) VALUES
('Grúa Liviana', 'Servicio de grúa liviana para vehículos menores', 80000),
('Grúa Mediana', 'Servicio de grúa mediana para vehículos comerciales', 120000),
('Grúa Pesada', 'Servicio de grúa pesada para camiones y maquinaria', 180000),
('Taxi Grúa', 'Servicio de taxi grúa para vehículos livianos', 60000);

-- Create indexes for better performance
CREATE INDEX idx_services_client_id ON public.services(client_id);
CREATE INDEX idx_services_crane_id ON public.services(crane_id);
CREATE INDEX idx_services_operator_id ON public.services(operator_id);
CREATE INDEX idx_services_service_type_id ON public.services(service_type_id);
CREATE INDEX idx_services_status ON public.services(status);
CREATE INDEX idx_services_service_date ON public.services(service_date);
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX idx_cranes_type ON public.cranes(type);
CREATE INDEX idx_clients_rut ON public.clients(rut);
CREATE INDEX idx_operators_rut ON public.operators(rut);
