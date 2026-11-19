import { detector } from '../lib/detector.ts'
import { CODE_EXTS } from '../lib/edits.ts'
import type { Found } from '../lib/types.ts'
import { normalize, parse, ts, type TS } from '../lib/typescript.ts'

type NamedParent = TS.Node & { name?: TS.Node; propertyName?: TS.Node; label?: TS.Node }

function isNamePosition(node: TS.Identifier): boolean {
  const p: NamedParent = node.parent
  if (ts.isShorthandPropertyAssignment(p)) return false
  if (p.name === node || p.propertyName === node || p.label === node) return true
  if (ts.isQualifiedName(p) || ts.isTypeQueryNode(p)) return true
  return false
}

export function undefinedValues(text: string, ext: string): Found[] {
  const sf = parse(text, ext)
  const found: Found[] = []
  const visit = (node: TS.Node) => {
    if (ts.isIdentifier(node) && node.text === 'undefined' && !isNamePosition(node)) {
      found.push({ start: node.getStart(sf), end: node.end, text: normalize(node.parent.getText(sf)) })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

export const noUndefinedValue = detector({
  name: 'no-undefined-value',
  exts: CODE_EXTS,
  skipTestFiles: true,
  mightMatch: (s) => s.includes('undefined'),
  find: undefinedValues,
  reason: (file) =>
    `Blocked: uses \`undefined\` as a runtime value in ${file}. ` +
    '`undefined` is allowed only in type positions. Omit the value, use an optional property or parameter, or narrow with a discriminant or a schema.\n',
})
