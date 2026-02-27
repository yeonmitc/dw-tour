-- Add hotel_note column to bookings table if it doesn't exist
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS hotel_note text;

-- Recreate the dashboard view to include hotel_note
-- Removed dependency on 'booking_components' table as it appears to be missing/unused
DROP VIEW IF EXISTS public.booking_dashboard_view;

CREATE OR REPLACE VIEW public.booking_dashboard_view AS
WITH payments_agg AS (
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
  pay.deposit_date,
  f.code AS flight_info,
  b.customer_name,
  b.partner_code,
  b.created_at,
  b.updated_at,
  b.base_date,
  b.memo,
  b.hotel_note,
  b.sc,
  b.first_hotel_name,
  b.first_hotel_note,
  b.schedule_1 AS "1TH",
  b.schedule_2 AS "2TH",
  b.schedule_3 AS "3TH",
  b.schedule_4 AS "4TH",
  b.schedule_5 AS "5TH",
  b.schedule_6 AS "6TH",
  b.guide_vehicle AS trans,
  b.guide_vehicle,
  b.hotel_status,
  b.hotel_voucher_number,
  b.hotel_paid,
  b.hotel_paid_amount,
  b.golf_status,
  b.golf_voucher_number,
  b.golf_final,
  b.memo_1, b.pay_status_1, b.change_tee_time_1,
  b.memo_2, b.pay_status_2, b.change_tee_time_2,
  b.memo_3, b.pay_status_3, b.change_tee_time_3,
  b.memo_4, b.pay_status_4, b.change_tee_time_4,
  b.memo_5, b.pay_status_5, b.change_tee_time_5,
  b.memo_6, b.pay_status_6, b.change_tee_time_6
FROM public.bookings b
LEFT JOIN public.flightinfo f ON f.id = b.flight_info_id
LEFT JOIN payments_agg pay ON pay.booking_id = b.id;
