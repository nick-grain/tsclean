import { test } from 'node:test'
import { writtenByEdits } from '../src/lib/edits.ts'
import { noUnderscoreIdentifier, underscoreIdentifiers } from '../src/rules/no-underscore-identifier.ts'
import { eq } from './helpers.ts'

const names = (text: string, ext = '.ts') => underscoreIdentifiers(text, ext).map((u) => u.text)
const edited = (before: string, old_string: string, new_string: string, extra = {}) =>
  writtenByEdits(before, [{ old_string, new_string, ...extra }], '.ts', underscoreIdentifiers)

test('no-underscore-identifier', () => {
  eq(names('const _a = 1'), ['_a'], 'variable')
  eq(names('function f(_x: number) {}'), ['_x'], 'parameter')
  eq(names('const f = (_) => 1'), [], 'single underscore allowed')
  eq(names('const f = (_, __) => 1'), ['__'], 'double underscore name')
  eq(names('const \\u005f = 1'), [], 'escaped single underscore allowed')
  eq(names('const [_a, b] = xs'), ['_a'], 'array destructuring')
  eq(names('const { a: _a } = o'), ['_a'], 'renamed destructuring')
  eq(names('const { _a } = o'), ['_a'], 'shorthand destructuring')
  eq(names('function _f() {}'), ['_f'], 'function name')
  eq(names('class C { _x = 1; private _y() {} }'), ['_x', '_y'], 'class members')
  eq(names('const o = { _k: 1 }'), ['_k'], 'property key')
  eq(names('o._k'), ['_k'], 'member access')
  eq(names('type _T<_U> = { _k: string }'), ['_T', '_U', '_k'], 'type names')
  eq(names('import { _a } from "m"; import * as _b from "n"'), ['_a', '_b'], 'imports')
  eq(names('export { a as _a }'), ['_a'], 'export alias')
  eq(names('for (const _ of xs) {}'), [], 'loop binding single underscore')
  eq(names('for (const _x of xs) {}'), ['_x'], 'loop binding')
  eq(names('try {} catch (_e) {}'), ['_e'], 'catch binding')
  eq(names('_l: for (;;) break _l'), ['_l', '_l'], 'label')
  eq(names('enum _E { _A }'), ['_E', '_A'], 'enum')
  eq(names('const d = __dirname'), ['__dirname'], 'double underscore')
  eq(names('const \\u005fa = 1'), ['_a'], 'unicode escape')
  eq(names('const a = <C _p={1} />', '.tsx'), ['_p'], 'jsx attribute')
  eq(names('const SNAKE_CASE = 1; const a_b = 2'), [], 'inner underscore')
  eq(names('const s = "_a"; const t = `_b`'), [], 'string literal')
  eq(names('const n = 1_000'), [], 'numeric separator')
  eq(names('// _a\n/* _b */\nconst a = 1'), [], 'comment')
  eq(names('/** @param _x */\nfunction f(x) {}'), [], 'jsdoc')
  eq(names('class C { #_x = 1 }'), [], 'private name')
  eq(names('const a = <p>_text</p>', '.tsx'), [], 'jsx text')

  eq(edited('const _a = 1\nconst b = 1', 'const b = 1', 'const b = 2'), [], 'existing outside edit')
  eq(edited('const _a = 1', 'const _a = 1', 'const _a = 2'), ['_a'], 'existing kept inside edit')
  eq(edited('f(a)', 'a', '_a'), ['_a'], 'new name')
  eq(edited('f(x)\ng(x)', 'x', '_x', { replace_all: true }), ['_x', '_x'], 'replace_all')
  eq(edited('a', 'z', '_a'), [], 'old_string missing')
  eq(edited('', '', 'const _a = 1'), ['_a'], 'empty file')
  const testFile = noUnderscoreIdentifier.transform({
    tool_name: 'Write',
    tool_input: { file_path: '/x/a.test.ts', content: 'const _a = 1' },
  })
  eq(testFile?.kind === 'deny' && testFile.reason.includes('_a'), true, 'test files included')
  eq(
    noUnderscoreIdentifier.transform({ tool_name: 'Write', tool_input: { file_path: '/x/a.md', content: 'const _a = 1' } }),
    null,
    'non-code file skipped',
  )
  eq(
    writtenByEdits(
      'a\nb',
      [
        { old_string: 'a', new_string: 'x' },
        { old_string: 'b', new_string: 'const _k = 1' },
      ],
      '.ts',
      underscoreIdentifiers,
    ),
    ['_k'],
    'multiedit',
  )
})
