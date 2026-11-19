import { test } from 'node:test'
import { writtenByEdits } from '../src/lib/edits.ts'
import { inExpressions, noInOperator } from '../src/rules/no-in-operator.ts'
import { eq } from './helpers.ts'

const added = (before: string, after: string, ext = '.ts') =>
  before === ''
    ? inExpressions(after, ext).map((e) => e.text)
    : writtenByEdits(before, [{ old_string: before, new_string: after }], ext, inExpressions)
const edited = (before: string, old_string: string, new_string: string, extra = {}) =>
  writtenByEdits(before, [{ old_string, new_string, ...extra }], '.ts', inExpressions)

test('no-in-operator', () => {
  eq(added('', 'if ("a" in o) {}'), ['"a" in o'], 'string key')
  eq(added('', 'const has = key in o'), ['key in o'], 'variable key')
  eq(added('', 'class C { #x = 1; static is(o: object) { return #x in o } }'), ['#x in o'], 'private brand check')
  eq(added('', 'const f = (o: A | B) => ("kind" in o ? 1 : 2)'), ['"kind" in o'], 'ternary')
  eq(added('', 'for (const k in o) {}'), [], 'for-in loop')
  eq(added('', 'for (const k of o) {}'), [], 'for-of loop')
  eq(added('', 'type M<T> = { [K in keyof T]: T[K] }'), [], 'mapped type')
  eq(added('', 'interface I<in T> { f(x: T): void }'), [], 'variance modifier')
  eq(added('', 'const s = "a in b"'), [], 'string literal')
  eq(added('', 'const index = 1; const inside = 2'), [], 'identifiers')
  eq(added('', 'const a = <div>{"a" in o ? 1 : 2}</div>', '.tsx'), ['"a" in o'], 'tsx expression')
  eq(added('', 'const a = <p>sign in here</p>', '.tsx'), [], 'tsx text')

  eq(edited('if ("a" in o) {}', '{}', '{ f() }'), [], 'existing check outside edit')
  eq(edited('if ("a" in o) {}', 'if ("a" in o) {}', 'if ("a" in o) { f() }'), ['"a" in o'], 'existing check inside edit')
  eq(
    edited(
      'f(\n  "network" in data ? data.network : undefined,\n)',
      'f(\n  "network" in data ? data.network : undefined,\n)',
      'const n = {\n  network: "network" in data ? data.network : undefined,\n}',
    ),
    ['"network" in data'],
    'check moved by edit',
  )
  eq(edited('if ("a" in o) {}', 'o)', 'p)'), ['"a" in p'], 'edit overlaps check')
  eq(edited('if (x) {}', 'x', '"a" in o', { replace_all: true }), ['"a" in o'], 'replace_all')
  eq(edited('a', 'z', '"a" in o'), [], 'old_string missing')
  eq(
    noInOperator.transform({ tool_name: 'Write', tool_input: { file_path: '/x/a.test.ts', content: 'if ("a" in o) {}' } }),
    null,
    'test file exempt',
  )
  eq(
    writtenByEdits(
      'a\nb',
      [
        { old_string: 'a', new_string: 'x' },
        { old_string: 'b', new_string: '"k" in o' },
      ],
      '.ts',
      inExpressions,
    ),
    ['"k" in o'],
    'multiedit',
  )
})
