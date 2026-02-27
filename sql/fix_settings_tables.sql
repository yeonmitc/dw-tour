
-- Fix golf_courses missing updated_at column which causes update trigger failure
ALTER TABLE public.golf_courses ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Ensure flightinfo has region column (it seemed missing in schema cache or actual table)
ALTER TABLE public.flightinfo ADD COLUMN IF NOT EXISTS region text;

-- Ensure other tables have updated_at if they use the standard trigger
ALTER TABLE public.product_types ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.flightinfo ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.hotel_master ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.guide_master ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
ALTER TABLE public.driver_master ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
