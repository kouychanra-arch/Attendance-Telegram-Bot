-- Supabase Schema for SecureAttend (Multi-tenant HR/Payroll)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants Table
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Employees Table
CREATE TABLE public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    employee_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT,
    telegram_id TEXT, -- For Telegram Bot integration
    base_salary_per_hour NUMERIC NOT NULL DEFAULT 0,
    photo_url TEXT, -- For Face Match reference
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Attendance Table
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    employee_code TEXT NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    check_out_time TIMESTAMP WITH TIME ZONE,
    method TEXT NOT NULL, -- 'gps', 'face', 'qr', 'nfc'
    location_lat NUMERIC,
    location_lng NUMERIC,
    status TEXT NOT NULL DEFAULT 'present' -- 'present', 'late'
);

-- Payroll Table
CREATE TABLE public.payroll (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    payroll_month TEXT NOT NULL, -- e.g., '2026-06'
    total_hours NUMERIC NOT NULL DEFAULT 0,
    amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' -- 'pending', 'paid'
);

-- Row Level Security (RLS)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

-- Face Enrollments Table
CREATE TABLE public.face_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    descriptor JSONB NOT NULL, -- Array of 128 floating point numbers representing the face descriptor
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(employee_id)
);

ALTER TABLE public.face_enrollments ENABLE ROW LEVEL SECURITY;

-- Optional: Allow full anonymous access for testing demo purposes on our preview
CREATE POLICY "Allow public read face_enrollments" ON public.face_enrollments FOR SELECT USING (true);
CREATE POLICY "Allow public insert face_enrollments" ON public.face_enrollments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update face_enrollments" ON public.face_enrollments FOR UPDATE USING (true);
CREATE POLICY "Allow public delete face_enrollments" ON public.face_enrollments FOR DELETE USING (true);

-- Optional: Add policies based on your auth structure.
-- E.g. CREATE POLICY "Allow full access" ON public.tenants FOR ALL USING (true);
