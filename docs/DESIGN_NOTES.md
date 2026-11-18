# Design notes

The decisions that shaped the system, the problem each one answers, and what it costs. They are written as they stand in the code; where the original plan differed, `IMPLEMENTATION_PLAN.md` section 16 says how.

## Money

- **Problem:** floating point corrupts money; countries use different currencies; some currencies have no minor unit (JPY).
- **Decision:** amounts are **integers in minor units** (`*_cents`) next to an ISO currency code. The `Money` class converts to USD with exact decimal arithmetic, rounding half up, and knows each currency's exponent. Formatting happens only at the edge. The UI reads what people type ("50000.50") on the digits, not as a float, so 1.005 never becomes 100 cents.
- **Cost:** every boundary has to convert. The `Money` class and `parseAmount` keep that in two places.
- **Simplification:** USD rates are fixed seed values in a `currencies` table, not a live feed.

## Salary history and the current salary

- **Problem:** HR needs history ("when was the last raise?") and the list needs a fast, join-free salary column.
- **Decision:** `salary_records` is an **append-only** history; a saved record cannot be edited or destroyed (a mistake is fixed with a `correction` record). `employees.current_salary_cents` is a denormalized copy of the latest record. One service, `Salaries::Change`, writes both in a single transaction, so they cannot drift.
- **Rules it enforces:** the amount is positive; the date is not in the future (otherwise the "current" salary would show a raise that has not happened) and not before the latest record; the employee is neither terminated nor deleted; the currency is always the employee's own; the `hire` reason is reserved for creating the employee.
- **Cost:** a little write complexity. The hire record is the one exception to the future-date rule, so new starters can be entered before they start.

## Employees who leave, and records that should not exist

- **Problem:** two situations get conflated. Someone who **left** must stay in the data so history stays right. A record **created by mistake** must vanish but be recoverable.
- **Decision:** model them separately.
  - **Termination** is a business state (`status = terminated`, `termination_date`). Salary history is untouched, and **rehire** reverses it, optionally with a new salary. A termination cannot be future-dated, because nothing flips the status on that date.
  - **Soft delete** is `deleted_at`. There is **no hard delete**. Restore clears it, and fails clearly if the person's email has since been taken.
- **Uniqueness:** the email index is **partial** (`WHERE deleted_at IS NULL`), so a deleted person's address does not block re-creating them. Employee numbers stay unique across deleted rows, so numbers are never recycled.
- **Mechanism:** an explicit `Employee.kept` scope, not a `default_scope`. A default scope silently leaks into joins and raw SQL; the cost is that every read must say `kept`, which the query object does in one place and a spec guards.

## Validating twice

- Rules live in the **model** (friendly messages) and in the **database** (`NOT NULL`, foreign keys, `CHECK` constraints for positive amounts, status and gender values, `min <= max`, level range, termination date consistent with status). The specs exercise the constraints directly by saving with validations skipped, so neither layer can quietly stop protecting the data.
- Related fields are checked for consistency in the model: the salary currency must be the country's, and the job title must belong to the department.

## Listing at scale

- **Problem:** 10,000 employees, with search, filters and sorting, must stay fast and must not skip or repeat rows while HR edits data.
- **Decision:** **keyset (cursor) pagination** on `(sort column, id)`, with a capped page size, instead of `OFFSET`. A deep page costs the same as the first (measured in `PERFORMANCE.md`). Associations are preloaded, and a spec fails if the query count grows with the page size. Unknown parameters are refused rather than ignored, so a typo does not return everyone.
- **Cost:** keyset only moves forward, so the UI keeps its own stack of cursors to go back.
- **Salary and currencies:** salaries are in local currencies, so a salary range requires a country, and salary sorting is only offered once a country is chosen. Comparing pay across countries is what the analytics are for: they convert to USD.

## One error shape, and a hardened edge

- Every error is `{ error: { code, message, details } }`, including unparseable bodies, unknown routes and unexpected failures. A server error never reveals the exception text.
- Write endpoints refuse unknown parameters (HTTP 400) instead of silently dropping them.
- Request bodies over 64 KB are refused with a 413 before they are parsed. Cross-origin access is **off** unless `CORS_ORIGINS` lists origins.
- There is no authentication. The product has one persona; in production it would sit behind the organisation's sign-in.

## Seeding

- **Problem:** `create!` in a loop is slow, and random data makes tests flaky.
- **Decision:** `insert_all` in batches inside one transaction, driven by one seeded `Random`, so the same seed and date give identical data (a spec compares two runs). 10,000 employees and about 25,700 salary records load in about three seconds.
- **Planted cases:** employees outside their pay band, stale raises, a small gender pay gap in six titles, terminated and soft-deleted rows. The gap exists only in the fake data, so a future insight has something to find.
- **Cost:** history is built relative to "today", so the dataset shifts as time passes. The generator takes `today:` so tests pin it.

## Answering pay questions

- **Computed on request, never stored or generated.** Every figure is calculated from the current data when asked. Nothing is cached in the database and no model writes a number; the Questions page is a list of fixed definitions, each naming the exact calculation it runs.
- **One validated question.** Everything the Explorer, the Questions page and the dashboard ask goes through `Analytics::Spec`: a measure (count, total, average, median, quartiles, lowest, highest, spread), up to two groupings, and filters, each checked against a whitelist. An unknown or contradictory request is a 400, so a typo is an error and not a quietly different question.
- **Everything in USD.** Salaries are held in each employee's own currency, so comparing countries means converting. Each salary is converted to USD cents with the existing exact, half-up `Money` arithmetic, so an analytics figure agrees with the same amount shown anywhere else. The rates are fixed seed values, so cross-country comparisons are consistent, not market-accurate.
- **Aggregation in Ruby, not SQL.** The engine reads the filtered rows once, converts, groups and measures them in Ruby. SQLite has no percentile function, and floating-point SQL would not round the way `Money` does. At 10,000 rows this costs 18 to 102 ms (`PERFORMANCE.md`). The cost is that it would not scale to millions of rows; count, sum, average, minimum and maximum could move into SQL if it ever had to, and percentiles would still need the values.
- **Percentiles by interpolation** between the two nearest ranks (Excel's `PERCENTILE.INC`), exact until a single rounding to whole cents, so HR's spreadsheet gives the same answer.
- **The gender pay gap compares like with like.** A plain average of women's pay against men's misleads when women are concentrated in lower-paid roles: every role can pay women and men identically and the raw gap still looks large. So women are compared with men in the same job title and the same country, which also keeps each comparison in one currency, and those comparisons are combined weighted by the number of women. The raw gap is shown beside it, and a test builds exactly that scenario to show the two disagree.
- **What the gap does not say.** It measures a difference in pay, not its cause: nothing accounts for tenure, performance or anything else. A job title and country need at least three of each gender to be compared, and other genders are too few to say anything about. A gap resting on fewer than 20 women is flagged as a small sample. This matters on the seeded data: "Head of Support" shows -16.7% but rests on four women, and is flagged, whereas a gap built on hundreds is not.
- **Outside the pay band** means below the minimum or above the maximum for the job title in the employee's country, in that currency; the edges count as inside. A job title with no band in a country is not reported, since there is nothing to be outside of. The list is furthest-outside first, capped (50 by default, 200 at most), and the totals count everyone.
- **No salary change** means the latest salary record, including the hire record, is older than the number of months asked for (24 by default). Any record counts as a change, because the data does not say which were raises.
- **Checked independently.** The engine's results for eight different questions (medians, averages, quartiles, spreads, sums and maximums, including a two-way grouping with a filter), the gender gap and the out-of-band and stale counts were recomputed in a separate script that reads the raw SQLite file with its own conversion and percentile code. Every group and total matched exactly.

## Frontend

- **Bootstrap** (react-bootstrap) for the UI, to avoid up-front design-system work.
- **TanStack Query** owns server state: caching, loading and error states, and one rule for freshness (any change to an employee refreshes everything under the `employees` key). The alternative, hand-written fetch hooks, would repeat that logic per screen.
- **The URL is the state** of the list: sort, page size and every filter live in the query string, so a view can be bookmarked and shared. Values that are not valid are ignored, so a hand-edited URL cannot break the page.
- **Server errors are mapped, not just shown:** the API's attribute names map to form fields, so "Email has already been taken." appears under the email field.
- **Accessibility is tested**, not assumed: an axe audit runs over every screen (including the dashboard, questions and explorer), and behaviours that axe cannot see (focus on the first problem, skip link, titles) have their own tests.

## Testing

- Tests are fast and deterministic: no network (MSW answers every call in the frontend, and an unmocked request fails the test), time is frozen with `travel_to`, randomness is seeded, and a large dataset is built once per group rather than per example.
- A passing test is not trusted until it has been seen to fail. For the behaviours that matter, the code was deliberately broken and the right tests had to go red. This found tests that passed for the wrong reason (for example a `<select>` that merely *displays* "Choose…").
- Real-browser checks against the seeded data complement the unit tests. They caught a salary sort left behind in the URL after the country was cleared, which would have come back silently when a country was chosen again; the component tests had missed it.

## Not built, on purpose

- **A free-text question box** (typing a question in words) is **on hold**. It would translate the sentence into the same validated `Analytics::Spec` and never produce a number itself, so it could be added without touching the calculations.
- **CSV export** is on hold.
- **Deployment** is not covered. SQLite is a single file, so a host with an ephemeral disk would lose edits on restart; the deterministic seed means a boot script could restore the demo data. Postgres is the production answer.
