import { detector } from '../lib/detector.ts'
import { CODE_EXTS } from '../lib/edits.ts'
import type { Found } from '../lib/types.ts'
import { normalize, parse, ts, type TS } from '../lib/typescript.ts'

export function inExpressions(text: string, ext: string): Found[] {
  const sf = parse(text, ext)
  const found: Found[] = []
  const visit = (node: TS.Node) => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InKeyword) {
      found.push({ start: node.getStart(sf), end: node.end, text: normalize(node.getText(sf)) })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

export const noInOperator = detector({
  name: 'no-in-operator',
  exts: CODE_EXTS,
  skipTestFiles: true,
  mightMatch: (s) => /\bin\b/.test(s),
  find: inExpressions,
  reason: (file) =>
    `Blocked: adds \`in\` property checks to ${file}. ` +
    'Do not check for properties with the `in` operator; use a discriminant field or parse the value with a schema. `for (k in obj)` loops are allowed.\n',
})
