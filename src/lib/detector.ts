import { basename } from 'node:path'
import { editsOf, editTarget, insertedTexts, loadTsFor, readExisting, TEST_FILE, writtenByEdits } from './edits.ts'
import type { Found, Rule } from './types.ts'

export type DetectorSpec<Name extends string> = {
  name: Name
  exts: Set<string>
  skipTestFiles: boolean
  mightMatch: (inserted: string) => boolean
  find: (text: string, ext: string) => Found[]
  reason: (file: string) => string
}

export const detector = <Name extends string>(spec: DetectorSpec<Name>): Rule & { name: Name } => ({
  name: spec.name,
  transform(data) {
    const target = editTarget(data, spec.exts)
    if (!target) return null
    if (spec.skipTestFiles && TEST_FILE.test(target.path)) return null
    if (!insertedTexts(target).some(spec.mightMatch)) return null
    if (!loadTsFor(data, target)) return null

    const added =
      target.tool === 'Write'
        ? spec.find(target.input.content ?? '', target.ext).map((f) => f.text)
        : writtenByEdits(readExisting(target.path), editsOf(target.input), target.ext, spec.find)
    if (added.length === 0) return null
    return {
      kind: 'deny',
      reason: spec.reason(basename(target.path)) + [...new Set(added)].map((a) => `  ${a}`).join('\n'),
    }
  },
})
