/** "4.1% lower", "2.0% higher", "no difference", or why there is no figure. */
export function describeGap(percent: number | null): string {
  if (percent === null) return 'not enough data to compare'
  const size = Math.abs(percent).toFixed(1)
  if (Number(size) === 0) return 'no difference'
  return percent < 0 ? `${size}% lower` : `${size}% higher`
}

/** The headline sentence for a gap, grammatical in every case, including when there is no figure. */
export function headlineGap(percent: number | null): string {
  if (percent === null) return 'Not enough data to compare'
  if (Number(Math.abs(percent).toFixed(1)) === 0) return 'No pay difference between women and men'
  return `Women are paid ${describeGap(percent)} than men`
}
