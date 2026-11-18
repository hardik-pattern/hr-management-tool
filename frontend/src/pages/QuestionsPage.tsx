import { ListGroup } from 'react-bootstrap'
import { useSearchParams } from 'react-router-dom'
import { useQuestionAnswer, useQuestions } from '../api/analytics'
import AnswerView from '../features/analytics/AnswerView'
import QueryBoundary from '../features/analytics/QueryBoundary'
import { useDocumentTitle } from '../lib/useDocumentTitle'

/** The common pay questions, each answered in one click. */
export default function QuestionsPage() {
  useDocumentTitle('Questions')
  const [params, setParams] = useSearchParams()
  const questions = useQuestions()

  // The first question is shown until another is chosen, so the page is never empty.
  const selected = params.get('question') ?? questions.data?.[0]?.id
  const answer = useQuestionAnswer(selected)

  return (
    <>
      <h1 className="h3 mb-1">Questions</h1>
      <p className="text-body-secondary">
        Common questions about how the organisation pays people, answered from the current data.
      </p>

      <div className="row g-4">
        <div className="col-lg-4">
          <QueryBoundary query={questions} label="the questions">
            {(list) => (
              <nav aria-label="Questions">
                <ListGroup>
                  {list.map((question) => (
                    <ListGroup.Item
                      key={question.id}
                      action
                      active={question.id === selected}
                      aria-current={question.id === selected ? 'true' : undefined}
                      onClick={() => setParams({ question: question.id }, { replace: true })}
                    >
                      {question.title}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </nav>
            )}
          </QueryBoundary>
        </div>
        <div className="col-lg-8">
          {selected && (
            <QueryBoundary query={answer} label="the answer">
              {(data) => <AnswerView answer={data} />}
            </QueryBoundary>
          )}
        </div>
      </div>
    </>
  )
}
