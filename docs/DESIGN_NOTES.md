# Design Notes

Decisions made before writing code, with the problem each one addresses and its trade-off. Source: section 3 of `IMPLEMENTATION_PLAN.md`.

## 1 Money
- **Problem:** floats corrupt money; countries use different currencies; zero-decimal currencies exist (JPY).
- **Decision:** store `amount_cents` as an **integer** (minor units) plus an ISO `currency` code. Never use `float`. Format only at the edge (JSON serializer / UI).
- **Cross-country comparison:** a `currencies` table holds `rate_to_usd` (decimal, static seed values, documented as a simplification). Analytics convert to USD for comparisons and show local currency in the employee views. Live FX feeds are out of scope.

## 2 Salary history vs current salary
- **Problem:** HR needs history ("when was the last raise?") but 10k-row analytics must stay fast.
- **Decision:** `salary_records` is the append-only history. `employees.current_salary_cents` and `current_currency` are **denormalized** current values. A single service (`Salaries::Change`) updates both inside one transaction, so they cannot drift.
- **Trade-off:** a little write complexity buys simple, indexed, join-free reads for the hot path.

## 3 Percentiles and median in SQLite
- **Problem:** SQLite has no `percentile_cont` or `median`.
- **Decision:** SQLite supports window functions, so compute percentiles with `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)` and `COUNT(*) OVER (...)`. If that proves unreadable, fall back to loading the sorted salary array per group in Ruby (cheap at 10k rows). Isolated behind `Analytics::Percentile` so we can swap it.

## 4 Performance at 10,000 rows
- **Problem:** naive list endpoints with N+1 queries and unpaginated responses.
- **Decision:** server-side pagination (keyset on `id`, with a capped `per_page`), `includes` for associations, indexes on every filter/group column, aggregation in SQL not Ruby. A `docs/PERFORMANCE.md` records measured timings.

## 5 Seeding 10,000 rows quickly and reproducibly
- **Problem:** `create!` in a loop is slow and random data breaks tests.
- **Decision:** `insert_all` in batches of 1,000 inside a transaction, generated from a fixed `Random.new(seed)` so the dataset is identical on every run. Realistic distribution per country and level (see B6). Target: seed completes in a few seconds.

## 6 Search and filtering
- **Decision:** filter by country, department, job title, status, salary range; text search on name and email using indexed `LIKE` prefix match (sufficient at this scale). Full-text search is out of scope.

## 7 Validation and data integrity
- DB-level constraints (NOT NULL, unique email, foreign keys, CHECK `amount_cents > 0`) **and** model validations. Never rely on one only.

## 8 Deterministic tests
- Freeze time with `travel_to`, seed randomness, no network, no `sleep`. LLM client (if built) is always stubbed.

## 9 Deploying SQLite
- **Problem:** SQLite is a file; ephemeral container disks lose it.
- **Decision:** the host is not chosen yet (looking at free options), so the app must work on both kinds of free tier:
  - **Persistent disk available:** mount it for `storage/`, run migrations plus seed on first boot only.
  - **Ephemeral disk (common on free tiers):** because the seed is deterministic and fast (B11), a boot script runs `db:prepare` and seeds if the database is empty, so a restart restores the full 10,000 employees. Edits made in the live demo would be lost on restart, which is documented plainly in the README.
  - Free tiers often sleep when idle, so the first request can be slow; the health check and README mention this.
  Postgres upgrade path noted as the production answer.

## 10 Employees who leave, and records that should not exist
- **Problem:** two different situations get conflated. (a) An employee **left the company**: they must stay in the data so historical pay questions stay correct. (b) A record was **created by mistake** (duplicate, test, wrong person): it must disappear from every view but remain recoverable.
- **Decision:** model them separately.
  - **Termination** is a business state: `status = terminated` plus `termination_date`. Salary history is untouched. Reversible by rehire (`status = active`, clear `termination_date`, with a `rehire` entry in the history if salary changes).
  - **Soft delete** is a data-hygiene state: `deleted_at` timestamp. A default scope hides deleted rows from lists, analytics, exports and uniqueness checks on lookups. `restore` clears it. There is **no hard delete** endpoint.
- **Analytics default:** payroll, headcount and pay-gap numbers count **active** employees only, because "how do we pay people today" is the common question. A `status` filter (`active`, `terminated`, `all`) lets HR ask historical questions, for example "what did we pay leavers in 2024". Soft-deleted rows are **never** counted.
- **Uniqueness:** a soft-deleted employee's email must not block re-creating the same person. Unique index on `email` is **partial**: `WHERE deleted_at IS NULL`.
- **Trade-off:** one extra column and a default scope buy safe recovery. The risk is forgetting the scope in raw SQL, so all reads go through `Employee.kept` or the query objects, and a spec asserts analytics ignore deleted rows.

## 11 Authentication
- **Decision:** out of scope (single persona). Documented as a deliberate omission. Production would put this behind SSO.
