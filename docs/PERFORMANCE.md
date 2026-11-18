# Performance notes

Measured on a developer laptop (Apple Silicon, SQLite, Ruby 3.3). Numbers are
from single runs, so treat them as orders of magnitude, not benchmarks. This
file grows as later steps add measurements (listing, analytics).

## Seeding (step B11)

`bin/rails db:seed` builds the demo organisation.

| What | Result |
|---|---|
| Employees created | 10,000 |
| Salary records created | 25,741 (about 2.6 per employee) |
| Reference data (9 currencies, 10 countries, 8 departments, 40 job titles, 400 pay bands) | well under 1 s |
| Full `db:seed` on an empty database | **2.9 s** |
| `db:seed` when employees already exist | 0.2 s (generation is skipped) |
| SQLite file size after seeding | 4.9 MB |

How it stays fast:

- Rows are written with `insert_all` in batches of 1,000 employees (with
  their salary records), inside one transaction. This skips validations and
  callbacks, so the generator's specs check that what it writes satisfies the
  model rules.
- Pay bands are written with one `upsert_all` rather than a find-and-update
  per row. Re-running the seed is safe.
- Everything random uses one `Random.new(seed)`, so the same seed and date
  give identical data. A spec compares two runs row by row.

Caveat: history dates are built relative to "today", so the dataset is
identical for a given day but shifts as time passes (for example, more people
become stale as their last raise ages). The generator takes `today:` so tests
pin the date.

## Shape of the generated data

Planted on purpose so the insights have something to find:

| Case | How it is planted |
|---|---|
| Paid outside the pay band | 0.5% of employees, 5-15% beyond the band edge (51 active employees in the 10,000 run) |
| No raise for over 24 months | about 9% of long-tenured active employees (581 active employees in the 10,000 run) |
| Gender pay gap | women paid 4% less in 6 titles; measured mean position in band 0.965 (women) vs 1.007 (men) there, and 0.9985 vs 0.9991 elsewhere |
| Left the company | about 8.5% of employees with a valid termination date (802 in the run) |
| Soft-deleted | 8 records |

The gender gap exists only in this fake data, so the gender pay gap insight
can demonstrate itself. It says nothing about any real organisation.

## Employee list (step B12)

`EmployeeSearch` against the 10,000-employee seed, averaged over 5 runs after
a warm-up. Each figure covers the page query, the total count and the
association preloading, but not JSON rendering or HTTP.

| Request | Time |
|---|---|
| First page, default sort | 3.2 ms |
| `q=Asha` | 2.0 ms |
| Country and department filter | 3.8 ms |
| Sorted by salary, descending (one country) | 3.4 ms |
| `status=all`, 100 rows per page | 4.2 ms |
| Salary range within a country | 2.9 ms |
| Deep page (about the 300th of 400) | 3.1 ms |

The deep page costs the same as the first because pagination is keyset
(`WHERE (sort_col, id) > cursor`), not `OFFSET`, which would scan and discard
every earlier row.

Associations are preloaded with `includes`, so a page is a fixed number of
queries however many rows it holds. A spec compares the query count for a
2-row and a 12-row page; I checked it fails (50 queries instead of 10) when
the `includes` is removed.

Known limits:

- Salaries are stored in each employee's local currency, so sorting by salary
  across countries mixes currencies. The salary range filter therefore
  requires a country, and the UI should treat salary sorting as meaningful
  within one country. Cross-country comparison belongs to the analytics
  endpoints, which convert to USD.
- `q` matches word prefixes with `LIKE 'x%'`. SQLite's `LIKE` is
  case-insensitive for ASCII only; on Postgres this would be `ILIKE`.

## Analytics (steps B14 to B19)

Every analytics request against the 10,000-employee seed, measured through the whole Rack stack (routing, query, JSON), median of 7 runs after a warm-up.

| Request | Time | Response |
|---|---|---|
| Headcount, total only | 41 ms | 188 B |
| Median pay by department | 53 ms | 1.1 KB |
| Spread (p75 - p25) by department | 56 ms | 1.1 KB |
| Sum by country, all statuses | 56 ms | 1.4 KB |
| Median pay by job title and country (363 groups) | 102 ms | 58 KB |
| Gender pay gap | 95 ms | 6.8 KB |
| Paid outside their band (top 50 of 51) | 28 ms | 23 KB |
| No salary change in 24 months (top 50 of 581) | 18 ms | 18 KB |
| Question: leavers in the last year | 5 ms | 1.5 KB |

A dashboard that asks for several of these at once costs a few hundred milliseconds of server time, one after another on a single-threaded dev server.

**Where the time goes.** For "median by department" the engine takes about 38 ms: roughly 8 ms to read the 9,191 rows, 15 ms to convert each salary to USD with the exact `Money` arithmetic, and the rest to group and take percentiles. The conversion happens in Ruby, not SQL, on purpose: SQLite has no percentile function, and floating-point SQL would not round the way `Money` does, so a figure here always agrees with the same amount shown anywhere else. A headcount does not need the conversion and could skip it (saving about 15 ms of 26), but that special case is not worth the extra code at this size.

**Query plans.** The plans for the SQL parts were read, and a spec (`spec/performance/query_plans_spec.rb`) fails if they regress:

- *Out of band* finds each employee's band with `SEARCH pay_bands USING INDEX index_pay_bands_on_job_title_id_and_country_id`, never a scan.
- *Stale salaries* finds each employee's latest change with `SEARCH salary_records USING COVERING INDEX index_salary_records_on_employee_id_and_effective_from`, answered from the index alone.
- The engine narrows by status with `index_employees_on_status` and joins country, department and job title through primary keys.

No new index was needed: the ones from the data model already cover these. The spec was checked by dropping the pay-band index, which turned it red.

**Not done.** Aggregation could move into SQL for the metrics SQLite can compute (count, sum, average, min, max); percentiles would still need the rows. At 10,000 rows that is a saving of tens of milliseconds, so the single, exact path was kept.

## Test suite

The whole backend suite runs in about 10 seconds.
The seeding specs run in about 4 seconds of that: read-only specs about a
3,000-employee dataset share one dataset per group (created once, removed
afterwards) instead of regenerating it for every example, which took the
seeding specs from about 19 s to about 4 s.
