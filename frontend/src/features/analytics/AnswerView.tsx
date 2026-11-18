import type { QuestionAnswer } from '../../api/types'
import { OutOfBandTable, StaleSalariesTable } from './EmployeeFindings'
import GenderGapView from './GenderGapView'
import SummaryTable from './SummaryTable'

/** Shows a catalog answer the way its kind of result is best read. */
export default function AnswerView({ answer }: { answer: QuestionAnswer }) {
  const asked = Object.entries(answer.params)

  return (
    <article aria-labelledby="answer-title">
      <h2 className="h5" id="answer-title">
        {answer.title}
      </h2>
      <p className="text-body-secondary">{answer.description}</p>

      {answer.kind === 'summary' && (
        <SummaryTable
          summary={answer.result}
          order={answer.result.metric === 'median' ? 'group' : 'value'}
        />
      )}
      {answer.kind === 'gender_pay_gap' && <GenderGapView data={answer.result} />}
      {answer.kind === 'out_of_band' && (
        <>
          <p className="small text-body-secondary">
            {answer.result.below} paid below and {answer.result.above} paid above their band.
          </p>
          <OutOfBandTable data={answer.result} />
        </>
      )}
      {answer.kind === 'stale_salaries' && (
        <>
          <p className="small text-body-secondary">{answer.result.total} employees.</p>
          <StaleSalariesTable data={answer.result} />
        </>
      )}

      {asked.length > 0 && (
        <details className="mt-3 small text-body-secondary">
          <summary>How this was worked out</summary>
          <dl className="row mb-0 mt-2">
            {asked.map(([name, value]) => (
              <div className="col-12" key={name}>
                <dt className="d-inline fw-normal">{name.replace(/_/g, ' ')}: </dt>
                <dd className="d-inline">{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </article>
  )
}
