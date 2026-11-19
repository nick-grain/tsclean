import { detector } from '../lib/detector.ts'
import { TS_EXTS } from '../lib/edits.ts'
import type { Found } from '../lib/types.ts'
import { normalize, parse, ts, type TS } from '../lib/typescript.ts'

const isNullType = (t: TS.TypeNode) => ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword
const isUndefinedType = (t: TS.TypeNode) => t.kind === ts.SyntaxKind.UndefinedKeyword

function isOptionalNullParam(p: TS.ParameterDeclaration): boolean {
  const t = p.type
  if (!t || !ts.isUnionTypeNode(t) || !t.types.some(isNullType)) return false
  return !!p.questionToken || !!p.initializer || t.types.some(isUndefinedType)
}

export function optionalNullParams(text: string, ext: string): Found[] {
  const sf = parse(text, ext)
  const found: Found[] = []
  const visit = (node: TS.Node) => {
    if (ts.isParameter(node) && isOptionalNullParam(node)) {
      found.push({ start: node.getStart(sf), end: node.end, text: normalize(node.getText(sf)) })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

export const noOptionalNullParam = detector({
  name: 'no-optional-null-param',
  exts: TS_EXTS,
  skipTestFiles: true,
  mightMatch: (s) => s.includes('null'),
  find: optionalNullParams,
  reason: (file) =>
    `Blocked: a parameter in ${file} is both optional and nullable. ` +
    'Pick one empty state: `x?: T` when the caller simply omits it, or `x: T | null` when the caller must say "none" explicitly. ' +
    'If both really are required (e.g. matching an external signature), do not work around this hook: stop and ask the user to add it themselves.\n',
})
