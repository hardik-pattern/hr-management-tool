import axe from 'axe-core'
import { expect } from 'vitest'

/**
 * Fails the test if axe finds accessibility violations in +container+, and
 * names each one. Colour contrast is skipped: it needs real layout and
 * rendering, which jsdom does not have.
 */
export async function expectAccessible(container: Element = document.body) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
  const report = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes.map((node) => `    ${node.html}`).join('\n'),
  )
  expect(report, report.join('\n')).toEqual([])
}
