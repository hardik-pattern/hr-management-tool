import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import SearchBox from './SearchBox'

/** Stands in for the page: applies the search into +value+ like the URL does. */
function Harness({ onSearch = () => {} }: { onSearch?: (text: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <>
      <SearchBox
        value={value}
        onSearch={(text) => {
          onSearch(text)
          setValue(text)
        }}
      />
      <button onClick={() => setValue('')}>Reset from outside</button>
    </>
  )
}

describe('SearchBox', () => {
  it('searches once, after typing pauses, with the text trimmed', async () => {
    const onSearch = vi.fn()
    render(<Harness onSearch={onSearch} />)

    await userEvent.type(screen.getByLabelText('Search'), '  asha ')

    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1))
    expect(onSearch).toHaveBeenCalledWith('asha')
  })

  it('does not trim a trailing space while the person is still typing', async () => {
    render(<Harness />)
    const input = screen.getByLabelText('Search')

    await userEvent.type(input, 'asha ')
    await waitFor(() => expect(input).toHaveValue('asha '))
    await new Promise((resolve) => setTimeout(resolve, 450)) // let the search apply
    await userEvent.type(input, 'rao')

    expect(input).toHaveValue('asha rao')
  })

  it('follows a change made from outside, such as clearing the filters', async () => {
    render(<Harness />)
    const input = screen.getByLabelText('Search')
    await userEvent.type(input, 'asha')
    await waitFor(() => expect(input).toHaveValue('asha'))
    await new Promise((resolve) => setTimeout(resolve, 450))

    await userEvent.click(screen.getByRole('button', { name: 'Reset from outside' }))

    expect(input).toHaveValue('')
  })

  it('does not search again when the text is already what is applied', async () => {
    const onSearch = vi.fn()
    render(<Harness onSearch={onSearch} />)
    const input = screen.getByLabelText('Search')

    await userEvent.type(input, 'a')
    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1))
    await userEvent.type(input, ' ') // only trailing space: same search
    await new Promise((resolve) => setTimeout(resolve, 450))

    expect(onSearch).toHaveBeenCalledTimes(1)
  })
})
