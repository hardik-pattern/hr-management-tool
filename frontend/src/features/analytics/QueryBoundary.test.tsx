import { useQuery } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import type { ApiError } from '../../api/ApiError'
import { request } from '../../api/client'
import { errorBody } from '../../test/fixtures'
import { createWrapper } from '../../test/queryWrapper'
import { server } from '../../test/server'
import QueryBoundary from './QueryBoundary'

function Probe() {
  const query = useQuery<{ name: string }, ApiError>({
    queryKey: ['probe'],
    queryFn: async () => (await request<{ data: { name: string } }>('/probe')).data,
  })
  return (
    <QueryBoundary query={query} label="the probe">
      {(data) => <p>Hello {data.name}</p>}
    </QueryBoundary>
  )
}

function renderProbe() {
  const { wrapper: Wrapper } = createWrapper()
  return render(
    <Wrapper>
      <Probe />
    </Wrapper>,
  )
}

describe('QueryBoundary', () => {
  it('shows what is loading, then the data', async () => {
    server.use(http.get('/api/v1/probe', () => HttpResponse.json({ data: { name: 'there' } })))
    renderProbe()

    expect(screen.getByRole('status')).toHaveTextContent('Loading the probe')
    expect(await screen.findByText('Hello there')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('explains a failure and lets the user retry, then shows the data', async () => {
    let calls = 0
    server.use(
      http.get('/api/v1/probe', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json(errorBody('bad_request', 'It broke'), { status: 400 })
          : HttpResponse.json({ data: { name: 'again' } })
      }),
    )
    renderProbe()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load the probe. It broke')

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Hello again')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('names a network failure plainly', async () => {
    server.use(http.get('/api/v1/probe', () => HttpResponse.error()))
    renderProbe()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server')
  })
})
