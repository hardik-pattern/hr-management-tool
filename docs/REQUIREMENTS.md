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

**Understand pay** (the second half of the brief)
- **Insights:** active headcount, total payroll and median salary at a glance; payroll by department, people by country, and pay by level (lower quartile, median, upper quartile); the like-for-like gender pay gap; who is paid outside their pay band; who has gone longest without a salary change.
- **Questions:** the seven an HR manager asks most, answered in one click: median pay for each role in each country, the gender pay gap, who is paid below their band, payroll by department, the widest pay spread (which departments have very different pay inside one team), who has had no salary change in 24 months, and what employees who left in the last year earned.
- **Explorer:** ask your own. Choose a measure (headcount, total, average, median, quartiles, lowest, highest or spread), group it up to two ways (country, department, job title, gender, level), and filter by who is included. A panel says in plain words exactly what was asked.
- Every figure is computed from the data when asked, in US dollars so countries compare, and a gap that rests on few people is flagged as a small sample.

**Platform**
- Rails API, SQLite, React UI (Bootstrap), seeded with 10,000 employees. Fast, deterministic tests; an accessibility audit of every screen.

### On hold (decided, not dropped)
| Item | Why held |
|---|---|
| A free-text question box (typing a question in words) | Would translate the sentence into the same validated question the analytics already answer, and never produce a number itself. Not needed to answer the questions. |
| CSV export of the filtered list | Paused by decision. |

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
- A pay figure can be trusted: it is computed from the data, converted exactly, and was checked against an independent recomputation.
- Core logic is covered by fast, deterministic tests (482 backend specs, 452 frontend tests).
