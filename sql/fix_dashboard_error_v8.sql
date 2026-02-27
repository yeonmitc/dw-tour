-- ==============================================================================
-- FIX DASHBOARD ERROR v8 (Force Migration & View Fix)
-- ==============================================================================
-- This script takes a more aggressive but safe approach to handle dependencies.
-- Instead of renaming/dropping types immediately, it:
-- 1. Drops the View (removes dependency).
-- 2. Converts Table Columns to TEXT (removes dependency on Enum).
-- 3. Drops the OLD Enum (now safe).
-- 4. Creates the NEW Enum.
-- 5. Converts Table Columns back to NEW Enum (with mapping).
-- 6. Recreates the View (with CORRECTED component types).

-- ------------------------------------------------------------------------------
-- 1. Drop View (Remove dependency)
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.booking_dashboard_view;

-- ------------------------------------------------------------------------------
-- 2. Convert Columns to TEXT (Break dependency on Enum)
-- ------------------------------------------------------------------------------
ALTER TABLE public.bookings ALTER COLUMN status TYPE text;
ALTER TABLE public.vouchers ALTER COLUMN status TYPE text;

-- ------------------------------------------------------------------------------
-- 3. Drop OLD Enum Types (Now safe as nothing depends on them)
-- ------------------------------------------------------------------------------
DROP TYPE IF EXISTS public.booking_status CASCADE;
DROP TYPE IF EXISTS public.booking_status_old CASCADE;

-- ------------------------------------------------------------------------------
-- 4. Create NEW Enum Type
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 5. Convert Columns back to NEW Enum (With Mapping)
-- ------------------------------------------------------------------------------

-- Migrate 'bookings' table
ALTER TABLE public.bookings
  ALTER COLUMN status TYPE public.booking_status
  USING (
    CASE status
      -- Old values mapping
      WHEN 'PENDING' THEN 'REQUESTED'::public.booking_status
      WHEN 'FINAL' THEN 'CONFIRMED'::public.booking_status
      WHEN 'PAID' THEN 'DEPOSIT'::public.booking_status
      WHEN 'IN_PROGRESS' THEN 'INPROGRESS'::public.booking_status
      WHEN 'GUID_REPORT' THEN 'GUID_PAY'::public.booking_status
      WHEN 'COMPLETED' THEN 'CLOSED'::public.booking_status
      WHEN 'CANCELLED' THEN 'CANCLE'::public.booking_status
      -- Passthrough (already matches or new values)
      WHEN 'NEW' THEN 'NEW'::public.booking_status
      WHEN 'REQUESTED' THEN 'REQUESTED'::public.booking_status
      WHEN 'CONFIRMED' THEN 'CONFIRMED'::public.booking_status
      WHEN 'DEPOSIT' THEN 'DEPOSIT'::public.booking_status
      WHEN 'INPROGRESS' THEN 'INPROGRESS'::public.booking_status
      WHEN 'GUID_PAY' THEN 'GUID_PAY'::public.booking_status
      WHEN 'CLOSED' THEN 'CLOSED'::public.booking_status
      WHEN 'CANCLE' THEN 'CANCLE'::public.booking_status
      WHEN 'CHANGE_INFO' THEN 'CHANGE_INFO'::public.booking_status
      -- Fallback
      ELSE 'NEW'::public.booking_status
    END
  );

-- Migrate 'vouchers' table
ALTER TABLE public.vouchers
  ALTER COLUMN status TYPE public.booking_status
  USING (
    CASE status
      -- Old values mapping
      WHEN 'PENDING' THEN 'REQUESTED'::public.booking_status
      WHEN 'FINAL' THEN 'CONFIRMED'::public.booking_status
      WHEN 'CANCELLED' THEN 'CANCLE'::public.booking_status
      -- Passthrough
      WHEN 'NEW' THEN 'NEW'::public.booking_status
      WHEN 'REQUESTED' THEN 'REQUESTED'::public.booking_status
      WHEN 'CONFIRMED' THEN 'CONFIRMED'::public.booking_status
      WHEN 'CANCLE' THEN 'CANCLE'::public.booking_status
      -- Fallback
      ELSE 'NEW'::public.booking_status
    END
  );

-- ------------------------------------------------------------------------------
-- 6. Add Missing Columns (Idempotent)
-- ------------------------------------------------------------------------------
-- Bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS guide_vehicle text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS schedule_1 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS schedule_2 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS schedule_3 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS schedule_4 text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS hotel_note text;

-- Component Statuses
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS hotel_status text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS hotel_voucher_number text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS golf_status text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS golf_voucher_number text;

-- Vouchers
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS booking_code text;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS manager text;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS reserver_name text;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS schedule_1 text;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS schedule_2 text;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS schedule_3 text;
ALTER TABLE public.vouchers ADD COLUMN IF NOT EXISTS schedule_4 text;

-- ------------------------------------------------------------------------------
-- 7. Recreate Dashboard View (Corrected Enum Types)
-- ------------------------------------------------------------------------------
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
  WHERE bc.type IN ('HOTEL_STAY', 'VILLA_STAY') -- Corrected from 'HOTEL'
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
      (b.end_date - b.start_date)::text
    ELSE NULL
  END AS sc,
  fh.first_hotel_name,
  COALESCE(b.hotel_note, fh.first_hotel_note) AS first_hotel_note,
  COALESCE(b.schedule_1, tt.th1) AS "1TH",
  COALESCE(b.schedule_2, tt.th2) AS "2TH",
  COALESCE(b.schedule_3, tt.th3) AS "3TH",
  COALESCE(b.schedule_4, tt.th4) AS "4TH",
  -- Expose raw guide_vehicle AND the coalesced version
  b.guide_vehicle, 
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
