import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** One-off messages a page hands to the next one through navigation state. */
export interface Flash {
  notice?: string
  /** Offers to undo a delete, with a button on the list. */
  undo?: { id: number; name: string }
}

const FLASH_KEYS = ['notice', 'undo']

/**
 * Reads the message the previous page left ("Employee created."), keeps it
 * for this page, and removes it from the history entry so a reload does not
 * show it again. Other navigation state (such as where Back should go) stays.
 */
export function useFlash(): [Flash, (flash: Flash) => void] {
  const location = useLocation()
  const navigate = useNavigate()
  const [flash, setFlash] = useState<Flash>(() => {
    const state = (location.state ?? {}) as Flash
    return { notice: state.notice, undo: state.undo }
  })

  // Removes the message from the history entry. Once it is gone the effect
  // finds nothing to do, so it is safe for it to depend on the whole location.
  useEffect(() => {
    const state = location.state as Record<string, unknown> | null
    if (!state || !FLASH_KEYS.some((key) => key in state)) return

    const remaining = Object.fromEntries(
      Object.entries(state).filter(([key]) => !FLASH_KEYS.includes(key)),
    )
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: Object.keys(remaining).length > 0 ? remaining : null },
    )
  }, [location.pathname, location.search, location.state, navigate])

  return [flash, setFlash]
}
