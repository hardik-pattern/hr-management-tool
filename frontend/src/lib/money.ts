export type ParsedAmount = { ok: true; cents: number | undefined } | { ok: false }

/**
 * Turns what a person typed ("50000", "50000.5") into minor units (cents),
 * rounding half up to the currency's precision. The API only deals in minor
 * units, but people think in whole units.
 *
 * Done on the digits, not with floating point, so 1.005 does not become 100.
 * An empty field is valid and means "no value" (cents undefined).
 */
export function parseAmount(text: string, exponent: number): ParsedAmount {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: true, cents: undefined }

  const match = /^(\d+)(?:\.(\d*))?$/.exec(trimmed)
  if (!match) return { ok: false }

  const [, whole, fraction = ''] = match
  const kept = fraction.slice(0, exponent).padEnd(exponent, '0')
  const roundUp = fraction.length > exponent && fraction[exponent] >= '5'
  const cents = Number(whole + kept) + (roundUp ? 1 : 0)

  return Number.isSafeInteger(cents) ? { ok: true, cents } : { ok: false }
}

/** Minor units back to what a person would type: 5000050 -> "50000.5". */
export function formatAmount(cents: number, exponent: number): string {
  if (exponent === 0) return String(cents)

  const digits = String(cents).padStart(exponent + 1, '0')
  const whole = digits.slice(0, -exponent)
  const fraction = digits.slice(-exponent).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}
