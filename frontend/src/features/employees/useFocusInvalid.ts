import { type RefObject, useEffect } from 'react'

/**
 * Moves keyboard focus to the first field marked invalid inside +container+
 * whenever +signal+ changes. After a failed save, a keyboard or screen-reader
 * user would otherwise have to hunt for what went wrong. The signal is a
 * value that changes with each attempt, so focus is not stolen on every render.
 */
export function useFocusInvalid(container: RefObject<HTMLElement | null>, signal: unknown) {
  useEffect(() => {
    container.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [container, signal])
}
