# Salary Management: Requirements

## Goal
Give ACME's HR Manager a web app to manage salary data for 10,000 employees across multiple countries, replacing Excel, and (the second half of the brief) to answer questions about how the organisation pays people.

## User
One persona: the HR Manager. Single organisation, no other roles.

## Scope

### Built
**Find people**
- Search by name, email or employee number; filter by country, department, job title, status (active, terminated, all) and, within a country, salary range; sort; page through 10,000 rows quickly.
- Every view has a shareable URL.

**Manage them**
- Create and edit employees (name, email, gender, department, job title; country and hire date are fixed once created).
- Change a salary with a start date and a reason. The change is added to the history, never overwritten, and the full history is shown with each change as a percentage.
- Terminate an employee who left (history kept) and rehire them, optionally with a new salary.
- Delete a record that should not exist (a duplicate or mistake) and restore it. Nothing is destroyed.
- Salaries are held in each employee's own country's currency.

**Platform**
- Rails API, SQLite, React UI (Bootstrap), seeded with 10,000 employees. Fast, deterministic tests; an accessibility audit of every screen.

### On hold (decided, not dropped)
| Item | Why held |
|---|---|
| **Answering pay questions across the organisation**: a catalogue of one-click questions (median pay by role and country, gender pay gap, pay outside a role's band, payroll by department in USD, widest pay spread, no raise in 24 months, what leavers earned) and a metric/group-by explorer | A substantial piece of its own: it needs an analytics engine, USD conversion and percentile maths. The data it needs is already in place (pay bands, indexed filters, seeded cases for each question), so it can be added without reworking what exists. |
| Free-text (AI) questions | Would sit on top of the analytics above, and never produce numbers itself. |
| CSV export of the filtered list | Paused by decision. |

Until the analytics are built, the app covers the *manage* half of the brief fully and the *answer* half only through search, filters and sorting, within one country at a time for salary.

## Deliberately left out
| Left out | Why |
|---|---|
| Login and roles | One persona; adds effort without answering the HR need. Production would sit behind the organisation's sign-in. |
| Payroll runs, tax, payslips | A different product; this is salary management. |
| Live exchange rates | Fixed rates are enough to compare; feeds add failure modes. |
| Excel import screen | The seed provides the data; import needs its own mapping and error UX. |
| Raise approval workflows | Process-heavy and not needed here. |
| Scheduled (future-dated) raises | The current salary would then show a raise that has not happened. A change takes effect on or before today. |
| Audit of non-salary edits | Salary history is the audit that matters. |
| Deployment | Out of scope for this build. |

## Success criteria
- HR can find any employee and change a salary in under a minute.
- Money is exact: integers in minor units, never floats; each salary in its own currency.
- Every rule holds in the app and again in the database; salary history cannot be edited.
- Lists respond in a few milliseconds on 10,000 rows, and a deep page costs the same as the first.
- Core logic is covered by fast, deterministic tests (323 backend specs, 326 frontend tests).
