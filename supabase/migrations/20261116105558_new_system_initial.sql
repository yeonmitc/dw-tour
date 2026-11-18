-- DW Tour new system. Raw workbook evidence is immutable; interpretations live separately.
create schema if not exists private;

create table private.app_settings (
  singleton boolean primary key default true check (singleton),
  admin_uid uuid unique,
  updated_at timestamptz not null default now()
);
insert into private.app_settings (singleton) values (true) on conflict do nothing;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from private.app_settings where admin_uid = (select auth.uid())
  );
$$;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('PH','TH','JP')),
  name text not null,
  timezone text not null,
  default_currency text not null check (default_currency ~ '^[A-Z]{3}$')
);
insert into public.markets (code,name,timezone,default_currency) values
  ('PH','필리핀','Asia/Manila','PHP'),
  ('TH','태국','Asia/Bangkok','THB'),
  ('JP','일본','Asia/Tokyo','JPY');

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id),
  name text not null,
  aliases_json jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(market_id,name)
);
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id),
  type text not null check (type in ('hotel','golf','vehicle','other')),
  name text not null,
  aliases_json jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(market_id,type,name)
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_file_name text not null,
  file_hash text not null,
  parser_version text not null,
  imported_at timestamptz not null default now(),
  state text not null default 'pending',
  counts_json jsonb not null default '{}'::jsonb,
  unique(file_hash,parser_version)
);
create table public.source_sheets (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id),
  sheet_index integer not null,
  sheet_name text not null,
  dimensions text,
  merges_json jsonb not null default '[]'::jsonb,
  hidden_rows_json jsonb not null default '[]'::jsonb,
  hidden_cols_json jsonb not null default '[]'::jsonb,
  conditional_formats_json jsonb not null default '[]'::jsonb,
  theme_json jsonb not null default '{}'::jsonb,
  unique(batch_id,sheet_index)
);
create table public.source_rows (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.source_sheets(id),
  row_no integer not null check (row_no > 0),
  row_kind text not null default 'data',
  original_json jsonb not null default '{}'::jsonb,
  row_hash text,
  unique(sheet_id,row_no)
);
create table public.source_cells (
  id uuid primary key default gen_random_uuid(),
  row_id uuid not null references public.source_rows(id),
  coordinate text not null,
  value_type text,
  raw_value text,
  formula text,
  cached_value text,
  comment_text text,
  comment_author text,
  style_ref text,
  unique(row_id,coordinate)
);
create table public.source_style_regions (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.source_sheets(id),
  range_ref text not null,
  fill_pattern text,
  color_type text,
  rgb text,
  theme integer,
  indexed integer,
  tint numeric,
  source_order integer not null default 0
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id),
  agency_id uuid references public.agencies(id),
  reservation_code text,
  original_code text,
  code_entry_mode text not null default 'manual' check (code_entry_mode in ('imported','suggested','manual')),
  lead_name_raw text,
  pax integer check (pax is null or pax >= 0),
  start_date date,
  end_date date,
  status text,
  review_state text not null default 'candidate',
  row_version integer not null default 1 check (row_version > 0),
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_dates check (end_date is null or start_date is null or end_date >= start_date),
  constraint identifiable_reservation check (nullif(btrim(coalesce(lead_name_raw,'')),'') is not null or nullif(btrim(coalesce(reservation_code,'')),'') is not null)
);
create unique index reservations_new_code_unique on public.reservations (market_id,reservation_code)
  where reservation_code is not null and code_entry_mode <> 'imported' and deleted_at is null;
create index reservations_market_date on public.reservations (market_id,start_date,id) where deleted_at is null;
create index reservations_original_code on public.reservations (market_id,original_code);
create index reservations_agency on public.reservations (agency_id,start_date);

create table public.reservation_people (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id),
  name_raw text not null,
  name_en text,
  role text,
  room_note text,
  source_cell_id uuid references public.source_cells(id),
  sort_order integer not null default 0
);
create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id),
  item_type text not null,
  service_date date,
  service_time time,
  supplier_id uuid references public.suppliers(id),
  location_raw text,
  detail_raw text,
  pax integer,
  status text,
  details_json jsonb not null default '{}'::jsonb,
  source_cell_id uuid references public.source_cells(id),
  sort_order integer not null default 0,
  row_version integer not null default 1
);
create index itinerary_reservation_date on public.itinerary_items (reservation_id,service_date,id);
create index itinerary_service_date on public.itinerary_items (service_date,reservation_id);
create table public.reservation_sources (
  reservation_id uuid not null references public.reservations(id),
  source_row_id uuid not null references public.source_rows(id),
  link_state text not null default 'candidate',
  evidence_json jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  primary key (reservation_id,source_row_id)
);
create table public.voucher_sheet_entries (
  id uuid primary key default gen_random_uuid(),
  source_row_id uuid not null unique references public.source_rows(id),
  agency_id uuid references public.agencies(id),
  reservation_id uuid references public.reservations(id),
  original_code text,
  name_raw text,
  pax_raw text,
  payment_raw text,
  review_state text not null default 'candidate',
  duplicate_group_id uuid,
  row_version integer not null default 1
);
create table public.supplier_voucher_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.voucher_sheet_entries(id),
  itinerary_item_id uuid references public.itinerary_items(id),
  supplier_id uuid references public.suppliers(id),
  service_kind text,
  service_date date,
  service_time time,
  detail_raw text,
  status text,
  source_cell_id uuid references public.source_cells(id),
  row_version integer not null default 1
);
create index voucher_items_entry_date on public.supplier_voucher_items (entry_id,service_date,id);
create table public.service_confirmations (
  id uuid primary key default gen_random_uuid(),
  itinerary_item_id uuid references public.itinerary_items(id),
  supplier_voucher_item_id uuid references public.supplier_voucher_items(id),
  number_raw text not null,
  kind text not null default 'unknown',
  confirmed_at timestamptz,
  source_cell_id uuid references public.source_cells(id),
  check (itinerary_item_id is not null or supplier_voucher_item_id is not null)
);
create table public.cost_lines (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id),
  itinerary_item_id uuid references public.itinerary_items(id),
  supplier_id uuid references public.suppliers(id),
  kind text not null,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  unit_price numeric,
  quantity numeric,
  unit_name text,
  calculated_amount numeric,
  actual_amount numeric,
  formula_raw text,
  source_cell_id uuid references public.source_cells(id),
  review_state text not null default 'candidate'
);
create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservations(id),
  itinerary_item_id uuid references public.itinerary_items(id),
  supplier_voucher_item_id uuid references public.supplier_voucher_items(id),
  cost_line_id uuid references public.cost_lines(id),
  direction text not null,
  counterparty_kind text,
  counterparty_id uuid,
  amount numeric,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  effective_date date,
  note_raw text,
  source_cell_id uuid references public.source_cells(id),
  review_state text not null default 'candidate',
  request_id uuid unique
);
create table public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id),
  currency text not null check (currency in ('PHP','KRW')),
  source_row_id uuid references public.source_rows(id),
  transacted_on date,
  description_raw text,
  inflow numeric,
  outflow numeric,
  balance_raw numeric,
  sort_order integer not null default 0,
  linked_payment_id uuid references public.payment_transactions(id)
);
create table public.reservation_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservations(id),
  event_kind text not null,
  before_json jsonb,
  after_json jsonb,
  happened_on date,
  note_raw text,
  source_row_id uuid references public.source_rows(id),
  created_at timestamptz not null default now()
);
create table public.review_issues (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id),
  source_ref text,
  issue_type text not null,
  raw_text text,
  candidate_json jsonb,
  resolution_json jsonb,
  state text not null default 'open',
  row_version integer not null default 1
);
create table public.code_glossary (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references public.markets(id),
  code_family text not null,
  observed_text text not null,
  meaning text,
  validity text,
  effective_from date,
  effective_to date,
  note text,
  confirmed_at timestamptz
);
create table public.color_glossary (
  id uuid primary key default gen_random_uuid(),
  source_sheet_id uuid references public.source_sheets(id),
  market_id uuid references public.markets(id),
  color_signature text not null,
  scope_json jsonb not null default '{}'::jsonb,
  meaning text,
  effective_from date,
  effective_to date,
  confirmed_at timestamptz
);

-- A public summary with no long notes, source cells, or payment details.
create view public.reservation_list with (security_invoker = true) as
select r.id,r.market_id,m.code as market_code,r.agency_id,a.name as agency_name,
  r.reservation_code,r.original_code,r.lead_name_raw,r.pax,r.start_date,r.end_date,
  r.status,r.review_state,r.row_version,r.created_at,r.updated_at,
  coalesce(r.start_date,(select min(i.service_date) from public.itinerary_items i where i.reservation_id=r.id)) as display_date
from public.reservations r
join public.markets m on m.id=r.market_id
left join public.agencies a on a.id=r.agency_id
where r.deleted_at is null;
create index source_rows_sheet on public.source_rows (sheet_id,row_no);
create index source_cells_row on public.source_cells (row_id,coordinate);
create index review_issues_state on public.review_issues (state,batch_id);

-- Version and event history are generated by the database for each business edit.
create function private.version_reservation() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.row_version := old.row_version + 1;
  new.updated_at := now();
  return new;
end; $$;
create trigger reservations_version before update on public.reservations
for each row execute function private.version_reservation();
create function private.log_reservation() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.reservation_events(reservation_id,event_kind,before_json,after_json)
  values(new.id,'updated',to_jsonb(old),to_jsonb(new));
  return new;
end; $$;
create trigger reservations_log after update on public.reservations
for each row execute function private.log_reservation();

-- Revoke Supabase's possible default public grants before choosing access.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='public' and tablename in (
    'markets','agencies','suppliers','import_batches','source_sheets','source_rows','source_cells',
    'source_style_regions','reservations','reservation_people','itinerary_items','reservation_sources',
    'voucher_sheet_entries','supplier_voucher_items','service_confirmations','cost_lines',
    'payment_transactions','cash_transactions','reservation_events','review_issues','code_glossary','color_glossary'
  ) loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
  end loop;
end $$;
revoke all on public.reservation_list from anon, authenticated;

-- General access follows the approved open-workflow contract. Direct writes are
-- restricted to editable business fields; evidence and admin fields stay protected.
grant select on public.markets,public.agencies,public.suppliers,public.reservations,
  public.reservation_people,public.itinerary_items,public.voucher_sheet_entries,
  public.supplier_voucher_items,public.service_confirmations,public.cost_lines,
  public.payment_transactions,public.cash_transactions,public.reservation_events,
  public.import_batches,public.source_sheets,public.source_rows,public.source_cells,
  public.source_style_regions,public.reservation_sources,public.review_issues,
  public.code_glossary,public.color_glossary to anon,authenticated;
grant select on public.reservation_list to anon,authenticated;
grant insert (market_id,agency_id,reservation_code,original_code,code_entry_mode,lead_name_raw,pax,start_date,end_date,status,review_state)
  on public.reservations to anon,authenticated;
grant update (agency_id,reservation_code,lead_name_raw,pax,start_date,end_date,status)
  on public.reservations to anon,authenticated;
grant update (deleted_at,deleted_by,delete_reason,review_state) on public.reservations to authenticated;
grant insert (reservation_id,name_raw,name_en,role,room_note,sort_order) on public.reservation_people to anon,authenticated;
grant update (name_raw,name_en,role,room_note,sort_order) on public.reservation_people to anon,authenticated;
grant insert (reservation_id,item_type,service_date,service_time,supplier_id,location_raw,detail_raw,pax,status,details_json,sort_order)
  on public.itinerary_items to anon,authenticated;
grant update (item_type,service_date,service_time,supplier_id,location_raw,detail_raw,pax,status,details_json,sort_order)
  on public.itinerary_items to anon,authenticated;
grant insert (itinerary_item_id,supplier_voucher_item_id,number_raw,kind,confirmed_at) on public.service_confirmations to anon,authenticated;
grant update (number_raw,kind,confirmed_at) on public.service_confirmations to anon,authenticated;
grant insert (reservation_id,itinerary_item_id,supplier_id,kind,currency,unit_price,quantity,unit_name,calculated_amount,actual_amount,formula_raw)
  on public.cost_lines to anon,authenticated;
grant update (kind,currency,unit_price,quantity,unit_name,calculated_amount,actual_amount,formula_raw)
  on public.cost_lines to anon,authenticated;
grant insert (reservation_id,itinerary_item_id,supplier_voucher_item_id,cost_line_id,direction,counterparty_kind,counterparty_id,amount,currency,effective_date,note_raw,request_id)
  on public.payment_transactions to anon,authenticated;
grant update (direction,counterparty_kind,counterparty_id,amount,currency,effective_date,note_raw)
  on public.payment_transactions to anon,authenticated;
grant update (agency_id,reservation_id,review_state) on public.voucher_sheet_entries to authenticated;
grant update (supplier_id,service_kind,service_date,service_time,detail_raw,status)
  on public.supplier_voucher_items to anon,authenticated;
grant insert (market_id,code_family,observed_text,meaning,validity,effective_from,effective_to,note)
  on public.code_glossary to authenticated;
grant update (meaning,validity,effective_from,effective_to,note,confirmed_at) on public.code_glossary to authenticated;
grant insert (source_sheet_id,market_id,color_signature,scope_json,meaning,effective_from,effective_to)
  on public.color_glossary to authenticated;
grant update (meaning,scope_json,effective_from,effective_to,confirmed_at) on public.color_glossary to authenticated;
grant update (resolution_json,state) on public.review_issues to authenticated;
grant insert,update,delete on public.agencies,public.suppliers to authenticated;

do $$ declare t text; begin
  for t in select unnest(array[
    'markets','agencies','suppliers','import_batches','source_sheets','source_rows','source_cells',
    'source_style_regions','reservations','reservation_people','itinerary_items','reservation_sources',
    'voucher_sheet_entries','supplier_voucher_items','service_confirmations','cost_lines',
    'payment_transactions','cash_transactions','reservation_events','review_issues','code_glossary','color_glossary'
  ]) loop
    execute format('create policy %I on public.%I for select to anon,authenticated using (true)', t||'_read',t);
  end loop;
end $$;
create policy reservations_insert on public.reservations for insert to anon,authenticated with check (deleted_at is null);
create policy reservations_edit on public.reservations for update to anon,authenticated
  using (deleted_at is null) with check (deleted_at is null);
create policy reservations_admin_edit on public.reservations for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy people_insert on public.reservation_people for insert to anon,authenticated with check (true);
create policy people_edit on public.reservation_people for update to anon,authenticated using (true) with check (true);
create policy itinerary_insert on public.itinerary_items for insert to anon,authenticated with check (true);
create policy itinerary_edit on public.itinerary_items for update to anon,authenticated using (true) with check (true);
create policy confirmations_insert on public.service_confirmations for insert to anon,authenticated with check (true);
create policy confirmations_edit on public.service_confirmations for update to anon,authenticated using (true) with check (true);
create policy costs_insert on public.cost_lines for insert to anon,authenticated with check (true);
create policy costs_edit on public.cost_lines for update to anon,authenticated using (true) with check (true);
create policy payments_insert on public.payment_transactions for insert to anon,authenticated with check (true);
create policy payments_edit on public.payment_transactions for update to anon,authenticated using (true) with check (true);
create policy voucher_entries_admin_edit on public.voucher_sheet_entries for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy voucher_items_edit on public.supplier_voucher_items for update to anon,authenticated using (true) with check (true);
create policy code_glossary_admin on public.code_glossary for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy color_glossary_admin on public.color_glossary for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy review_issues_admin on public.review_issues for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy agencies_admin on public.agencies for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy suppliers_admin on public.suppliers for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- The source preservation layer is written only by a trusted import job with
-- service_role; it has no client INSERT/UPDATE/DELETE grants.
