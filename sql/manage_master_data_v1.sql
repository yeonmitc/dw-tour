-- =========================================================
-- Manage Master Data (Product Types, Partners, Flight Info, Golf Courses)
-- =========================================================

-- 1. Product Types Table
CREATE TABLE IF NOT EXISTS public.product_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  type text NOT NULL, -- PACKAGE, CONLY, etc.
  branch text, -- Specific branch (MANILA, CLARK, etc.)
  region text, -- PHILIPPINES, CHIANGMAI, JAPAN
  prefix text, -- Added for booking code generation (e.g., AGP, CON, GON)
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read for authenticated users" ON public.product_types
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.product_types
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.product_types
    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users" ON public.product_types
    FOR DELETE TO authenticated USING (true);


-- 2. Partners Table
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  branch text, -- CHIANGMAI, MANILA, etc.
  region text, -- PHILIPPINES, CHIANGMAI, JAPAN
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read for authenticated users" ON public.partners
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.partners
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.partners
    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users" ON public.partners
    FOR DELETE TO authenticated USING (true);


-- 3. Flight Info Table
CREATE TABLE IF NOT EXISTS public.flightinfo (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  region text, -- PHILIPPINES, CHIANGMAI, JAPAN
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.flightinfo ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read for authenticated users" ON public.flightinfo
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.flightinfo
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.flightinfo
    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users" ON public.flightinfo
    FOR DELETE TO authenticated USING (true);


-- 4. Golf Courses Table
CREATE TABLE IF NOT EXISTS public.golf_courses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  region text, -- PHILIPPINES, CHIANGMAI, JAPAN
  branch text, -- Specific branch if needed
  note text,
  created_at timestamptz DEFAULT now()
);

-- In case golf_courses table already existed without new columns, ensure they are present
ALTER TABLE public.golf_courses ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.golf_courses ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE public.golf_courses ADD COLUMN IF NOT EXISTS branch text;
ALTER TABLE public.golf_courses ADD COLUMN IF NOT EXISTS note text;

-- Enable RLS
ALTER TABLE public.golf_courses ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read for authenticated users" ON public.golf_courses
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.golf_courses
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON public.golf_courses
    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users" ON public.golf_courses
    FOR DELETE TO authenticated USING (true);


-- 5. Seed Data (Product Types)
-- Using ON CONFLICT (code) to avoid duplicates.
-- Note: If prefix column was added later, we might need to update existing rows. 
-- But since we are creating table IF NOT EXISTS, we should handle schema migration if table exists.
-- For simplicity, we assume this script runs to setup or we manually add column if needed.
-- Here we insert with new values.

INSERT INTO public.product_types (code, label, type, branch, region, prefix) VALUES
('AGP', 'AGP - Chiang Mai Golf', 'PACKAGE', 'CHIANGMAI', 'CHIANGMAI', 'AGP'),
('MGP', 'MGP - Manila Golf', 'PACKAGE', 'MANILA', 'PHILIPPINES', 'MGP'),
('KGP', 'KGP - Clark Golf', 'PACKAGE', 'CLARK', 'PHILIPPINES', 'KGP'),
('CGP', 'CGP - Cebu Golf', 'PACKAGE', 'CEBU', 'PHILIPPINES', 'CGP'),
('FGP', 'FGP - Fukuoka Golf', 'PACKAGE', 'FUKUOKA', 'JAPAN', 'FGP'),
('CEP', 'CEP - Cebu Package', 'CEP', 'CEBU', 'PHILIPPINES', 'CEP'),
('CONLY', 'CONLY - Car Only', 'CONLY', NULL, NULL, 'CON'),
('GONLY', 'GONLY - Golf Only', 'GONLY', NULL, NULL, 'GON'),
('RONLY', 'RONLY - Room Only', 'RONLY', NULL, NULL, 'RON'),
('BUSONLY', 'BUSONLY - Bus Only', 'BUSONLY', NULL, NULL, 'BON'),
('OON', 'OON - Option Only', 'OPTION_ONLY', NULL, NULL, 'OON')
ON CONFLICT (code) DO UPDATE 
SET prefix = EXCLUDED.prefix, 
    region = EXCLUDED.region;

-- 6. Seed Data (Partners)
INSERT INTO public.partners (code, label, branch, region) VALUES
('NT', 'NT - Now Travel', NULL, NULL),
('NA', 'NA - Now Travel (Alt)', NULL, NULL),
('MK', 'MK - Monkey Travel', NULL, NULL),
('TR', 'TR - Touro', NULL, NULL),
('IN', 'IN - In Tour', NULL, NULL),
('D', 'Direct (Walk-in)', NULL, NULL)
ON CONFLICT (code) DO NOTHING;

-- 7. Seed Data (Flight Info - Examples)
INSERT INTO public.flightinfo (code, region) VALUES
('7C2102', 'PHILIPPINES'),
('KE621', 'PHILIPPINES'),
('LJ031', 'CHIANGMAI'),
('OZ132', 'JAPAN')
ON CONFLICT (code) DO NOTHING;
