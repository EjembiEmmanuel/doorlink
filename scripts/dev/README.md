# Dev-only scripts

Local development helpers. They write to whatever database `DATABASE_URL`
points at, so they belong on a demo database and nowhere else. None of
them are imported by the application.

- `reset-marketplace.ts` — clears marketplace activity (leads, quotes,
  jobs, transactions, reviews) and resets the cached technician rating
  counters, so the post → quote → hire → complete → review flow can be
  walked from a known-empty state.
- `seed-demo-lead.ts` — posts one demo job request, for when you want to
  exercise the technician side without filling in the public form.
