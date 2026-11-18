# API reference

The backend is a JSON API under `/api/v1`. This document lists every endpoint with a real request and response, captured from the running app against the seeded data. Long lists are shortened to one item.

- [Conventions](#conventions)
- [Reference data](#reference-data)
- [Employees](#employees)
- [Salaries](#salaries)
- [Analytics](#analytics)
- [Errors](#errors)
- [Configuration](#configuration)

## Conventions

**Format.** Requests with a body send `Content-Type: application/json`. Success responses wrap their payload as `{ "data": ... }`.

**Money.** Amounts are integers in the currency's minor unit (cents), next to an ISO currency code, and never floats. `8500000` in USD is 85,000.00; in JPY, which has no minor unit, it is 8,500,000. Every salary response also includes a `formatted` string. An employee's salary is always in their country's currency, and cannot be sent separately.

**Dates.** Dates are ISO `YYYY-MM-DD`. "Today" is the server's UTC date, which decides what counts as "in the future".

**Employee lifecycle.** An employee is `active` or `terminated` (left the company, with a termination date; history is kept and they can be rehired). Separately, a record can be **soft-deleted** (`deleted_at` set) when it should not exist at all, such as a duplicate. Soft-deleted employees are hidden everywhere and answer `404`, but nothing is destroyed and they can be restored. There is no hard delete.

**Salary history.** Every salary change appends a record; records are never edited or removed. The employee's current salary is a copy of the latest record.

**Authentication.** None. The service is built for a single HR user and would sit behind the organisation's sign-in in production.

**Health check.** `GET /up` returns `200` when the app is running.

## Reference data

Small lookup lists that feed dropdowns. They are returned whole, sorted by name (currencies by code), without paging.

### GET /reference/countries

```http
GET /api/v1/reference/countries
```

Response `200`:

```json
{
  "data": [
    {
      "id": 7,
      "code": "AU",
      "name": "Australia",
      "currency_code": "AUD"
    }
  ]
}
```

Longer lists are shortened here to one item.

### GET /reference/currencies

`rate_to_usd` is a decimal string, never a float. Rates are fixed seed values, not a live feed.

```http
GET /api/v1/reference/currencies
```

Response `200`:

```json
{
  "data": [
    {
      "id": 7,
      "code": "AUD",
      "name": "Australian Dollar",
      "minor_unit_exponent": 2,
      "rate_to_usd": "0.66"
    }
  ]
}
```

Longer lists are shortened here to one item.

### GET /reference/departments

```http
GET /api/v1/reference/departments
```

Response `200`:

```json
{
  "data": [
    {
      "id": 4,
      "name": "Customer Support"
    }
  ]
}
```

Longer lists are shortened here to one item.

### GET /reference/job_titles

```http
GET /api/v1/reference/job_titles
```

Response `200`:

```json
{
  "data": [
    {
      "id": 7,
      "name": "Account Executive",
      "level": 2,
      "department_id": 2,
      "department_name": "Sales"
    }
  ]
}
```

Longer lists are shortened here to one item.

## Employees

### GET /employees

Lists employees, with filtering, sorting and cursor pagination. By default it returns kept (not soft-deleted) employees whose status is `active`.

| Parameter | Meaning |
|---|---|
| `q` | Text search: matches the start of any word in the name, or the start of the email or employee number. Case-insensitive. |
| `country_id`, `department_id`, `job_title_id` | Filter by one id each. |
| `status` | `active` (default), `terminated` or `all`. |
| `deleted` | `only` lists soft-deleted employees (their status then defaults to `all`). |
| `salary_min`, `salary_max` | Salary range in minor units. **Requires `country_id`**, because salaries are in local currencies. |
| `sort` | `full_name` (default), `hire_date`, `current_salary_cents` or `employee_number`; prefix with `-` for descending. Ties are broken by id. Sorting by salary across countries mixes currencies, so it is only meaningful with a country filter. |
| `per_page` | Page size, default 25, at most 100. |
| `cursor` | The `next_cursor` from the previous page. Opaque: do not build or change it. |

Pagination is by keyset, so a deep page costs the same as the first. It only moves forward; keep earlier cursors to go back. Unknown parameters are refused with `400` so a typo does not silently return everyone.

```http
GET /api/v1/employees?per_page=2&sort=-hire_date&country_id=1
```

Response `200`:

```json
{
  "data": [
    {
      "id": 7788,
      "employee_number": "E007788",
      "full_name": "Fatima Reddy",
      "email": "fatima.reddy.7788@acme.test",
      "gender": "female",
      "hire_date": "2026-10-18",
      "status": "active",
      "termination_date": null,
      "deleted_at": null,
      "country": {
        "id": 1,
        "code": "US",
        "name": "United States"
      },
      "department": {
        "id": 8,
        "name": "Legal"
      },
      "job_title": {
        "id": 37,
        "name": "Legal Counsel",
        "level": 3
      },
      "salary": {
        "amount_cents": 8650000,
        "currency": "USD",
        "formatted": "86,500.00 USD"
      }
    }
  ],
  "meta": {
    "total": 2692,
    "per_page": 2,
    "next_cursor": "WyIyMDI2LTEwLTE4Iiw1NTAyXQ"
  }
}
```

`next_cursor` is `null` on the last page. Pass it back as `cursor` to get the next page.

```http
GET /api/v1/employees?deleted=only&per_page=1
```

Response `200`:

```json
{
  "data": [
    {
      "id": 10004,
      "employee_number": "E010004",
      "full_name": "API Example Jr.",
      "email": "api.example@acme.test",
      "gender": "undisclosed",
      "hire_date": "2026-11-18",
      "status": "active",
      "termination_date": null,
      "deleted_at": "2026-11-18T06:00:08.963Z",
      "country": {
        "id": 1,
        "code": "US",
        "name": "United States"
      },
      "department": {
        "id": 1,
        "name": "Engineering"
      },
      "job_title": {
        "id": 2,
        "name": "Software Engineer",
        "level": 2
      },
      "salary": {
        "amount_cents": 9800000,
        "currency": "USD",
        "formatted": "98,000.00 USD"
      }
    }
  ],
  "meta": {
    "total": 9,
    "per_page": 1,
    "next_cursor": "WyJBUEkgRXhhbXBsZSBKci4iLDEwMDA0XQ"
  }
}
```

`deleted=only` lists soft-deleted employees.

### POST /employees

Creates an employee together with their first (`hire`) salary record, atomically. `salary_cents` is in the country's currency. A future `hire_date` is allowed, so new starters can be entered early. The employee number (`E000001`...) is assigned by the server.

```http
POST /api/v1/employees
Content-Type: application/json

{
  "employee": {
    "full_name": "API Example",
    "email": "api.example@acme.test",
    "gender": "undisclosed",
    "hire_date": "2026-11-18",
    "country_id": 1,
    "department_id": 1,
    "job_title_id": 2,
    "salary_cents": 8500000
  }
}
```

Response `201`:

```json
{
  "data": {
    "id": 10004,
    "employee_number": "E010004",
    "full_name": "API Example",
    "email": "api.example@acme.test",
    "gender": "undisclosed",
    "hire_date": "2026-11-18",
    "status": "active",
    "termination_date": null,
    "deleted_at": null,
    "country": {
      "id": 1,
      "code": "US",
      "name": "United States"
    },
    "department": {
      "id": 1,
      "name": "Engineering"
    },
    "job_title": {
      "id": 2,
      "name": "Software Engineer",
      "level": 2
    },
    "salary": {
      "amount_cents": 8500000,
      "currency": "USD",
      "formatted": "85,000.00 USD"
    }
  }
}
```

### GET /employees/:id

```http
GET /api/v1/employees/10004
```

Response `200`:

```json
{
  "data": {
    "id": 10004,
    "employee_number": "E010004",
    "full_name": "API Example",
    "email": "api.example@acme.test",
    "gender": "undisclosed",
    "hire_date": "2026-11-18",
    "status": "active",
    "termination_date": null,
    "deleted_at": null,
    "country": {
      "id": 1,
      "code": "US",
      "name": "United States"
    },
    "department": {
      "id": 1,
      "name": "Engineering"
    },
    "job_title": {
      "id": 2,
      "name": "Software Engineer",
      "level": 2
    },
    "salary": {
      "amount_cents": 8500000,
      "currency": "USD",
      "formatted": "85,000.00 USD"
    }
  }
}
```

### PATCH /employees/:id

Changes profile fields: `full_name`, `email`, `gender`, `department_id` and `job_title_id`. Send department and job title together when moving someone, because a job title belongs to one department. Country, hire date, salary and status cannot be changed here; sending them returns `400`.

```http
PATCH /api/v1/employees/10004
Content-Type: application/json

{
  "employee": {
    "full_name": "API Example Jr."
  }
}
```

Response `200`:

```json
{
  "data": {
    "id": 10004,
    "employee_number": "E010004",
    "full_name": "API Example Jr.",
    "email": "api.example@acme.test",
    "gender": "undisclosed",
    "hire_date": "2026-11-18",
    "status": "active",
    "termination_date": null,
    "deleted_at": null,
    "country": {
      "id": 1,
      "code": "US",
      "name": "United States"
    },
    "department": {
      "id": 1,
      "name": "Engineering"
    },
    "job_title": {
      "id": 2,
      "name": "Software Engineer",
      "level": 2
    },
    "salary": {
      "amount_cents": 8500000,
      "currency": "USD",
      "formatted": "85,000.00 USD"
    }
  }
}
```

### POST /employees/:id/terminate

Records that someone left. `termination_date` is required and cannot be in the future or before the hire date. Salary history is kept.

```http
POST /api/v1/employees/10004/terminate
Content-Type: application/json

{
  "termination_date": "2026-11-18"
}
```

Response `200`:

```json
{
  "data": {
    "id": 10004,
    "employee_number": "E010004",
    "full_name": "API Example Jr.",
    "email": "api.example@acme.test",
    "gender": "undisclosed",
    "hire_date": "2026-11-18",
    "status": "terminated",
    "termination_date": "2026-11-18",
    "deleted_at": null,
    "country": {
      "id": 1,
      "code": "US",
      "name": "United States"
    },
    "department": {
      "id": 1,
      "name": "Engineering"
    },
    "job_title": {
      "id": 2,
      "name": "Software Engineer",
      "level": 2
    },
    "salary": {
      "amount_cents": 9350000,
      "currency": "USD",
      "formatted": "93,500.00 USD"
    }
  }
}
```

### POST /employees/:id/rehire

Makes a terminated employee active again. Optionally gives a new salary, which is recorded as a `rehire` salary record.

```http
POST /api/v1/employees/10004/rehire
Content-Type: application/json

{
  "salary_cents": 9800000,
  "effective_from": "2026-11-18"
}
```

Response `200`:

```json
{
  "data": {
    "id": 10004,
    "employee_number": "E010004",
    "full_name": "API Example Jr.",
    "email": "api.example@acme.test",
    "gender": "undisclosed",
    "hire_date": "2026-11-18",
    "status": "active",
    "termination_date": null,
    "deleted_at": null,
    "country": {
      "id": 1,
      "code": "US",
      "name": "United States"
    },
    "department": {
      "id": 1,
      "name": "Engineering"
    },
    "job_title": {
      "id": 2,
      "name": "Software Engineer",
      "level": 2
    },
    "salary": {
      "amount_cents": 9800000,
      "currency": "USD",
      "formatted": "98,000.00 USD"
    }
  }
}
```

Both fields are optional. Without `salary_cents`, the salary is unchanged.

### DELETE /employees/:id

```http
DELETE /api/v1/employees/10004
```

Response `200`:

```json
{
  "data": {
    "id": 10004,
    "employee_number": "E010004",
    "full_name": "API Example Jr.",
    "email": "api.example@acme.test",
    "gender": "undisclosed",
    "hire_date": "2026-11-18",
    "status": "active",
    "termination_date": null,
    "deleted_at": "2026-11-18T06:00:08.963Z",
    "country": {
      "id": 1,
      "code": "US",
      "name": "United States"
    },
    "department": {
      "id": 1,
      "name": "Engineering"
    },
    "job_title": {
      "id": 2,
      "name": "Software Engineer",
      "level": 2
    },
    "salary": {
      "amount_cents": 9800000,
      "currency": "USD",
      "formatted": "98,000.00 USD"
    }
  }
}
```

This is a soft delete: the record is hidden, not destroyed.

### POST /employees/:id/restore

Un-hides a soft-deleted employee. It fails with `422` on `email` if another employee has taken the address in the meantime.

```http
POST /api/v1/employees/10004/restore
```

Response `200`:

```json
{
  "data": {
    "id": 10004,
    "employee_number": "E010004",
    "full_name": "API Example Jr.",
    "email": "api.example@acme.test",
    "gender": "undisclosed",
    "hire_date": "2026-11-18",
    "status": "active",
    "termination_date": null,
    "deleted_at": null,
    "country": {
      "id": 1,
      "code": "US",
      "name": "United States"
    },
    "department": {
      "id": 1,
      "name": "Engineering"
    },
    "job_title": {
      "id": 2,
      "name": "Software Engineer",
      "level": 2
    },
    "salary": {
      "amount_cents": 9800000,
      "currency": "USD",
      "formatted": "98,000.00 USD"
    }
  }
}
```

## Salaries

### POST /employees/:id/salary_changes

Appends a salary record and updates the employee's current salary, in one transaction.

- `reason` is one of `merit`, `promotion`, `adjustment`, `correction` or `rehire`. `hire` is refused, because the hire record is created together with the employee. (The UI offers only the first four; `rehire` entries are recorded by its Rehire action.)
- `effective_from` cannot be in the future or before the employee's latest salary record.
- The currency cannot be sent; it is always the employee's.
- It is refused for terminated and soft-deleted employees.

```http
POST /api/v1/employees/10004/salary_changes
Content-Type: application/json

{
  "salary_change": {
    "amount_cents": 9350000,
    "effective_from": "2026-11-18",
    "reason": "merit"
  }
}
```

Response `201`:

```json
{
  "data": {
    "salary_record": {
      "id": 77231,
      "amount_cents": 9350000,
      "currency": "USD",
      "formatted": "93,500.00 USD",
      "effective_from": "2026-11-18",
      "reason": "merit",
      "created_at": "2026-11-18T06:00:08.883Z"
    },
    "employee": {
      "id": 10004,
      "employee_number": "E010004",
      "full_name": "API Example Jr.",
      "email": "api.example@acme.test",
      "gender": "undisclosed",
      "hire_date": "2026-11-18",
      "status": "active",
      "termination_date": null,
      "deleted_at": null,
      "country": {
        "id": 1,
        "code": "US",
        "name": "United States"
      },
      "department": {
        "id": 1,
        "name": "Engineering"
      },
      "job_title": {
        "id": 2,
        "name": "Software Engineer",
        "level": 2
      },
      "salary": {
        "amount_cents": 9350000,
        "currency": "USD",
        "formatted": "93,500.00 USD"
      }
    }
  }
}
```

### GET /employees/:id/salary_records

The employee's full history, newest first. It is returned whole, without paging.

```http
GET /api/v1/employees/10004/salary_records
```

Response `200`:

```json
{
  "data": [
    {
      "id": 77231,
      "amount_cents": 9350000,
      "currency": "USD",
      "formatted": "93,500.00 USD",
      "effective_from": "2026-11-18",
      "reason": "merit",
      "created_at": "2026-11-18T06:00:08.883Z"
    }
  ]
}
```

Newest first.

## Analytics

How the organisation pays people. Everything here is computed on request from the current data, never stored or estimated.

**Currency.** Salaries are held in each employee's own currency, so to compare countries every figure in the analytics is converted to **US dollars** with the same exact, half-up conversion used elsewhere, and reported in USD cents (with a `formatted` string). A headcount is a plain count.

**Who is counted.** Active employees by default; `status` can be `terminated` or `all`. Soft-deleted employees are never counted. Every endpoint refuses unknown parameters with `400`.

### GET /analytics/summary

Answers one question: a **measure**, optionally **grouped** by up to two things, over the employees that match the filters.

| Parameter | Meaning |
|---|---|
| `metric` | `headcount` (default), `sum`, `avg`, `median`, `p25`, `p75`, `min`, `max`, or `iqr` (the spread: 75th minus 25th percentile). Percentiles interpolate between ranks, like Excel's `PERCENTILE.INC`. |
| `group_by` | Up to two, comma separated, no repeats, from `country`, `department`, `job_title`, `gender`, `level`. None gives only the overall `total`. |
| `status` | `active` (default), `terminated` or `all`. |
| `country_id`, `department_id`, `job_title_id`, `level`, `gender` | Filters. `level` is 1 to 7; `gender` is `female`, `male`, `non_binary` or `undisclosed`. |
| `terminated_after` | A date. Only employees who left on or after it. Implies `status=terminated`, and contradicts any other status. |

Each row has the `group` it describes, its `headcount`, and the `value` of the measure (`null` when nobody matched). The response repeats what was asked, so a screen can show it.

```http
GET /api/v1/analytics/summary?metric=median&group_by=department
```

Response `200`:

```json
{
  "data": {
    "metric": "median",
    "group_by": [
      "department"
    ],
    "status": "active",
    "filters": {},
    "unit": "usd_cents",
    "currency": "USD",
    "rows": [
      {
        "group": {
          "department": {
            "id": 4,
            "label": "Customer Support"
          }
        },
        "headcount": 1111,
        "value": 4800600,
        "formatted": "48,006.00 USD"
      }
    ],
    "total": {
      "group": {},
      "headcount": 9191,
      "value": 4870800,
      "formatted": "48,708.00 USD"
    }
  }
}
```

Shortened to one row. The `total` is the same measure over everyone matched.

Grouping two ways:

```http
GET /api/v1/analytics/summary?metric=headcount&group_by=country,gender&status=all
```

Response `200`:

```json
{
  "data": {
    "metric": "headcount",
    "group_by": [
      "country"
    ],
    "status": "all",
    "filters": {},
    "unit": "count",
    "currency": null,
    "rows": [
      {
        "group": {
          "country": {
            "id": 7,
            "label": "Australia"
          },
          "gender": {
            "id": "female",
            "label": "Female"
          }
        },
        "headcount": 235,
        "value": 235,
        "formatted": "235"
      }
    ],
    "total": {
      "group": {},
      "headcount": 9992,
      "value": 9992,
      "formatted": "9,992"
    }
  }
}
```

Shortened to one row.

Leavers since a date:

```http
GET /api/v1/analytics/summary?metric=avg&terminated_after=2025-01-01
```

Response `200`:

```json
{
  "data": {
    "metric": "avg",
    "group_by": [],
    "status": "terminated",
    "filters": {
      "terminated_after": "2025-01-01"
    },
    "unit": "usd_cents",
    "currency": "USD",
    "rows": [],
    "total": {
      "group": {},
      "headcount": 396,
      "value": 5269267,
      "formatted": "52,692.67 USD"
    }
  }
}
```

`terminated_after` implies `status` is `terminated`.

An invalid question is a `400`:

```http
GET /api/v1/analytics/summary?metric=mode
```

Response `400`:

```json
{
  "error": {
    "code": "bad_request",
    "message": "metric must be one of: headcount, sum, avg, median, p25, p75, min, max, iqr"
  }
}
```

### GET /insights/gender_pay_gap

Compares women with men **in the same job title and country** (so each comparison is in one currency and ignores that women may work in different roles), then combines those comparisons weighted by the number of women. The raw gap, which does not account for role or country, is reported alongside for context.

- Only women and men are compared. A job title and country with fewer than `min_group_size` (3) of either is left out.
- `gap_percent` is negative when women are paid less. A gap resting on fewer than `small_sample_below` (20) women has `small_sample: true`: with so few people one salary can move it by several points.
- This measures a difference in pay, not its cause. It does not account for tenure, performance or anything else.
- Parameters: `status`, `country_id`, `department_id`.

```http
GET /api/v1/insights/gender_pay_gap
```

Response `200`:

```json
{
  "data": {
    "status": "active",
    "filters": {},
    "min_group_size": 3,
    "small_sample_below": 20,
    "adjusted_gap_percent": -0.85,
    "unadjusted_gap_percent": -1.01,
    "women": 4213,
    "men": 4234,
    "women_compared": 3935,
    "comparisons_made": 242,
    "comparisons_possible": 362,
    "rows": [
      {
        "job_title": {
          "id": 20,
          "name": "Head of Support",
          "level": 6,
          "department": "Customer Support"
        },
        "women": 12,
        "men": 11,
        "women_compared": 4,
        "gap_percent": -16.67,
        "small_sample": true
      }
    ]
  }
}
```

Shortened to one job title.

### GET /insights/out_of_band

Employees paid outside the pay band for their job title in their country, furthest outside first. `distance_percent` is how far beyond the nearest edge of the band the salary is. A job title with no band in a country is not reported. The band's edges count as inside it.

Parameters: `direction` (`any`, `below`, `above`), `status`, `country_id`, `department_id`, `job_title_id`, `limit` (default 50, at most 200). `total`, `below` and `above` count everyone, not just the rows returned.

```http
GET /api/v1/insights/out_of_band?direction=below&limit=1
```

Response `200`:

```json
{
  "data": {
    "status": "active",
    "direction": "below",
    "filters": {},
    "limit": 1,
    "total": 26,
    "below": 26,
    "above": 25,
    "rows": [
      {
        "id": 8681,
        "employee_number": "E008681",
        "full_name": "Elena Nguyen",
        "status": "active",
        "country": {
          "id": 1,
          "code": "US",
          "name": "United States"
        },
        "department": {
          "id": 4,
          "name": "Customer Support"
        },
        "job_title": {
          "id": 16,
          "name": "Support Agent",
          "level": 1
        },
        "salary": {
          "amount_cents": 3070000,
          "currency": "USD",
          "formatted": "30,700.00 USD"
        },
        "direction": "below",
        "distance_percent": 14.72,
        "band": {
          "min_cents": 3600000,
          "max_cents": 5630000,
          "formatted": "36,000.00 USD to 56,300.00 USD"
        }
      }
    ]
  }
}
```

### GET /insights/stale_salaries

Employees whose latest salary record is older than `months`, longest first. Any salary record counts as a change, including the hire record, so someone never raised is included.

Parameters: `months` (default 24, 1 to 120), `status`, `country_id`, `department_id`, `limit` (default 50, at most 200). `total` counts everyone, not just the rows returned.

```http
GET /api/v1/insights/stale_salaries?months=24&limit=1
```

Response `200`:

```json
{
  "data": {
    "status": "active",
    "months": 24,
    "filters": {},
    "limit": 1,
    "total": 581,
    "rows": [
      {
        "id": 3152,
        "employee_number": "E003152",
        "full_name": "Riley Smith",
        "status": "active",
        "country": {
          "id": 7,
          "code": "AU",
          "name": "Australia"
        },
        "department": {
          "id": 1,
          "name": "Engineering"
        },
        "job_title": {
          "id": 2,
          "name": "Software Engineer",
          "level": 2
        },
        "salary": {
          "amount_cents": 9430000,
          "currency": "AUD",
          "formatted": "94,300.00 AUD"
        },
        "last_change_on": "2017-07-11",
        "months_since": 112
      }
    ]
  }
}
```

### GET /questions

The catalog of common pay questions: median pay for each role in each country, the gender pay gap, who is paid below their band, payroll by department, the widest pay spread, who has had no salary change in 24 months, and what leavers earned in the last year. Each is a fixed definition of the analytics call that answers it.

```http
GET /api/v1/questions
```

Response `200`:

```json
{
  "data": [
    {
      "id": "median-pay-by-role-and-country",
      "title": "What is the median salary for each role in each country?",
      "description": "The middle salary for every job title in every country, in USD so countries compare. Active employees.",
      "kind": "summary"
    }
  ]
}
```

Shortened to one question.

### GET /questions/:id/answer

Runs one question. The answer repeats the question and the exact parameters it used, with the `result` in the same shape as the analytics endpoint behind its `kind` (`summary`, `gender_pay_gap`, `out_of_band` or `stale_salaries`). A question takes no parameters; any are refused.

```http
GET /api/v1/questions/payroll-by-department/answer
```

Response `200`:

```json
{
  "data": {
    "id": "payroll-by-department",
    "title": "What is the total payroll by department?",
    "description": "The sum of current salaries for each department, in USD. Active employees.",
    "kind": "summary",
    "params": {
      "metric": "sum",
      "group_by": "department"
    },
    "result": {
      "metric": "sum",
      "group_by": [
        "department"
      ],
      "status": "active",
      "filters": {},
      "unit": "usd_cents",
      "currency": "USD",
      "rows": [
        {
          "group": {
            "department": {
              "id": 4,
              "label": "Customer Support"
            }
          },
          "headcount": 1111,
          "value": 5884954389,
          "formatted": "58,849,543.89 USD"
        }
      ],
      "total": {
        "group": {},
        "headcount": 9191,
        "value": 48999274487,
        "formatted": "489,992,744.87 USD"
      }
    }
  }
}
```

Shortened to one row. The `result` has the same shape as the analytics endpoint of that `kind`.

An unknown question is a `404`:

```http
GET /api/v1/questions/no-such-question/answer
```

Response `404`:

```json
{
  "error": {
    "code": "not_found",
    "message": "Question not found"
  }
}
```

## Errors

Every error uses one shape: `{ "error": { "code", "message", "details" } }`. `details` is present only for `validation_failed`, and maps field names to messages.

| Status | `code` | When |
|---|---|---|
| `400` | `bad_request` | Unknown or forbidden parameter, a missing required parameter, an invalid filter or cursor, or a body that is not valid JSON. |
| `404` | `not_found` | Unknown id, a soft-deleted employee, or an unknown path. |
| `413` | `payload_too_large` | The request body is over the size limit. |
| `422` | `validation_failed` | The request was understood but breaks a rule. `details` says which. |
| `500` | `internal_error` | Something unexpected; the message never reveals what. |

**Validation failure**

```http
POST /api/v1/employees
Content-Type: application/json

{
  "employee": {
    "full_name": "",
    "email": "nope",
    "gender": "x"
  }
}
```

Response `422`:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Validation failed",
    "details": {
      "country": [
        "must exist"
      ],
      "department": [
        "must exist"
      ],
      "job_title": [
        "must exist"
      ],
      "gender": [
        "is not included in the list"
      ],
      "full_name": [
        "can't be blank"
      ],
      "hire_date": [
        "can't be blank"
      ],
      "email": [
        "is invalid"
      ],
      "current_salary_cents": [
        "is not a number"
      ],
      "current_currency": [
        "can't be blank"
      ]
    }
  }
}
```

**A rule broken by an action** (the same shape, with the field the rule is about)

```http
POST /api/v1/employees/10004/terminate
Content-Type: application/json

{
  "termination_date": "2999-01-01"
}
```

Response `422`:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Validation failed",
    "details": {
      "termination_date": [
        "cannot be in the future"
      ]
    }
  }
}
```

**Not found**

```http
GET /api/v1/employees/0
```

Response `404`:

```json
{
  "error": {
    "code": "not_found",
    "message": "Employee not found"
  }
}
```

**Unknown parameter**

```http
GET /api/v1/employees?contry_id=1
```

Response `400`:

```json
{
  "error": {
    "code": "bad_request",
    "message": "unknown parameter(s): contry_id"
  }
}
```

**Invalid JSON**

```http
POST /api/v1/employees
Content-Type: application/json

{not json
```

Response `400`:

```json
{
  "error": {
    "code": "bad_request",
    "message": "The request could not be understood."
  }
}
```

This is the shape a deployed app returns (checked by the request specs). In development, Rails replies with its own detailed debug response, including a stack trace, instead.

**Body too large**

```http
POST /api/v1/employees
Content-Type: application/json

{ "employee": { "full_name": "aaaa…(70,000 characters)" } }
```

Response `413`:

```json
{
  "error": {
    "code": "payload_too_large",
    "message": "The request body is larger than 65536 bytes."
  }
}
```

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `CORS_ORIGINS` | none | Comma-separated origins allowed to call the API from a browser on another host. Empty means no cross-origin access, which suits the UI being served from the same origin (or through the dev proxy). |
| `MAX_REQUEST_BYTES` | `65536` | Largest accepted request body. |
