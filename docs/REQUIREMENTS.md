# Salary Management: Requirements

## Goal
Give ACME's HR Manager a web app to manage salary data for 10,000 employees across multiple countries, replacing Excel, and to answer questions about how the organization pays people.

## User
One persona: the HR Manager. Single organization, no other roles.

## Scope and features

**Manage**
- Employees: create, view, edit, search, filter (country, department, job title, status, salary range), sort, paginate.
- Salaries: change a salary with an effective date and reason; full history per employee. Money is held in the employee's local currency.
- Leavers: terminate an employee (history kept, rehire possible).
- Mistakes: soft-delete an employee record and restore it. Nothing is hard-deleted.
- Export the filtered employee list to CSV.

**Answer**
- A catalog of common HR questions, each answered in one click with a table and the query used:
  1. Median salary by job title and country?
  2. Gender pay gap by job title and level?
  3. Who is paid below the band for their role?
  4. Total payroll by department, in USD?
  5. Which teams have the widest pay spread?
  6. Who has not had a raise in 24 months?
  7. What did leavers earn in the last year?
- An explorer to pick a metric (headcount, total, average, median, p25, p75, min, max), a grouping, and filters.
- Default numbers cover active employees; HR can include leavers. Soft-deleted records never count.

**Platform**
- Rails API, SQLite, React UI (Bootstrap), seeded with 10,000 employees, deployed publicly.

## Deliberately left out
| Left out | Why |
|---|---|
| Login and roles | One persona; adds effort without answering the HR need |
| Payroll runs, tax, payslips | A different product; this is salary management |
| Live exchange rates | Static rates are enough to compare; feeds add failure modes |
| Excel import screen | The seed provides the data; import needs its own mapping and error UX |
| Raise approval workflows | Process-heavy and not needed to answer pay questions |
| Audit of non-salary edits | Salary history is the audit that matters |
| Free-text (AI) questions | Deferred; the catalog answers the common questions deterministically. May be added later on top of the same query engine |

## Success criteria
- HR can find any employee and change a salary in under a minute.
- Every catalog question returns a correct, reproducible answer; numbers come from SQL, never from a model.
- Lists and analytics respond in well under a second on 10,000 rows.
- Core logic is covered by fast, deterministic automated tests.
