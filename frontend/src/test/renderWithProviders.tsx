import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { type InitialEntry, MemoryRouter } from 'react-router-dom'
import { createWrapper } from './queryWrapper'

/** Renders with a fresh query cache and a router starting at +route+. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/' }: { route?: InitialEntry } = {},
) {
  const { wrapper: QueryWrapper, queryClient } = createWrapper()
  const result = render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryWrapper>,
  )
  return { ...result, queryClient }
}
