-- Run after new_system_initial.sql. Do not run the first migration twice.
-- The logging trigger must be able to append an immutable event for an anon edit.
alter function private.log_reservation() security definer;
revoke all on function private.log_reservation() from public,anon,authenticated;

create function private.guard_reservation_edit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.review_state is distinct from old.review_state
    or new.deleted_at is distinct from old.deleted_at
    or new.deleted_by is distinct from old.deleted_by
    or new.delete_reason is distinct from old.delete_reason then
    if not coalesce((select private.is_admin()),false) then
      raise exception 'administrator required' using errcode = '42501';
    end if;
  end if;
  if new.deleted_at is not null and nullif(btrim(coalesce(new.delete_reason,'')),'') is null then
    raise exception 'delete reason required' using errcode = '23514';
  end if;
  return new;
end; $$;
create trigger reservations_guard before update on public.reservations
for each row execute function private.guard_reservation_edit();

create function private.bump_row_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.row_version := old.row_version + 1;
  return new;
end; $$;
create trigger itinerary_version before update on public.itinerary_items
for each row execute function private.bump_row_version();
create trigger voucher_entries_version before update on public.voucher_sheet_entries
for each row execute function private.bump_row_version();
create trigger voucher_items_version before update on public.supplier_voucher_items
for each row execute function private.bump_row_version();
create trigger review_issues_version before update on public.review_issues
for each row execute function private.bump_row_version();

-- Server-owned exchange-rate snapshots. The browser can read but cannot write.
create table public.fx_rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  currency text not null check (currency in ('USD','PHP','JPY')),
  unit integer not null check ((currency='JPY' and unit=100) or (currency in ('USD','PHP') and unit=1)),
  krw_amount numeric not null check (krw_amount > 0),
  source_quoted_at timestamptz,
  fetched_at timestamptz not null default now(),
  source_url text not null,
  unique(currency,source_quoted_at)
);
create index fx_rate_latest on public.fx_rate_snapshots (currency,fetched_at desc);
alter table public.fx_rate_snapshots enable row level security;
revoke all on public.fx_rate_snapshots from anon,authenticated;
grant select on public.fx_rate_snapshots to anon,authenticated;
create policy fx_rate_read on public.fx_rate_snapshots for select to anon,authenticated using (true);
