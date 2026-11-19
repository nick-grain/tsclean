import { test } from 'node:test'
import { writtenByEdits } from '../src/lib/edits.ts'
import { noUndefinedValue, undefinedValues } from '../src/rules/no-undefined-value.ts'
import { eq } from './helpers.ts'

const values = (text: string, ext = '.ts') => undefinedValues(text, ext).map((u) => u.text)
const edited = (before: string, old_string: string, new_string: string, extra = {}) =>
  writtenByEdits(before, [{ old_string, new_string, ...extra }], '.ts', undefinedValues)

test('no-undefined-value', () => {
  eq(values('if (x === undefined) {}'), ['x === undefined'], 'comparison')
  eq(values('function f() { return undefined }'), ['return undefined'], 'return')
  eq(values('const a = undefined'), ['a = undefined'], 'initializer')
  eq(values('f(undefined)'), ['f(undefined)'], 'argument')
  eq(values('const o = { a: undefined }'), ['a: undefined'], 'property value')
  eq(values('const o = { undefined }'), ['undefined'], 'shorthand property')
  eq(values('const a = x ?? undefined'), ['x ?? undefined'], 'nullish fallback')
  eq(values('const a = <C p={undefined} />', '.tsx'), ['{undefined}'], 'jsx attribute')
  eq(values('let a: undefined'), [], 'annotation')
  eq(values('let a: string | undefined'), [], 'union type')
  eq(values('function f(): undefined {}'), [], 'return type')
  eq(values('const a = x as string | undefined'), [], 'assertion type')
  eq(values('type T = Map<string, undefined>'), [], 'type argument')
  eq(values('function g(x: unknown): x is undefined { return true }'), [], 'type predicate')
  eq(values('type T = typeof undefined'), [], 'type query')
  eq(values('const o = { undefined: 1 }'), [], 'property key')
  eq(values('o.undefined'), [], 'member name')
  eq(values('const s = "undefined"'), [], 'string literal')
  eq(values('if (typeof x === "undefined") {}'), [], 'typeof string')

  eq(edited('const a = undefined\nconst b = 1', 'const b = 1', 'const b = 2'), [], 'existing outside edit')
  eq(edited('const a = undefined', 'const a = undefined', 'const a = undefined\nconst b = 1'), ['a = undefined'], 'existing kept inside edit')
  eq(edited('const a = 1', 'const a = 1', 'const a = undefined'), ['a = undefined'], 'new value')
  eq(edited('let a: string', 'string', 'string | undefined'), [], 'new type')
  eq(edited('f(x)\ng(x)', 'x', 'undefined', { replace_all: true }), ['f(undefined)', 'g(undefined)'], 'replace_all')
  eq(edited('a', 'z', 'undefined'), [], 'old_string missing')
  eq(
    noUndefinedValue.transform({ tool_name: 'Write', tool_input: { file_path: '/x/a.test.ts', content: 'f(undefined)' } }),
    null,
    'test file exempt',
  )
  eq(
    writtenByEdits(
      'a\nb',
      [
        { old_string: 'a', new_string: 'x' },
        { old_string: 'b', new_string: 'f(undefined)' },
      ],
      '.ts',
      undefinedValues,
    ),
    ['f(undefined)'],
    'multiedit',
  )
})
