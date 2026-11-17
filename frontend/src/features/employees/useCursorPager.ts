import { useState } from 'react'

/**
 * Keeps the trail of cursors visited so far. The API's keyset pagination only
 * moves forward ("next_cursor"), so going back means remembering where each
 * earlier page started.
 *
 * +resetKey+ identifies the view (sort, page size, filters). When it changes,
 * the trail is discarded and paging starts again from the first page, with no
 * effect needed to clear it.
 */
export function useCursorPager(resetKey: string) {
  const [state, setState] = useState<{ key: string; cursors: string[] }>({
    key: resetKey,
    cursors: [],
  })
  const cursors = state.key === resetKey ? state.cursors : []

  return {
    /** Cursor for the current page; undefined on the first page. */
    cursor: cursors.at(-1),
    /** Zero-based page number. */
    pageIndex: cursors.length,
    goNext: (nextCursor: string) => setState({ key: resetKey, cursors: [...cursors, nextCursor] }),
    goPrevious: () => setState({ key: resetKey, cursors: cursors.slice(0, -1) }),
  }
}
