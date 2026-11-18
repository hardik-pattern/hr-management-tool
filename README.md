# ACME Salary Manager

A web app for an HR manager to manage salary data for about 10,000 employees across several countries, replacing a spreadsheet. A React single-page app talks to a Rails JSON API backed by SQLite.

## What it does

- **Find people:** search by name, email or number; filter by country, department, job title, status and (within a country) salary range; sort; page through 10,000 rows quickly. Every view has a shareable URL.
- **See a person:** profile, current salary, and the full salary history with each change as a percentage.
- **Manage them:** create and edit employees; change a salary (with a reason and a start date, added to the history, never overwritten); terminate and rehire; delete a mistaken record and restore it. Salaries are held in each employee's own currency.
- **Understand pay:** an Insights dashboard (payroll, headcount, pay by level, the gender pay gap, who is paid outside their band, who has gone longest without a salary change); a Questions page with the seven questions an HR manager asks most, each answered in one click; and an Explorer to ask your own (choose a measure, group it up to two ways, filter who is included). Every figure is computed from the data, in US dollars so countries compare, and states exactly how it was worked out.
- **Trust the data:** every rule is enforced in the app and again in the database, and salary history cannot be edited.

Not built: CSV export and a free-text question box, both on hold by decision. Authentication is out of scope (a single HR user), and deployment is not covered. See [docs/DESIGN_NOTES.md](docs/DESIGN_NOTES.md).

## Run it

You need **Ruby 3.3.6** (see `backend/.ruby-version`) and **Node 22.12 or newer** (22, 24 or 26, the releases Vitest supports). SQLite comes with Rails; there is nothing else to install.

```bash
# 1. Backend: create the database and load 10,000 employees (about 3 seconds)
cd backend
bundle install
bin/rails db:setup
bin/rails server              # http://localhost:3000
```

```bash
# 2. Frontend, in a second terminal
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Open <http://localhost:5173>. In development Vite forwards `/api` to the Rails server on port 3000, so there is nothing to configure. `bin/rails db:seed` is safe to repeat: it skips employee generation when employees already exist. `SEED_EMPLOYEES=500 bin/rails db:seed` loads a smaller set.

## Test it

```bash
cd backend
bundle exec rspec             # 482 specs
bin/rubocop && bin/brakeman && bin/bundler-audit

cd ../frontend
npm test                      # 452 tests, including an accessibility audit of every screen
npm run lint && npm run format:check && npm run build
```

Tests are fast and deterministic: the frontend never touches the network (a request without a mock fails the test), time is frozen where it matters, and randomness is seeded. Two GitHub Actions workflows run all of this on each push.

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `CORS_ORIGINS` | none | Browser origins allowed to call the API from another host. Off by default; not needed with the dev proxy. |
| `MAX_REQUEST_BYTES` | `65536` | Largest accepted request body. |
| `SEED_EMPLOYEES` | `10000` | How many employees `db:seed` generates. |

## Documentation

| Read | For |
|---|---|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | The goal, scope, what is deliberately left out, and why. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it is built: diagrams, layers, data model. |
| [docs/DESIGN_NOTES.md](docs/DESIGN_NOTES.md) | The decisions, their trade-offs, and what was not built. |
| [docs/API.md](docs/API.md) | Every endpoint, with real requests and responses. |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Seeding and list timings, and how they are achieved. |
| [docs/AI_PROMPTS.md](docs/AI_PROMPTS.md) | How AI was used to build this, and where it went wrong. |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | The step-by-step plan, one commit per step, and where the code departs from it. |
| [Plan.md](Plan.md) | The original assessment brief. |

## Layout

```
backend/    Rails API: app/{controllers,services,queries,models,presenters}, spec/
frontend/   React app: src/{api,pages,features,lib,components}, with tests beside the code
docs/       Requirements, architecture, design notes, API, performance, AI usage
```
