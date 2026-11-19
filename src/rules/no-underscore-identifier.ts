import { detector } from '../lib/detector.ts'
import { CODE_EXTS } from '../lib/edits.ts'
import type { Found } from '../lib/types.ts'
import { parse, ts, type TS } from '../lib/typescript.ts'

const MAYBE_UNDERSCORE = /_|\\u/

export function underscoreIdentifiers(text: string, ext: string): Found[] {
  const sf = parse(text, ext)
  const found: Found[] = []
  const visit = (node: TS.Node) => {
    if (ts.isIdentifier(node) && node.text.startsWith('_') && node.text !== '_') {
      found.push({ start: node.getStart(sf), end: node.end, text: node.text })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

export const noUnderscoreIdentifier = detector({
  name: 'no-underscore-identifier',
  exts: CODE_EXTS,
  skipTestFiles: false,
  mightMatch: (s) => MAYBE_UNDERSCORE.test(s),
  find: underscoreIdentifiers,
  reason: (file) =>
    `Blocked: writes identifiers beginning with \`_\` in ${file}. ` +
    'this isn\'t 2016 javascript. if you need to discard a variable, name it "_" directly, otherwise just fucking figure out a better way. this is a CODE SMELL\n',
})
