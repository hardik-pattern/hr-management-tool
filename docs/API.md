# API reference

The backend is a JSON API under `/api/v1`. This document lists every endpoint with a real request and response, captured from the running app against the seeded data. Long lists are shortened to one item.

- [Conventions](#conventions)
- [Reference data](#reference-data)
- [Employees](#employees)
- [Salaries](#salaries)
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
