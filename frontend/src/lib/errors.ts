import { ApiError } from '../api/ApiError'

const humanize = (key: string) => {
  if (key === 'base') return 'This'
  const words = key.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Readable sentences for a failed action, for showing in a dialog or alert:
 * { termination_date: ["cannot be in the future"] } becomes
 * "Termination date cannot be in the future."
 */
export function describeError(error: unknown): string[] {
  if (!(error instanceof ApiError)) return ['Something went wrong. Please try again.']
  if (!error.isValidation) return [error.message]

  const sentences = Object.entries(error.details).flatMap(([key, messages]) =>
    messages.map((message) => `${humanize(key)} ${message}.`),
  )
  return sentences.length > 0 ? sentences : [error.message]
}
