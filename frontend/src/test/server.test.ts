import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from './server'

describe('mock API server', () => {
  it('serves the handlers a test registers', async () => {
    server.use(http.get('http://localhost/api/v1/ping', () => HttpResponse.json({ ok: true })))

    const response = await fetch('http://localhost/api/v1/ping')

    expect(await response.json()).toEqual({ ok: true })
  })

  it('fails requests that no test handled, so missing mocks are never silent', async () => {
    await expect(fetch('http://localhost/api/v1/unmocked')).rejects.toThrow()
  })
})
