
-- Enable RLS on vouchers table
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Create policies for vouchers table
CREATE POLICY "Enable read access for authenticated users" ON public.vouchers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.vouchers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON public.vouchers
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for authenticated users" ON public.vouchers
  FOR DELETE TO authenticated USING (true);
