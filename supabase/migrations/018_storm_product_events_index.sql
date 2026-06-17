-- Index storm_slug in product_events metadata for admin storm analytics aggregations.

create index if not exists product_events_storm_slug_idx
  on public.product_events ((metadata->>'storm_slug'))
  where metadata ? 'storm_slug';

create index if not exists product_events_storm_event_name_idx
  on public.product_events (event_name, created_at desc)
  where event_name like 'storm_%';
