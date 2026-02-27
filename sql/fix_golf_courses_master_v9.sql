-- Align golf_courses table with frontend master-data usage
-- Adds primary key id, basic master fields, and relaxes supplier binding

ALTER TABLE public.golf_courses
  DROP CONSTRAINT IF EXISTS golf_courses_pkey;

ALTER TABLE public.golf_courses
  ALTER COLUMN supplier_id DROP NOT NULL;

ALTER TABLE public.golf_courses
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS region text;

ALTER TABLE public.golf_courses
  ADD CONSTRAINT golf_courses_pkey PRIMARY KEY (id);

