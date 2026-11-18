import { useEffect } from 'react'

const APP_NAME = 'ACME Salary Manager'

/**
 * Sets the browser tab title. A single-page app never reloads, so without
 * this every page would keep the same title, which is how screen-reader users
 * learn where they are after navigating.
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}
