# Location seed data

- `zip-cache.json` — primary ZIP per catalog city (from zippopotam.us + 4 manual fallbacks). Lets `npm run db:seed:zips -- --offline` run without network. Regenerate with `npm run db:seed:zips -- --refresh`.
