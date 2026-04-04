create table if not exists public.matcher_order_events (
  event_key text primary key,
  platform text not null,
  order_no text not null,
  rpt_no text,
  acct_no text not null,
  acct_code text not null,
  acct_name text,
  amount numeric(18,2) not null,
  real_amount numeric(18,2),
  reward numeric(18,2),
  order_state integer not null,
  crt_date bigint not null,
  user_id text,
  received_at timestamptz not null,
  matched boolean not null default false,
  matched_at timestamptz,
  matched_account_id text,
  matched_account_no text,
  matched_ifsc text,
  matched_holder_name text,
  matched_bank_name text,
  matched_subagent_id text,
  matched_subagent_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matcher_order_events_received_at_idx
  on public.matcher_order_events (received_at desc);

create index if not exists matcher_order_events_matched_idx
  on public.matcher_order_events (matched, matched_at desc);

create or replace function public.set_matcher_order_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_matcher_order_events_updated_at on public.matcher_order_events;

create trigger trg_matcher_order_events_updated_at
before update on public.matcher_order_events
for each row
execute function public.set_matcher_order_events_updated_at();
