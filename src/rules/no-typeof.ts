import { detector } from '../lib/detector.ts'
import { CODE_EXTS } from '../lib/edits.ts'
import type { Found } from '../lib/types.ts'
import { normalize, parse, ts, type TS } from '../lib/typescript.ts'

export function typeofChecks(text: string, ext: string): Found[] {
  const sf = parse(text, ext)
  const found: Found[] = []
  const visit = (node: TS.Node) => {
    if (ts.isTypeOfExpression(node)) {
      found.push({ start: node.getStart(sf), end: node.end, text: normalize(node.parent.getText(sf)) })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

export const noTypeof = detector({
  name: 'no-typeof',
  exts: CODE_EXTS,
  skipTestFiles: true,
  mightMatch: (s) => /\btypeof\b/.test(s),
  find: typeofChecks,
  reason: (file) =>
    `Blocked: adds runtime \`typeof\` checks to ${file}. ` +
    '`typeof` is allowed only in type positions (`type T = typeof x`). Fix the static type, narrow on a literal discriminant field, or parse unknown input with a zod schema.\n',
})
