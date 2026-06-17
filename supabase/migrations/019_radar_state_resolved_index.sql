-- Index radar_state_resolved for admin attribution aggregations.

create index if not exists product_events_radar_state_resolved_idx
  on public.product_events (event_name, created_at desc)
  where event_name = 'radar_state_resolved';

create index if not exists product_events_radar_state_resolved_source_idx
  on public.product_events ((metadata->>'source'))
  where event_name = 'radar_state_resolved';
