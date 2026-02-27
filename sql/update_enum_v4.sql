-- 1) Drop view that depends on the column (will be recreated later)
DROP VIEW IF EXISTS public.booking_dashboard_view;

-- 2) Rename old enum type
ALTER TYPE public.booking_status RENAME TO booking_status_old;

-- 3) Create new enum type with requested values
CREATE TYPE public.booking_status AS ENUM (
  'NEW',
  'REQUESTED',
  'CONFIRMED',
  'DEPOSIT',
  'INPROGRESS',
  'GUID_PAY',
  'CLOSED',
  'CANCLE',
  'CHANGE_INFO'
);

-- 4) Convert column to new type with mapping
ALTER TABLE public.bookings
  ALTER COLUMN status TYPE public.booking_status
  USING (
    CASE status::text
      WHEN 'PENDING' THEN 'REQUESTED'::public.booking_status
      WHEN 'FINAL' THEN 'CONFIRMED'::public.booking_status
      WHEN 'PAID' THEN 'DEPOSIT'::public.booking_status
      WHEN 'IN_PROGRESS' THEN 'INPROGRESS'::public.booking_status
      WHEN 'GUID_REPORT' THEN 'GUID_PAY'::public.booking_status
      WHEN 'COMPLETED' THEN 'CLOSED'::public.booking_status
      WHEN 'CANCELLED' THEN 'CANCLE'::public.booking_status
      ELSE status::text::public.booking_status
    END
  );

-- 5) Drop old enum type
DROP TYPE public.booking_status_old;

-- 6) Recreate the view (copying definition from update_schema_v3.sql)
-- Note: You should run update_schema_v3.sql FIRST to ensure all columns exist, 
-- OR we include the view definition here. 
-- For safety, let's assume the user might run this independently. 
-- But strictly, this file should just handle the ENUM change.
-- However, we MUST recreate the view because we dropped it.

CREATE OR REPLACE VIEW public.booking_dashboard_view AS
WITH golf_rounds AS (
  SELECT
    bc.booking_id,
    bc.start_at,
    s.name AS course_name,
    bc.notes,
    ROW_NUMBER() OVER (PARTITION BY bc.booking_id ORDER BY bc.start_at) AS seq
  FROM public.booking_components bc
  LEFT JOIN public.suppliers s ON s.id = bc.supplier_id
  WHERE bc.type = 'GOLF_ROUND'
),
tt AS (
  SELECT
    booking_id,
    MAX(CASE WHEN seq=1 THEN to_char(start_at, 'MM-DD HH24:MI') || ' ' || COALESCE(course_name, '') END) AS th1,
    MAX(CASE WHEN seq=2 THEN to_char(start_at, 'MM-DD HH24:MI') || ' ' || COALESCE(course_name, '') END) AS th2,
    MAX(CASE WHEN seq=3 THEN to_char(start_at, 'MM-DD HH24:MI') || ' ' || COALESCE(course_name, '') END) AS th3,
    MAX(CASE WHEN seq=4 THEN to_char(start_at, 'MM-DD HH24:MI') || ' ' || COALESCE(course_name, '') END) AS th4
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
  WHERE bc.type = 'HOTEL'
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
  b.base_date,
  b.partner_code,
  b.pax,
  b.status,
  b.paid_status,
  b.memo,
  b.branch,
  b.total_amount,
  b.currency,
  f.code AS flight_info,
  b.customer_name,
  CASE
    WHEN b.start_date IS NOT NULL AND b.end_date IS NOT NULL THEN
      (b.end_date - b.start_date)::text || 'N' || (b.end_date - b.start_date + 1)::text || 'D'
    ELSE NULL
  END AS sc,
  fh.first_hotel_name,
  COALESCE(b.hotel_note, fh.first_hotel_note) AS first_hotel_note,
  COALESCE(b.schedule_1, tt.th1) AS "1TH",
  COALESCE(b.schedule_2, tt.th2) AS "2TH",
  COALESCE(b.schedule_3, tt.th3) AS "3TH",
  COALESCE(b.schedule_4, tt.th4) AS "4TH",
  COALESCE(b.guide_vehicle, transfers.trans_summary) AS trans,
  pay.deposit_date,
  b.start_date,
  b.end_date,
  b.created_at,
  b.updated_at,
  b.hotel_status,
  b.hotel_voucher_number,
  b.golf_status,
  b.golf_voucher_number
FROM public.bookings b
LEFT JOIN public.flightinfo f ON f.id = b.flight_info_id
LEFT JOIN fh ON fh.booking_id = b.id
LEFT JOIN tt ON tt.booking_id = b.id
LEFT JOIN transfers ON transfers.booking_id = b.id
LEFT JOIN payments_agg pay ON pay.booking_id = b.id;
