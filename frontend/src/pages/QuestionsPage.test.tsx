import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { buildAnswer, errorBody, questionList } from '../test/fixtures'
import { renderWithProviders } from '../test/renderWithProviders'
import { server } from '../test/server'
import QuestionsPage from './QuestionsPage'

function Where() {
  return <p data-testid="where">{useLocation().pathname + useLocation().search}</p>
}

/** Serves the catalog and its answers, recording which answers were asked for. */
function serveQuestions() {
  const asked: string[] = []
  server.use(
    http.get('/api/v1/questions', () => HttpResponse.json({ data: questionList })),
    http.get('/api/v1/questions/:id/answer', ({ params }) => {
      asked.push(params.id as string)
      return questionList.some((q) => q.id === params.id)
        ? HttpResponse.json({ data: buildAnswer(params.id as string) })
        : HttpResponse.json(errorBody('not_found', 'Question not found'), { status: 404 })
    }),
  )
  return asked
}

function renderPage(route = '/questions') {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/questions" element={<QuestionsPage />} />
      </Routes>
      <Where />
    </>,
    { route },
  )
}

const choose = (title: RegExp | string) =>
  userEvent.click(screen.getByRole('button', { name: title }))

describe('QuestionsPage', () => {
  it('lists the questions, with the first answered straight away', async () => {
    const asked = serveQuestions()
    renderPage()

    expect(
      await screen.findByRole('button', { name: 'What is the total payroll by department?' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(
      questionList.map((q) => q.title),
    )
    expect(
      await screen.findByRole('heading', {
        name: 'What is the total payroll by department?',
        level: 2,
      }),
    ).toBeInTheDocument()
    expect(asked).toEqual(['payroll-by-department'])
  })

  it('marks the question being shown', async () => {
    serveQuestions()
    renderPage()

    const first = await screen.findByRole('button', { name: /total payroll/ })
    expect(first).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /gender pay gap/ })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('answers another question when it is chosen, and puts it in the address', async () => {
    const asked = serveQuestions()
    renderPage()
    await screen.findByRole('heading', { name: /total payroll/, level: 2 })

    await choose(/gender pay gap/)

    expect(
      await screen.findByRole('heading', { name: /gender pay gap/, level: 2 }),
    ).toBeInTheDocument()
    expect(asked).toEqual(['payroll-by-department', 'gender-pay-gap'])
    expect(screen.getByTestId('where')).toHaveTextContent('/questions?question=gender-pay-gap')
    expect(screen.getByRole('button', { name: /gender pay gap/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('opens the question named in the address', async () => {
    const asked = serveQuestions()
    renderPage('/questions?question=paid-below-band')

    expect(
      await screen.findByRole('heading', { name: /paid below the band/, level: 2 }),
    ).toBeInTheDocument()
    expect(asked).toEqual(['paid-below-band'])
  })

  it('shows a payroll answer as a table of departments', async () => {
    serveQuestions()
    renderPage()

    const table = await screen.findByRole('table', { name: 'Total pay by department' })
    expect(within(table).getByText('6,000.00 USD')).toBeInTheDocument()
    expect(screen.getByText(/Amounts are in US dollars/)).toBeInTheDocument()
  })

  it('shows the gender pay gap with its caveats', async () => {
    serveQuestions()
    renderPage('/questions?question=gender-pay-gap')

    expect(await screen.findByText('Women are paid 4.1% lower than men')).toBeInTheDocument()
    expect(screen.getByText('Small sample')).toBeInTheDocument()
    expect(screen.getByText(/a difference in pay, not its cause/)).toBeInTheDocument()
  })

  it('shows who is paid below their band, with the counts either side', async () => {
    serveQuestions()
    renderPage('/questions?question=paid-below-band')

    expect(await screen.findByText('1 paid below and 0 paid above their band.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Asha Rao' })).toHaveAttribute('href', '/employees/7')
  })

  it('shows who has had no salary change', async () => {
    serveQuestions()
    renderPage('/questions?question=no-raise-24-months')

    expect(await screen.findByText('1 employees.')).toBeInTheDocument()
    expect(screen.getByText('9 years 4 months')).toBeInTheDocument()
  })

  it('lets the reader see exactly how an answer was worked out', async () => {
    serveQuestions()
    renderPage()

    const details = (await screen.findByText('How this was worked out')).closest(
      'details',
    ) as HTMLElement
    expect(details).toHaveTextContent('metric: sum')
    expect(details).toHaveTextContent('group by: department')
  })

  it('says when a question in the address does not exist', async () => {
    serveQuestions()
    renderPage('/questions?question=no-such-question')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the answer. Question not found',
    )
    expect(screen.getByRole('button', { name: /total payroll/ })).toBeInTheDocument()
  })

  it('keeps the list usable when an answer fails, and retries', async () => {
    let calls = 0
    server.use(
      http.get('/api/v1/questions', () => HttpResponse.json({ data: questionList })),
      http.get('/api/v1/questions/:id/answer', ({ params }) => {
        calls += 1
        return calls === 1
          ? HttpResponse.json(errorBody('bad_request', 'Something broke'), { status: 400 })
          : HttpResponse.json({ data: buildAnswer(params.id as string) })
      }),
    )
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load the answer. Something broke')
    expect(screen.getByRole('button', { name: /gender pay gap/ })).toBeInTheDocument()

    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('heading', { name: /total payroll/, level: 2 }),
    ).toBeInTheDocument()
  })

  it('explains when the questions cannot be loaded, and retries', async () => {
    let calls = 0
    server.use(
      http.get('/api/v1/questions', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json(errorBody('bad_request', 'Nope'), { status: 400 })
          : HttpResponse.json({ data: questionList })
      }),
      http.get('/api/v1/questions/:id/answer', ({ params }) =>
        HttpResponse.json({ data: buildAnswer(params.id as string) }),
      ),
    )
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('button', { name: /total payroll/ })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
