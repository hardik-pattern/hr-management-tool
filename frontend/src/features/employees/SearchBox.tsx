import { useEffect, useRef, useState } from 'react'
import { Form } from 'react-bootstrap'

export const SEARCH_DEBOUNCE_MS = 300

interface Props {
  /** The search currently applied (from the URL). */
  value: string
  onSearch: (text: string) => void
}

/**
 * A search field that waits for a pause in typing before searching, so each
 * keystroke does not become a request. It owns what is typed, and follows
 * +value+ when that changes from outside (for example "Clear filters").
 */
export default function SearchBox({ value, onSearch }: Props) {
  const [text, setText] = useState(value)
  const [seenValue, setSeenValue] = useState(value)
  // Follow an outside change, but not the echo of our own search: that would
  // trim spaces the person is still typing.
  if (value !== seenValue) {
    setSeenValue(value)
    if (value !== text.trim()) setText(value)
  }
  const onSearchRef = useRef(onSearch)
  // Kept in a ref so a new callback each render does not restart the debounce.
  useEffect(() => {
    onSearchRef.current = onSearch
  })

  useEffect(() => {
    if (text.trim() === value) return
    const timer = setTimeout(() => onSearchRef.current(text.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, value])

  return (
    <Form.Group controlId="employee-search">
      <Form.Label>Search</Form.Label>
      <Form.Control
        type="search"
        placeholder="Name, email or number"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </Form.Group>
  )
}
