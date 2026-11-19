import { test } from 'node:test'
import { writtenByEdits } from '../src/lib/edits.ts'
import { noOptionalNullParam, optionalNullParams } from '../src/rules/no-optional-null-param.ts'
import { eq } from './helpers.ts'

const params = (text: string, ext = '.ts') => optionalNullParams(text, ext).map((p) => p.text)
const edited = (before: string, old_string: string, new_string: string, extra = {}) =>
  writtenByEdits(before, [{ old_string, new_string, ...extra }], '.ts', optionalNullParams)

test('no-optional-null-param', () => {
  eq(params('function f(network?: string | null) {}'), ['network?: string | null'], 'optional null')
  eq(params('function f(a?: null | string) {}'), ['a?: null | string'], 'null first')
  eq(params('function f(a: string | null | undefined) {}'), ['a: string | null | undefined'], 'null and undefined')
  eq(params('function f(a: string | null = null) {}'), ['a: string | null = null'], 'default null')
  eq(params('const f = (a?: string | null) => a'), ['a?: string | null'], 'arrow')
  eq(params('interface I { m(a?: string | null): void }'), ['a?: string | null'], 'method signature')
  eq(params('type F = (a?: string | null) => void'), ['a?: string | null'], 'function type')
  eq(params('class C { constructor(private a?: string | null) {} }'), ['private a?: string | null'], 'parameter property')
  eq(params('function f({ a }: { a?: string | null }) {}'), [], 'property, not parameter')
  eq(params('const f = <T,>(a?: T | null) => a', '.tsx'), ['a?: T | null'], 'tsx generic arrow')
  eq(params('function f(a: string | null) {}'), [], 'required nullable')
  eq(params('function f(a?: string) {}'), [], 'optional')
  eq(params('function f(a?: string | undefined) {}'), [], 'optional undefined')
  eq(params('function f(a?: (string | null)[]) {}'), [], 'nested null')
  eq(params('function f(a?: Map<string, number | null>) {}'), [], 'generic arg')
  eq(params('function f(cb?: () => string | null) {}'), [], 'return type')
  eq(params('const s = "a?: string | null"'), [], 'string literal')

  eq(edited('function f(a?: string | null) {}\nconst b = 1', 'const b = 1', 'const b = 2'), [], 'existing outside edit')
  eq(edited('function f(a?: string) {}', 'string', 'string | null'), ['a?: string | null'], 'new type in edit')
  eq(edited('function f(a: string | null) {}', 'a:', 'a?:'), ['a?: string | null'], 'new question token')
  eq(
    edited('function f(x) {}\nfunction g(x) {}', '(x)', '(x?: string | null)', { replace_all: true }),
    ['x?: string | null', 'x?: string | null'],
    'replace_all',
  )
  eq(edited('a', 'z', 'function f(a?: string | null) {}'), [], 'old_string missing')
  eq(
    noOptionalNullParam.transform({
      tool_name: 'Write',
      tool_input: { file_path: '/x/a.test.ts', content: 'function f(a?: string | null) {}' },
    }),
    null,
    'test file exempt',
  )
  eq(
    writtenByEdits(
      'a\nb',
      [
        { old_string: 'a', new_string: 'x' },
        { old_string: 'b', new_string: 'function f(a?: string | null) {}' },
      ],
      '.ts',
      optionalNullParams,
    ),
    ['a?: string | null'],
    'multiedit',
  )
})
