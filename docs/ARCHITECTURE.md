# Architecture

A small web app for an HR manager to manage salary data for about 10,000 employees across several countries. A React single-page app talks JSON to a Rails API backed by SQLite.

```mermaid
flowchart LR
  subgraph Browser
    UI["React app<br/>Vite, TypeScript, Bootstrap<br/>TanStack Query, React Router"]
  end
  subgraph Server
    API["Rails API (/api/v1)<br/>controllers, services, queries"]
    DB[("SQLite")]
  end
  UI -- "JSON over HTTP<br/>(dev: Vite proxies /api)" --> API
  API --> DB
```

In development the Vite server proxies `/api` to Rails, so the browser makes same-origin calls. If the UI is ever served from another origin, `CORS_ORIGINS` opts that origin in.

## Data model

```mermaid
erDiagram
  currencies ||--o{ countries : "used by"
  countries ||--o{ employees : "works in"
  countries ||--o{ pay_bands : "per country"
  departments ||--o{ job_titles : has
  departments ||--o{ employees : "belongs to"
  job_titles ||--o{ employees : holds
  job_titles ||--o{ pay_bands : "per title"
  employees ||--o{ salary_records : "has history"

  currencies {
    string code UK "ISO 4217"
    int minor_unit_exponent "0 for JPY, 2 for USD"
    decimal rate_to_usd "fixed seed value"
  }
  countries {
    string code UK "ISO 3166"
    string name
    int currency_id FK
  }
  departments {
    string name UK
  }
  job_titles {
    string name
    int department_id FK
    int level "1 to 7"
  }
  pay_bands {
    int job_title_id FK
    int country_id FK
    bigint min_cents
    bigint max_cents
  }
  employees {
    string employee_number UK
    string email "unique among kept"
    string status "active or terminated"
    date termination_date
    datetime deleted_at "soft delete"
    int country_id FK
    int department_id FK
    int job_title_id FK
    bigint current_salary_cents "copy of latest record"
    string current_currency
  }
  salary_records {
    int employee_id FK
    bigint amount_cents
    string currency
    date effective_from
    string reason "append only"
  }
```

Amounts are integers in minor units. `employees.current_salary_cents` is a copy of the newest `salary_records` row, kept in step by one service. See `DESIGN_NOTES.md` for why.

## Backend (`backend/`)

Plain Rails, with the logic pulled out of controllers into small, named pieces.

| Layer | Where | Role |
|---|---|---|
| Controllers | `app/controllers/api/v1` | Parse parameters, call one service or query, render JSON. Nothing else. |
| Concerns | `app/controllers/concerns` | `ErrorHandling` (one error shape), `StrictParams` (refuse unknown keys), `FindsEmployee`. |
| Services | `app/services` | Every write. `Employees::Create`, `Terminate`, `Rehire`, `SoftDelete`, `Restore`; `Salaries::Change`. Each is one transaction and raises `RecordInvalid` on a broken rule. |
| Queries | `app/queries` | Reads. `EmployeeSearch`: filters, sorting, keyset pagination. |
| Models | `app/models` | Validations and relationships; `Money` is a small value object. |
| Presenters | `app/presenters` | Shape JSON for employees and salary records. |
| Edge | `lib/middleware`, `config/initializers` | Request size limit, opt-in CORS. `app/errors` holds the JSON exceptions app. |
| Seeding | `app/services/seeds`, `db/seeds.rb` | Reference data and the reproducible 10,000-employee generator. |

**A salary change, end to end**

```mermaid
sequenceDiagram
  participant UI as Change salary dialog
  participant C as SalaryChangesController
  participant S as Salaries::Change
  participant DB as SQLite
  UI->>C: POST /employees/7/salary_changes
  C->>C: refuse unknown parameters
  C->>S: employee, amount, date, reason
  S->>DB: begin, lock and reload the employee
  S->>DB: insert salary record (rules checked)
  S->>DB: update employees.current_salary_cents
  S->>DB: commit
  S-->>C: new record
  C-->>UI: 201, record and updated employee
  Note over S,DB: a broken rule raises, nothing is written, the API answers 422
```

## Frontend (`frontend/src`)

| Folder | Role |
|---|---|
| `api/` | The typed client and one hook per endpoint (TanStack Query). The only code that knows URLs. `ApiError` carries the server's code and per-field messages. |
| `pages/` | One component per route: list, detail, create, edit, not found. |
| `features/employees/` | The pieces the pages are built from: table, filters, forms, dialogs, and the hooks for URL state and paging. |
| `lib/` | Pure helpers: money parsing, formatting, labels, error wording. |
| `components/` | The layout shell: navigation, skip link, focus handling. |
| `test/` | Shared test infrastructure: MSW server, fixtures, render helpers, the axe check. |

**State.** Server data lives in TanStack Query. The list's view (sort, page size, filters) lives in the URL. The cursor trail for "Previous" lives in component state, because the API only moves forward. Forms keep what is typed in local state and map the API's field names back to their fields.

## Quality

- **Backend:** 323 specs, about 99.8% line and 99.3% branch coverage, rubocop, Brakeman and bundler-audit clean.
- **Frontend:** 326 tests (components, hooks, flows, and an accessibility audit of every screen), lint and format clean, type-checked build.
- **CI:** two workflows in `.github/workflows` run the above on each push and pull request.
- **Performance:** measurements are in `PERFORMANCE.md`; a list page takes a few milliseconds on 10,000 rows.

## Boundaries

On hold, not built: answering pay questions (analytics, curated questions) and the screens for it, CSV export. Not covered: authentication, deployment. See `DESIGN_NOTES.md` ("Not built, on purpose") and `IMPLEMENTATION_PLAN.md`.
