import { test } from 'node:test'
import { writtenByEdits } from '../src/lib/edits.ts'
import { noTypeof, typeofChecks } from '../src/rules/no-typeof.ts'
import { eq } from './helpers.ts'

const values = (text: string, ext = '.ts') => typeofChecks(text, ext).map((t) => t.text)
const edited = (before: string, old_string: string, new_string: string, extra = {}) =>
  writtenByEdits(before, [{ old_string, new_string, ...extra }], '.ts', typeofChecks)

test('no-typeof', () => {
  eq(values('if (typeof x === "string") {}'), ['typeof x === "string"'], 'comparison')
  eq(values('const t = typeof x'), ['t = typeof x'], 'initializer')
  eq(values('f(typeof x)'), ['f(typeof x)'], 'argument')
  eq(values('switch (typeof x) {}'), ['switch (typeof x) {}'], 'switch')
  eq(values('const a = <p>{typeof x}</p>', '.tsx'), ['{typeof x}'], 'jsx expression')
  eq(values('type T = typeof x'), [], 'type query')
  eq(values('let a: typeof x'), [], 'annotation')
  eq(values('type K = keyof typeof o'), [], 'keyof typeof')
  eq(values('type R = ReturnType<typeof f>'), [], 'type argument')
  eq(values('const a = x as typeof y'), [], 'assertion type')
  eq(values('const s = "typeof x"'), [], 'string literal')
  eq(values('const a = <p>typeof here</p>', '.tsx'), [], 'jsx text')

  eq(edited('const t = typeof x\nconst b = 1', 'const b = 1', 'const b = 2'), [], 'existing outside edit')
  eq(edited('const t = typeof x', 'const t = typeof x', 'const t = typeof x\nconst b = 1'), ['t = typeof x'], 'existing kept inside edit')
  eq(edited('const t = 1', '1', 'typeof x'), ['t = typeof x'], 'new value')
  eq(edited('let a: string', 'string', 'typeof x'), [], 'new type')
  eq(edited('f(x)\ng(x)', 'x', 'typeof y', { replace_all: true }), ['f(typeof y)', 'g(typeof y)'], 'replace_all')
  eq(edited('a', 'z', 'typeof x'), [], 'old_string missing')
  eq(
    noTypeof.transform({ tool_name: 'Write', tool_input: { file_path: '/x/a.test.ts', content: 'f(typeof x)' } }),
    null,
    'test file exempt',
  )
  eq(
    writtenByEdits(
      'a\nb',
      [
        { old_string: 'a', new_string: 'x' },
        { old_string: 'b', new_string: 'f(typeof o)' },
      ],
      '.ts',
      typeofChecks,
    ),
    ['f(typeof o)'],
    'multiedit',
  )
})
