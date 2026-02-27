-- Consolidated migration to add all requested columns
-- Uses IF NOT EXISTS to be safe to run multiple times

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS schedule_5 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS schedule_6 text;

-- Also ensure booking_code exists (used by dashboard view as code)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_code text;

-- Ensure manual hotel columns exist (for first_hotel_name/first_hotel_note)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS first_hotel_name text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS first_hotel_note text;
-- Hotel payment summary (board-level)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS hotel_paid boolean DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS hotel_paid_amount numeric;

-- Ensure golf_final exists
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS golf_final boolean DEFAULT false;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS memo_1 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pay_status_1 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS change_tee_time_1 boolean;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS memo_2 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pay_status_2 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS change_tee_time_2 boolean;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS memo_3 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pay_status_3 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS change_tee_time_3 boolean;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS memo_4 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pay_status_4 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS change_tee_time_4 boolean;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS memo_5 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pay_status_5 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS change_tee_time_5 boolean;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS memo_6 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pay_status_6 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS change_tee_time_6 boolean;

-- 4. Recreate Dashboard View (based on fix_missing_columns_v5 + new daily columns)
DROP VIEW IF EXISTS public.booking_dashboard_view;

CREATE OR REPLACE VIEW public.booking_dashboard_view AS
WITH golf_rounds AS (
  SELECT
    bc.booking_id,
    bc.start_at,
    s.name AS course_name,
    bc.notes,
    bc.status::text,
    ROW_NUMBER() OVER (PARTITION BY bc.booking_id ORDER BY bc.start_at) AS seq
  FROM public.booking_components bc
  LEFT JOIN public.suppliers s ON s.id = bc.supplier_id
  WHERE bc.type = 'GOLF_ROUND'
),
tt AS (
  SELECT
    booking_id,
    MAX(CASE WHEN seq=1 THEN to_char(start_at, 'MM/DD HH24:MI') || ' ' || COALESCE(course_name, '') || CASE WHEN status IS NOT NULL THEN ' [' || status || ']' ELSE '' END END) AS th1,
    MAX(CASE WHEN seq=2 THEN to_char(start_at, 'MM/DD HH24:MI') || ' ' || COALESCE(course_name, '') || CASE WHEN status IS NOT NULL THEN ' [' || status || ']' ELSE '' END END) AS th2,
    MAX(CASE WHEN seq=3 THEN to_char(start_at, 'MM/DD HH24:MI') || ' ' || COALESCE(course_name, '') || CASE WHEN status IS NOT NULL THEN ' [' || status || ']' ELSE '' END END) AS th3,
    MAX(CASE WHEN seq=4 THEN to_char(start_at, 'MM/DD HH24:MI') || ' ' || COALESCE(course_name, '') || CASE WHEN status IS NOT NULL THEN ' [' || status || ']' ELSE '' END END) AS th4,
    MAX(CASE WHEN seq=5 THEN to_char(start_at, 'MM/DD HH24:MI') || ' ' || COALESCE(course_name, '') || CASE WHEN status IS NOT NULL THEN ' [' || status || ']' ELSE '' END END) AS th5,
    MAX(CASE WHEN seq=6 THEN to_char(start_at, 'MM/DD HH24:MI') || ' ' || COALESCE(course_name, '') || CASE WHEN status IS NOT NULL THEN ' [' || status || ']' ELSE '' END END) AS th6
  FROM golf_rounds
  GROUP BY booking_id
),
fh AS (
  SELECT DISTINCT ON (bc.booking_id)
    bc.booking_id,
    s.name AS first_hotel_name,
    bc.notes AS first_hotel_note
  FROM public.booking_components bc
  LEFT JOIN public.suppliers s ON s.id = bc.supplier_id
  WHERE bc.type IN ('HOTEL_STAY', 'VILLA_STAY')
  ORDER BY bc.booking_id, bc.start_at ASC
),
transfers AS (
  SELECT
    booking_id,
    string_agg(name, ', ') AS trans_summary
  FROM (
    SELECT bc.booking_id, s.name
    FROM public.booking_components bc
    LEFT JOIN public.suppliers s ON s.id = bc.supplier_id
    WHERE bc.type = 'TRANSFER'
  ) t
  GROUP BY booking_id
),
payments_agg AS (
  SELECT
    booking_id,
    MAX(created_at) AS deposit_date
  FROM public.payments
  GROUP BY booking_id
)
SELECT
  b.id,
  b.booking_code AS code,
  b.status,
  b.paid_status,
  b.branch,
  b.start_date,
  b.end_date,
  b.pax,
  b.total_amount,
  b.currency,
  payments_agg.deposit_date,
  b.flight_info,
  b.customer_name,
  b.partner_code,
  b.created_at,
  b.updated_at,
  b.start_date AS base_date,
  b.memo,
  b.sc,
  COALESCE(b.first_hotel_name, fh.first_hotel_name) AS first_hotel_name,
  COALESCE(b.first_hotel_note, fh.first_hotel_note) AS first_hotel_note,
  COALESCE(tt.th1, b.schedule_1) AS "1TH",
  COALESCE(tt.th2, b.schedule_2) AS "2TH",
  COALESCE(tt.th3, b.schedule_3) AS "3TH",
  COALESCE(tt.th4, b.schedule_4) AS "4TH",
  COALESCE(tt.th5, b.schedule_5) AS "5TH",
  COALESCE(tt.th6, b.schedule_6) AS "6TH",
  transfers.trans_summary AS trans,
  b.guide_vehicle,
  b.hotel_status,
  b.hotel_voucher_number,
  b.hotel_paid,
  b.hotel_paid_amount,
  b.golf_status,
  b.golf_voucher_number,
  b.golf_final,
  -- Pay / Memo / Change Tee Time columns (per day)
  b.memo_1, b.pay_status_1, b.change_tee_time_1,
  b.memo_2, b.pay_status_2, b.change_tee_time_2,
  b.memo_3, b.pay_status_3, b.change_tee_time_3,
  b.memo_4, b.pay_status_4, b.change_tee_time_4,
  b.memo_5, b.pay_status_5, b.change_tee_time_5,
  b.memo_6, b.pay_status_6, b.change_tee_time_6
FROM public.bookings b
LEFT JOIN tt ON b.id = tt.booking_id
LEFT JOIN fh ON b.id = fh.booking_id
LEFT JOIN transfers ON b.id = transfers.booking_id
LEFT JOIN payments_agg ON b.id = payments_agg.booking_id;
