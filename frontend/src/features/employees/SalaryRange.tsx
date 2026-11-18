import { useEffect, useRef, useState } from 'react'
import { Col, Form, InputGroup, Row } from 'react-bootstrap'
import { formatAmount, parseAmount } from '../../lib/money'
import { SEARCH_DEBOUNCE_MS } from './SearchBox'

const PROBLEM_ID = 'salary-range-problem'

interface Props {
  currencyCode: string
  /** Decimal places of the currency (2 for USD, 0 for JPY). */
  exponent: number
  /** Applied range, in minor units, from the URL. */
  min: number | undefined
  max: number | undefined
  onChange: (range: { salary_min: number | undefined; salary_max: number | undefined }) => void
}

/**
 * Minimum and maximum salary in the chosen country's currency. People type
 * whole units ("50000"); the API gets minor units. An invalid or reversed
 * range is explained and not applied. To reset from outside, remount with a
 * new +key+.
 */
export default function SalaryRange({ currencyCode, exponent, min, max, onChange }: Props) {
  const [minText, setMinText] = useState(min === undefined ? '' : formatAmount(min, exponent))
  const [maxText, setMaxText] = useState(max === undefined ? '' : formatAmount(max, exponent))
  const onChangeRef = useRef(onChange)
  // Kept in a ref so a new callback each render does not restart the debounce.
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const parsedMin = parseAmount(minText, exponent)
  const parsedMax = parseAmount(maxText, exponent)
  const problem =
    !parsedMin.ok || !parsedMax.ok
      ? 'Enter amounts like 50000 or 50000.50.'
      : parsedMin.cents !== undefined &&
          parsedMax.cents !== undefined &&
          parsedMin.cents > parsedMax.cents
        ? 'The minimum cannot be more than the maximum.'
        : undefined

  // Both fields share one message, so both point at it.
  const invalidFor = problem
    ? { isInvalid: true, 'aria-invalid': true as const, 'aria-describedby': PROBLEM_ID }
    : { isInvalid: false }

  const wantedMin = parsedMin.ok ? parsedMin.cents : undefined
  const wantedMax = parsedMax.ok ? parsedMax.cents : undefined

  useEffect(() => {
    if (problem || (wantedMin === min && wantedMax === max)) return
    const timer = setTimeout(
      () => onChangeRef.current({ salary_min: wantedMin, salary_max: wantedMax }),
      SEARCH_DEBOUNCE_MS,
    )
    return () => clearTimeout(timer)
  }, [problem, wantedMin, wantedMax, min, max])

  return (
    <fieldset>
      <legend className="form-label fs-6 mb-2">Salary ({currencyCode})</legend>
      <Row className="g-2">
        <Col>
          <InputGroup>
            <Form.Control
              aria-label="Minimum salary"
              placeholder="Min"
              inputMode="decimal"
              value={minText}
              {...invalidFor}
              onChange={(event) => setMinText(event.target.value)}
            />
          </InputGroup>
        </Col>
        <Col>
          <InputGroup>
            <Form.Control
              aria-label="Maximum salary"
              placeholder="Max"
              inputMode="decimal"
              value={maxText}
              {...invalidFor}
              onChange={(event) => setMaxText(event.target.value)}
            />
          </InputGroup>
        </Col>
      </Row>
      {problem && (
        <div id={PROBLEM_ID} role="alert" className="text-danger small mt-1">
          {problem}
        </div>
      )}
    </fieldset>
  )
}
