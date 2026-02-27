-- Migration V5: Add missing manual columns for Hotel info
-- This allows manual editing of Hotel Name and Note directly on the booking,
-- which overrides or supplements the derived component data.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS first_hotel_name text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS first_hotel_note text;

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
  b.created_at,
  b.updated_at,
  b.flight_info,
  b.memo,
  b.partner_code,
  b.sc,
  b.guide_vehicle,
  b.hotel_status,
  b.hotel_voucher_number,
  b.golf_status,
  b.golf_voucher_number,
  b.golf_final,
  -- COALESCE Golf Rounds (tt) with Manual Schedules (b.schedule_N)
  COALESCE(tt.th1, b.schedule_1) AS "1TH",
  COALESCE(tt.th2, b.schedule_2) AS "2TH",
  COALESCE(tt.th3, b.schedule_3) AS "3TH",
  COALESCE(tt.th4, b.schedule_4) AS "4TH",
  COALESCE(tt.th5, b.schedule_5) AS "5TH",
  COALESCE(tt.th6, b.schedule_6) AS "6TH",
  
  -- Transfers
  transfers.trans_summary AS trans,
  
  -- Hotel (Manual overrides derived)
  COALESCE(b.first_hotel_name, fh.first_hotel_name) AS first_hotel_name,
  COALESCE(b.first_hotel_note, fh.first_hotel_note) AS first_hotel_note,
  
  -- Base Date
  b.start_date AS base_date,
  -- Deposit Date
  payments_agg.deposit_date,
  -- Customer Name
  b.customer_name,
  -- Pay Status Columns
  b.pay_status_1,
  b.pay_status_2,
  b.pay_status_3,
  b.pay_status_4,
  b.pay_status_5,
  b.pay_status_6
FROM public.bookings b
LEFT JOIN tt ON b.id = tt.booking_id
LEFT JOIN fh ON b.id = fh.booking_id
LEFT JOIN transfers ON b.id = transfers.booking_id
LEFT JOIN payments_agg ON b.id = payments_agg.booking_id;
