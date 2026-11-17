# Salary Management: Implementation Plan

Source brief: [`Plan.md`](Plan.md). This document is the single source of truth for what we build, why, and in which order. Every step below is **one commit**. We do not batch steps.

Status legend: `[ ]` not started, `[x]` done.

---

## 1. Goal and persona

Build a web app that lets the **HR Manager of ACME** (10,000 employees, multiple countries) replace Excel for salary data, and **answer questions about how the org pays people**.

Two jobs the product must do well:

1. **Manage**: create, view, edit and remove employees and their salaries, with a trustworthy history of changes.
2. **Answer**: give reliable answers to pay questions ("median salary of engineers in India?", "who is below their pay band?", "what is total payroll by department?").

Single persona, single tenant. No other roles.

---

## 2. Assessment rules, and where each one is satisfied

| Assessment rule | How we satisfy it | Where |
|---|---|---|
| One-page requirements doc **before** building | `docs/REQUIREMENTS.md`, first commit after scaffold | Step B0 |
| Rails backend, relational DB | Rails 8 API-only, SQLite | B1 |
| React UI, component library | React + Vite + TypeScript + Bootstrap (react-bootstrap) | F1 |
| Seed script with 10,000 employees | `db/seeds.rb` using batched `insert_all` | B6 |
| Fully functional, deployed | Single Docker service on a free-tier host (to be chosen), SQLite on a persistent disk or re-seeded on boot | D1 |
| Meaningful, fast, deterministic unit tests | RSpec, FactoryBot, no network, frozen time, seeded randomness | every step |
| Good structure, readability | Thin controllers, service objects, query objects | all |
| Incremental commits | One commit per step in this plan, conventional messages | all |
| Artifacts (design notes, prompts, trade-offs, performance) | `docs/` folder, see section 12 | throughout |

---

## 3. Problems we tackle up front

Decisions made **before** writing code, so they do not surprise us later.

### 3.1 Money
- **Problem:** floats corrupt money; countries use different currencies; zero-decimal currencies exist (JPY).
- **Decision:** store `amount_cents` as an **integer** (minor units) plus an ISO `currency` code. Never use `float`. Format only at the edge (JSON serializer / UI).
- **Cross-country comparison:** a `currencies` table holds `rate_to_usd` (decimal, static seed values, documented as a simplification). Analytics convert to USD for comparisons and show local currency in the employee views. Live FX feeds are out of scope.

### 3.2 Salary history vs current salary
- **Problem:** HR needs history ("when was the last raise?") but 10k-row analytics must stay fast.
- **Decision:** `salary_records` is the append-only history. `employees.current_salary_cents` and `current_currency` are **denormalized** current values. A single service (`Salaries::Change`) updates both inside one transaction, so they cannot drift.
- **Trade-off:** a little write complexity buys simple, indexed, join-free reads for the hot path.

### 3.3 Percentiles and median in SQLite
- **Problem:** SQLite has no `percentile_cont` or `median`.
- **Decision:** SQLite supports window functions, so compute percentiles with `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)` and `COUNT(*) OVER (...)`. If that proves unreadable, fall back to loading the sorted salary array per group in Ruby (cheap at 10k rows). Isolated behind `Analytics::Percentile` so we can swap it.

### 3.4 Performance at 10,000 rows
- **Problem:** naive list endpoints with N+1 queries and unpaginated responses.
- **Decision:** server-side pagination (keyset on `id`, with a capped `per_page`), `includes` for associations, indexes on every filter/group column, aggregation in SQL not Ruby. A `docs/PERFORMANCE.md` records measured timings.

### 3.5 Seeding 10,000 rows quickly and reproducibly
- **Problem:** `create!` in a loop is slow and random data breaks tests.
- **Decision:** `insert_all` in batches of 1,000 inside a transaction, generated from a fixed `Random.new(seed)` so the dataset is identical on every run. Realistic distribution per country and level (see B6). Target: seed completes in a few seconds.

### 3.6 Search and filtering
- **Decision:** filter by country, department, job title, status, salary range; text search on name and email using indexed `LIKE` prefix match (sufficient at this scale). Full-text search is out of scope.

### 3.7 Validation and data integrity
- DB-level constraints (NOT NULL, unique email, foreign keys, CHECK `amount_cents > 0`) **and** model validations. Never rely on one only.

### 3.8 Deterministic tests
- Freeze time with `travel_to`, seed randomness, no network, no `sleep`. LLM client (if built) is always stubbed.

### 3.9 Deploying SQLite
- **Problem:** SQLite is a file; ephemeral container disks lose it.
- **Decision:** the host is not chosen yet (looking at free options), so the app must work on both kinds of free tier:
  - **Persistent disk available:** mount it for `storage/`, run migrations plus seed on first boot only.
  - **Ephemeral disk (common on free tiers):** because the seed is deterministic and fast (B11), a boot script runs `db:prepare` and seeds if the database is empty, so a restart restores the full 10,000 employees. Edits made in the live demo would be lost on restart, which is documented plainly in the README.
  - Free tiers often sleep when idle, so the first request can be slow; the health check and README mention this.
  Postgres upgrade path noted as the production answer.

### 3.10 Employees who leave, and records that should not exist
- **Problem:** two different situations get conflated. (a) An employee **left the company**: they must stay in the data so historical pay questions stay correct. (b) A record was **created by mistake** (duplicate, test, wrong person): it must disappear from every view but remain recoverable.
- **Decision:** model them separately.
  - **Termination** is a business state: `status = terminated` plus `termination_date`. Salary history is untouched. Reversible by rehire (`status = active`, clear `termination_date`, with a `rehire` entry in the history if salary changes).
  - **Soft delete** is a data-hygiene state: `deleted_at` timestamp. A default scope hides deleted rows from lists, analytics, exports and uniqueness checks on lookups. `restore` clears it. There is **no hard delete** endpoint.
- **Analytics default:** payroll, headcount and pay-gap numbers count **active** employees only, because "how do we pay people today" is the common question. A `status` filter (`active`, `terminated`, `all`) lets HR ask historical questions, for example "what did we pay leavers in 2024". Soft-deleted rows are **never** counted.
- **Uniqueness:** a soft-deleted employee's email must not block re-creating the same person. Unique index on `email` is **partial**: `WHERE deleted_at IS NULL`.
- **Trade-off:** one extra column and a default scope buy safe recovery. The risk is forgetting the scope in raw SQL, so all reads go through `Employee.kept` or the query objects, and a spec asserts analytics ignore deleted rows.

### 3.11 Authentication
- **Decision:** out of scope (single persona). Documented as a deliberate omission. Production would put this behind SSO.

---

## 4. Scope

### In scope
- Employee CRUD with validation, search, filters, pagination, sort.
- Employee **termination** (left the company, history kept, rehire possible) and **soft delete with restore** (mistaken records, never hard-deleted).
- Salary changes with reason and effective date, plus per-employee history.
- Reference data: countries (with currency), departments, job titles, pay bands.
- Analytics: headcount, total payroll, average, median, p25/p75, min/max; grouped by country, department, job title, gender, level; filterable.
- Pay-equity insights: gender pay gap by job title, employees below/above band, stale salaries (no raise in N months).
- Question answering over that data (see section 6).
- CSV export of the filtered employee list.
- Seed of 10,000 employees.

### Deliberately out of scope (with reasons)
| Left out | Reason |
|---|---|
| Authentication / roles | One persona; adds effort without showing the core skill |
| Payroll runs, tax, deductions, payslips | A different product; salary *management* only |
| Live FX rates | Static rates are enough to compare; live feeds add failure modes |
| Excel import UI | Seed covers the data need; import needs a mapping and error-report UX of its own |
| Approval workflows for raises | Process-heavy, not needed to answer pay questions |
| Audit trail of non-salary field edits (name, department, etc.) | Salary history is the audit that matters; a general change log is a separate feature |
| Multi-tenant | Single org |

---

## 5. Architecture

```
React (Vite, TS, Bootstrap)  --->  Rails API (JSON, /api/v1)  --->  SQLite
        |                          |
   TanStack Query            Controllers (thin)
   react-router              Services (writes)  Queries (reads)
                             Models (validations)
```

- **Rails 8, `--api`, SQLite.** Namespaced `/api/v1`.
- **Controllers** only parse params, call a service/query, render JSON.
- **Services** (`app/services`) own writes and transactions: `Employees::Create`, `Salaries::Change`.
- **Queries** (`app/queries`) own reads: `EmployeeSearch`, `Analytics::*`.
- **Serializers**: plain Ruby presenter classes (no extra gem) to control JSON shape.
- **Errors**: one consistent envelope `{ "error": { "code", "message", "details" } }`.
- In production the Rails app also serves the built React bundle, so deployment is one service.

---

## 6. Answering questions about pay (the core feature)

Built in three layers, each independently valuable and tested.

1. **Analytics engine (deterministic, trusted).** One query object takes a validated spec: `metric` (headcount, sum, avg, median, p25, p75, min, max), `group_by` (country, department, job_title, gender, level), `filters`. It returns rows computed in SQL, in USD or local currency.
2. **Curated insights.** Fixed endpoints for the questions HR asks most: gender pay gap, below-band employees, stale salaries, payroll by department, spread by team.
3. **Natural-language question box (optional, deferred).** An LLM translates the question into the **same spec** as layer 1. It never writes SQL and never produces numbers. The response includes the interpreted spec so HR can verify it. If the model is unavailable or output is invalid, the UI falls back to the manual explorer.

Why this order: layers 1 and 2 already satisfy the brief and are fully testable. Layer 3 adds ambition without putting correctness at risk.

---

## 7. Data model

```
countries        id, code (ISO-2, unique), name, currency_code (FK-like to currencies.code)
currencies       id, code (ISO-4217, unique), name, minor_unit_exponent, rate_to_usd (decimal 18,8)
departments      id, name (unique)
job_titles       id, name, department_id, level (integer 1..7)   unique(name, department_id)
pay_bands        id, job_title_id, country_id, min_cents, max_cents   unique(job_title_id, country_id)
employees        id, employee_number (unique), full_name, email (unique), gender,
                 hire_date, status (active|terminated), termination_date, deleted_at (nullable),
                 country_id, department_id, job_title_id,
                 current_salary_cents, current_currency
salary_records   id, employee_id, amount_cents, currency, effective_from, reason, created_at
                 reason in: hire, merit, promotion, adjustment, correction
```

Indexes: partial unique `employees(email) WHERE deleted_at IS NULL`, `employees(deleted_at)`, `employees(country_id)`, `(department_id)`, `(job_title_id)`, `(status)`, `(current_salary_cents)`, `(full_name)`, unique `(email)`, `(employee_number)`; `salary_records(employee_id, effective_from)`.

Constraints: `CHECK(current_salary_cents > 0)`, `CHECK(amount_cents > 0)`, `CHECK(min_cents <= max_cents)`, foreign keys enforced.

---

## 8. API surface (v1)

```
GET    /api/v1/employees             search, filters, sort, pagination
POST   /api/v1/employees
GET    /api/v1/employees/:id
PATCH  /api/v1/employees/:id         profile fields (not salary)
POST   /api/v1/employees/:id/terminate    status=terminated, termination_date required
POST   /api/v1/employees/:id/rehire       status=active, clears termination_date
DELETE /api/v1/employees/:id         soft delete (sets deleted_at); never hard-deletes
POST   /api/v1/employees/:id/restore      clears deleted_at
GET    /api/v1/employees             also accepts status=active|terminated|all and deleted=only (to find and restore)
POST   /api/v1/employees/:id/salary_changes
GET    /api/v1/employees/:id/salary_records
GET    /api/v1/employees/export.csv

GET    /api/v1/reference/countries | departments | job_titles | currencies

GET    /api/v1/analytics/summary     ?metric=&group_by=&filters...
GET    /api/v1/insights/gender_pay_gap
GET    /api/v1/insights/out_of_band
GET    /api/v1/insights/stale_salaries?months=
GET    /api/v1/questions             catalog of common HR questions
GET    /api/v1/questions/:id/answer  run one catalog question
POST   /api/v1/questions             free-text question (section 11 only, deferred)
GET    /up                           health check
```

---

## 9. Backend commits (do these first, in order)

Each step ends with: tests green, `bin/rubocop` clean, one commit.

### Phase B-0: Foundations
- [x] **B0. `docs: add requirements document`**: one page: goal, scope, out of scope with reasons, sample questions as acceptance criteria. Also copy this plan's section 3 into `docs/DESIGN_NOTES.md`.
- [x] **B1. `chore: scaffold Rails API app`**: `rails new backend --api --database=sqlite3 --skip-test`. Add RSpec, FactoryBot, shoulda-matchers, rubocop (rails-omakase), brakeman, simplecov. Health check route. CI workflow runs rspec + rubocop + brakeman.
- [x] **B2. `feat: add error handling and JSON envelope`**: `ApplicationController` rescues (`RecordNotFound` -> 404, `RecordInvalid` -> 422, param errors -> 400) into the standard envelope. Request specs.

### Phase B-1: Reference data
- [x] **B3. `feat: currencies and countries`**: migrations, models, validations, factories, specs. Money helper `Money.format(cents, currency)` with exponent handling (JPY=0, USD=2), plus `to_usd_cents`. Unit tests for rounding.
- [x] **B4. `feat: departments, job titles and pay bands`**: migrations with CHECK constraints, models, validations (`min <= max`, uniqueness), specs.
- [x] **B5. `feat: reference data endpoints`**: `GET /reference/*`, request specs.

### Phase B-2: Employees and salaries
- [x] **B6. `feat: employee and salary record models`**: migrations with all indexes/constraints in section 7, validations (email format, status transitions, `termination_date` only when terminated), associations, specs including DB-constraint specs.
- [x] **B7. `feat: Salaries::Change service`**: appends a `salary_record` and updates the employee's denormalized current salary in one transaction. Rejects non-positive amounts, wrong currency for country, `effective_from` earlier than the latest record. Specs for happy path, rollback on failure, concurrency-safe ordering.
- [x] **B8. `feat: Employees::Create service`**: creates employee plus the initial `hire` salary record atomically. Specs.
- [x] **B9. `feat: employees CRUD endpoints`**: create, show, update (profile only), terminate. Presenter for JSON. Request specs including validation errors.
- [x] **B9a. `feat: terminate, rehire, soft delete and restore`**: `Employees::Terminate`, `Employees::Rehire`, `Employees::SoftDelete`, `Employees::Restore` services. Rules: termination date required and not before hire date; cannot terminate twice; cannot change salary of a terminated or deleted employee; restore fails if the email is now taken by another kept employee (clear 422). Default scope `Employee.kept`. Endpoints per section 8. Specs for each transition, partial-unique-email behavior, and that salary history survives all of them.
- [x] **B10. `feat: salary change and history endpoints`**: `POST salary_changes`, `GET salary_records`. Request specs.

### Phase B-3: Listing at scale
- [x] **B11. `feat: seed 10,000 employees`**: `db/seeds.rb` plus `Seeds::EmployeeGenerator` (fixed RNG seed, realistic salary distributions per country and level, pay bands generated per title/country, a deliberate few out-of-band and stale cases for the insights, about 8% terminated with valid dates, and a handful of soft-deleted rows). `insert_all` in batches. Spec for the generator's determinism and distributions on a small N. Record seed duration in `docs/PERFORMANCE.md`.
- [x] **B12. `feat: employee search, filter, sort, pagination`**: `EmployeeSearch` query object. Filters: q, country, department, job_title, status, salary range. Sort whitelist. Keyset pagination with `per_page` cap. Specs per filter and combination, plus an N+1 guard spec (query count assertion).
- [ ] **B13. ON HOLD (user decision): `feat: CSV export`**: streamed CSV of the filtered set. Spec for headers, escaping, and large-set streaming.

### Phase B-4: Answering questions (ON HOLD, user decision: not building yet)
- [x] **B13a. `test: deleted and terminated rows excluded from listings by default`**: covered by the B12 specs for `EmployeeSearch` (defaults, status, deleted=only); the CSV half returns with B13 if it is resumed. Original scope: regression specs on `EmployeeSearch` and CSV: deleted never shown unless `deleted=only`; terminated shown only via `status`.
- [ ] **B14. `feat: percentile helper`**: `Analytics::Percentile` (window-function SQL, with Ruby fallback if needed). Edge-case specs: empty set, one row, even/odd counts, ties.
- [ ] **B15. `feat: analytics query engine`**: `Analytics::QueryEngine` taking a validated `Analytics::Spec` (whitelisted metric/group_by/filters, rejects anything else). USD normalization. Specs for every metric and group_by, empty groups, mixed currencies, default `active` scope, `status=all`, and soft-deleted rows never counted.
- [ ] **B16. `feat: analytics summary endpoint`**: `GET /analytics/summary`. Request specs including invalid spec -> 400.
- [ ] **B17. `feat: gender pay gap insight`**: per job title and level, comparing like with like (avoids Simpson's-paradox misreads). Spec with hand-computed expected values.
- [ ] **B18. `feat: out-of-band and stale-salary insights`**: employees outside their pay band (with distance), and employees with no raise in N months (time frozen in specs).
- [ ] **B18a. `feat: common questions catalog`**: `Questions::Catalog` is a fixed, versioned list of HR questions, each mapped to an `Analytics::Spec` or an insight. Endpoints: `GET /api/v1/questions` (list) and `GET /api/v1/questions/:id/answer` (run). Initial catalog:
  - What is the median salary by job title and country?
  - What is the gender pay gap by job title and level?
  - Who is paid below the band for their role?
  - What is total payroll by department (in USD)?
  - Which teams have the widest pay spread (p75 minus p25)?
  - Who hasn't had a raise in 24 months?
  - What did leavers earn in the last year? (`status=terminated`)
  Specs assert each question returns the hand-computed answer on a small fixture dataset. The NL layer (section 11) later maps free text onto this same machinery.
- [ ] **B19. `perf: measure and index analytics queries`**: `EXPLAIN QUERY PLAN` review, add missing indexes, record timings in `docs/PERFORMANCE.md`. Add a regression spec asserting query count and no full-table scan on key paths.

### Phase B-5: Hardening
- [ ] **B20. `chore: backend hardening`**: Brakeman clean, strong params audit, CORS config for the UI origin, request-size and `per_page` limits, `docs/API.md` (generated or hand-written examples).

**Checkpoint:** backend complete and demoable with curl before any UI work.

---

## 10. Frontend commits

React + Vite + TypeScript, Bootstrap 5 via react-bootstrap (no custom design system, no heavy grid library), TanStack Query, react-router, Vitest + React Testing Library, MSW for API mocking in tests.

- [x] **F1. `chore: scaffold React app`**: Vite, TS, Bootstrap 5, react-bootstrap, eslint, prettier, Vitest, MSW. Layout shell with navigation (Employees, Insights, Questions).
- [x] **F2. `feat: API client and query hooks`**: typed client, error-envelope handling, TanStack Query setup. Tests with MSW.
- [x] **F3. `feat: employees table`**: react-bootstrap `Table` with our own small pagination and sortable-header components (server-side). Loading, empty, error states.
- [x] **F4. `feat: filters and search bar`**: country, department, job title, status, salary range, debounced text search, URL-synced state.
- [x] **F5. `feat: employee detail and salary history`**: detail drawer/page with history timeline.
- [x] **F6. `feat: create and edit employee form`**: validation mirrors backend, field-level server errors shown.
- [x] **F6a. `feat: terminate, rehire, delete and restore actions`**: status chip in the table, terminate dialog (date required), rehire action, delete with confirm, "Deleted" filter view with Restore. Tests for each flow and error messages (for example the email-taken restore error).
- [ ] **F7. `feat: change salary dialog`**: amount, currency (locked to country), effective date, reason. Optimistic refresh of history.
- [ ] **F8. ON HOLD (depends on Phase B-4): `feat: insights dashboard`**: payroll by department, headcount by country, pay distribution shown as tables with Bootstrap progress bars (no chart library up front; add one later only if needed), gender gap, out-of-band and stale lists.
- [ ] **F8a. ON HOLD (depends on Phase B-4): `feat: common questions page`**: one-click list of the catalog questions (from B18a); clicking one runs it and shows the answer table plus the spec used. This is the main "answer questions" surface and needs no AI.
- [ ] **F9. ON HOLD (depends on Phase B-4): `feat: analytics explorer`**: pick metric, group-by, filters; results table with inline bars; shows the spec used.
- [ ] **F10. ON HOLD with B13: `feat: CSV export button`**: exports the current filter.
- [ ] **F11. `chore: UX polish and accessibility`**: keyboard navigation, aria labels, responsive layout, empty/error copy.

---

## 11. Optional natural-language Q&A (deferred: waiting on your clarification)

The catalog in B18a / F8a already answers the sample questions without AI. Section 11 only adds free-text input and is not started until you confirm.

- [ ] **Q1. `feat: question interpreter`**: LLM client behind an interface; prompt produces **only** an `Analytics::Spec` JSON. Output validated by the same whitelist as B15. No SQL, no numbers from the model. Specs use a stubbed client with recorded fixtures.
- [ ] **Q2. `feat: POST /questions endpoint`**: interpret, run engine, return `{ answer rows, interpreted_spec, confidence }`. Falls back to a clear "could not understand, try the explorer" response.
- [ ] **Q3. `feat: Ask box in UI`**: input, example question chips, results table, "how this was computed" panel showing the spec.
- [ ] **Q4. `docs: AI usage and prompt log`**: prompts, guardrails, failure modes.

Open question: provider (Pattern's Bifrost gateway or another). Skipped entirely if the catalog is enough.

---

## 12. Deployment and artifacts

- [ ] **D1. `chore: Dockerfile and single-service build`**: multi-stage: build React, copy into Rails `public/`, serve both.
- [ ] **D2. `chore: deploy`**: deploy to the free host chosen by then, with boot-time migrate and seed-if-empty, health check wired. Put the live URL and the ephemeral-data caveat (if any) in `README.md`.
- [ ] **D3. `docs: README and final artifacts`**: setup, run, test, deploy instructions.

Artifacts committed under `docs/`:
- `REQUIREMENTS.md` (one page)
- `DESIGN_NOTES.md` (section 3 decisions, trade-offs)
- `ARCHITECTURE.md` (diagram and data model)
- `PERFORMANCE.md` (measured timings, indexes, query plans)
- `AI_PROMPTS.md` (prompts and instructions given to AI tools while building, plus the in-app LLM prompt if Q1 is built)
- `API.md`

---

## 13. Testing strategy

- **Unit:** models, services, query objects, Money, Percentile. The bulk of the suite.
- **Request specs:** every endpoint, including error paths.
- **Frontend:** component tests with MSW; no real network.
- **Rules:** frozen time, fixed RNG seed, no network, factories small. Whole backend suite should run in well under 30 seconds.
- **Coverage:** SimpleCov enabled; target high coverage on `app/services` and `app/queries` rather than a vanity global number.

## 14. Commit conventions

Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `perf:`, `refactor:`). Tests ship in the same commit as the code they cover. Unrelated cleanup goes in its own `refactor:` commit and is called out.

## 15. Decisions

Settled:
1. UI library: **Bootstrap** (react-bootstrap), keep it simple.
2. Repo layout: one repo, `backend/` and `frontend/` (`git init` in `dummy-project`).
3. "Answering questions": ship the **common questions catalog** (B18a, F8a) as the primary mechanism.

Open:
1. Host: undecided, looking at free options; design works with or without a persistent disk (section 3.9). Needed before D2 only.
2. Natural-language free-text Q&A (section 11): deferred pending your clarification. Not needed before B0.

---

## 16. Deviations and decisions made while building

Where the code differs from what this plan says above, the code is right. Each point names the step it came from.

**On hold (by decision, not dropped):** B13 and F10 (CSV export); Phase B-4 (B14-B19, B18a); F8, F8a, F9 and section 11, which depend on it. `docs/REQUIREMENTS.md` still describes the "answer questions" features and should be revisited if B-4 stays on hold. B13a is covered by the B12 specs.

**Backend**
- **B3:** `countries` links to `currencies` by a real foreign key (`currency_id`), not a `currency_code` string; `country.currency_code` still works.
- **B6:** soft delete uses an explicit `Employee.kept` scope, not a `default_scope` (a default scope leaks into joins and raw SQL). The model also enforces that the salary currency is the country's and the job title belongs to the department. `rehire` was added to the salary reasons.
- **B7:** `Salaries::Change` takes no currency (always the employee's). Future-dated changes and changes for terminated or deleted employees are refused. The `hire` reason is reserved for employee creation.
- **B8:** the hire record may be dated in the future, so new starters can be entered early. Employee numbers (`E000001`) are derived from the row id.
- **B9 / B10:** unknown or forbidden fields (status, salary, country, hire date on update; a salary currency) return a 400 rather than being ignored. `StrictParams` and `FindsEmployee` were extracted as concerns.
- **B9a:** termination cannot be future-dated. Rehire takes an optional new salary.
- **B11:** seeded history is relative to "today", so the dataset shifts as time passes; the generator takes `today:` for tests. The planted gender gap (4% in six titles) exists only in the fake data.
- **B12:** keyset pagination as planned, with an id tie-break. A salary range requires `country_id`, because salaries are in local currency; unknown parameters return a 400.

**Frontend**
- Bootstrap (react-bootstrap) instead of MUI; oxlint (the current Vite template's linter) instead of ESLint.
- **F3:** the API only moves forward, so the table keeps a stack of cursors in state to go back; sort and page size live in the URL, the page does not. Salary is sortable only once a country is chosen (F4).
- **F4:** salary amounts are typed in whole currency units and converted to minor units exactly, rounding half up. Clearing the country also removes a salary sort from the URL.
- **F5:** deleted employees are not linked in the list (the detail API returns 404 for them); they are handled by restore in F6a.
- **F6:** salary, country and hire date are not editable on the edit form; salary changes come in F7. The form does not claim a salary period (annual or otherwise), since the data does not define one.

