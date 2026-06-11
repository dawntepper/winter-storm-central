# Database scripts

Location seed data lives in [`data/README.md`](data/README.md).

## Location search analytics

After applying migrations `005`–`007`, failed searches from state-page lookup are stored in `location_search_events` (`success = false`, `resolved_type = 'not_found'`).

Top missing queries by state:

```sql
select * from missing_location_searches limit 50;
```

Columns: `query`, `state_context` (2-letter state code), `search_count`, `last_searched`.
