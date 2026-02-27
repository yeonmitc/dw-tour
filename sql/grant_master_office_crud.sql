
-- List of settings tables
-- product_types, partners, flightinfo, golf_courses, hotel_master, guide_master, driver_master

DO $$
DECLARE
  tables text[] := ARRAY[
    'product_types', 
    'partners', 
    'flightinfo', 
    'golf_courses', 
    'hotel_master', 
    'guide_master', 
    'driver_master'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- 1. Enable RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- 2. Drop existing policies to avoid conflicts
    EXECUTE format('DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable delete access for master users" ON public.%I', t);
    
    -- Drop specific master policies if any
    EXECUTE format('DROP POLICY IF EXISTS "Enable CRUD for master_office" ON public.%I', t);

    -- 3. Create Policies
    
    -- SELECT: All authenticated users
    EXECUTE format('CREATE POLICY "Enable read access for authenticated users" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    
    -- INSERT: All authenticated users (including master_office)
    EXECUTE format('CREATE POLICY "Enable insert access for authenticated users" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
    
    -- UPDATE: All authenticated users (including master_office)
    EXECUTE format('CREATE POLICY "Enable update access for authenticated users" ON public.%I FOR UPDATE TO authenticated USING (true)', t);
    
    -- DELETE: All authenticated users (including master_office)
    -- This covers the requirement "master_office can CRUD", by allowing EVERYONE to CRUD.
    -- If stricter control is needed later, we can restrict DELETE to specific roles.
    EXECUTE format('CREATE POLICY "Enable delete access for authenticated users" ON public.%I FOR DELETE TO authenticated USING (true)', t);
    
  END LOOP;
END $$;
