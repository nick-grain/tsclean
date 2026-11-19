import { test } from 'node:test'
import { applyEdit } from '../src/lib/edits.ts'
import { rewriteAll } from '../src/rules/optional-params.ts'
import { eq } from './helpers.ts'

const write = (content: string, ext = '.ts', existing = '') => {
  const r = rewriteAll('', [{ old_string: '', new_string: content }], ext, existing)
  return r.offenders.length ? { denied: r.offenders } : r.edits[0].new_string
}
const edit = (before: string, old_string: string, new_string: string, extra = {}) => {
  const r = rewriteAll(before, [{ old_string, new_string, ...extra }], '.ts')
  if (r.offenders.length) return { denied: r.offenders }
  const e = r.edits[0]
  return e.old_string === old_string ? e.new_string : [e.old_string, e.new_string]
}
const applyResult = (before: string, old_string: string, new_string: string) => {
  const r = rewriteAll(before, [{ old_string, new_string }], '.ts')
  return applyEdit(before, r.edits[0].old_string ?? '', r.edits[0].new_string ?? '', false)?.after
}

test('optional-params: write', () => {
  eq(write('function f(a: string | undefined) {}'), 'function f(a?: string) {}', 'required union')
  eq(write('function f(a?: string | undefined) {}'), 'function f(a?: string) {}', 'optional union')
  eq(write('function f(a: undefined | string) {}'), 'function f(a?: string) {}', 'undefined first')
  eq(write('function f(a: string | null | undefined) {}'), 'function f(a?: string | null) {}', 'keeps null')
  eq(write('function f(a: string | undefined | undefined) {}'), 'function f(a?: string) {}', 'double undefined')
  eq(
    write('function f(a: string | undefined, b?: number | undefined) {}'),
    'function f(a?: string, b?: number) {}',
    'trailing optional',
  )
  eq(
    write('function f(a: string | undefined, b: number | undefined) {}'),
    'function f(a?: string, b?: number) {}',
    'chain of rewrites',
  )
  eq(write('function f(a: string | undefined, b: number) {}'), { denied: ['a: string | undefined'] }, 'required follows')
  eq(
    write('function f(a: string | undefined, b: number) {}', '.ts', 'function f(a: string | undefined, b: number) {}'),
    'function f(a: string | undefined, b: number) {}',
    'required follows, preexisting in file',
  )
  eq(
    write('function f(a?: string | undefined, b: number) {}'),
    'function f(a?: string, b: number) {}',
    'already optional before required',
  )
  eq(write('function f(a: string | undefined, ...rest: number[]) {}'), 'function f(a?: string, ...rest: number[]) {}', 'rest follows')
  eq(write('function f(a: string | undefined, b = 1) {}'), 'function f(a?: string, b = 1) {}', 'default follows')
  eq(write('const f = (a: string | undefined) => a'), 'const f = (a?: string) => a', 'arrow')
  eq(write('interface I { m(a: string | undefined): void }'), 'interface I { m(a?: string): void }', 'method signature')
  eq(write('type F = (a: string | undefined) => void'), 'type F = (a?: string) => void', 'function type')
  eq(write('class C { constructor(a: string | undefined) {} }'), 'class C { constructor(a?: string) {} }', 'constructor')
  eq(write('type T = { a: string | undefined }'), 'type T = { a: string | undefined }', 'property untouched')
  eq(write('type T = { [k: string]: string | undefined }'), 'type T = { [k: string]: string | undefined }', 'index signature')
  eq(write('class C { set x(v: string | undefined) {} }'), 'class C { set x(v: string | undefined) {} }', 'setter')
  eq(write('function f({ a }: P | undefined) {}'), 'function f({ a }: P | undefined) {}', 'binding pattern')
  eq(write('function f(a: string | undefined = "x") {}'), 'function f(a: string | undefined = "x") {}', 'initializer')
  eq(write('function f(a: undefined) {}'), 'function f(a: undefined) {}', 'bare undefined')
  eq(write('function f(a: (string | undefined)[]) {}'), 'function f(a: (string | undefined)[]) {}', 'nested union')
  eq(write('function f(a: Map<string, number | undefined>) {}'), 'function f(a: Map<string, number | undefined>) {}', 'generic arg')
  eq(write('function f(cb: () => string | undefined) {}'), 'function f(cb: () => string | undefined) {}', 'return type')
  eq(write('const s = "a: string | undefined"'), 'const s = "a: string | undefined"', 'string literal')
  eq(
    write('function f(\n  a:\n    | string\n    | number\n    | undefined,\n) {}'),
    'function f(\n  a?:\n    | string\n    | number,\n) {}',
    'multiline union',
  )
  eq(write('const f = <T,>(a: T | undefined) => a', '.tsx'), 'const f = <T,>(a?: T) => a', 'tsx generic arrow')
  eq(write('const f = <T>(a: T | undefined) => a', '.tsx'), 'const f = <T>(a?: T) => a', 'tsx bare generic arrow')
  eq(write('const a = <div title={x as string | undefined} />', '.tsx'), 'const a = <div title={x as string | undefined} />', 'tsx assertion')
})

test('optional-params: edit', () => {
  const file = 'function f(\n  a: string,\n  b?: number,\n) {}\n'
  eq(edit(file, 'a: string,', 'a: string | undefined,'), 'a?: string,', 'fragment edit')
  eq(edit(file, 'b?: number,', 'b?: number | undefined,'), 'b?: number,', 'fragment optional')
  eq(edit(file, 'string', 'string | undefined'), ['a: string', 'a?: string'], 'name outside edit widens old_string')
  eq(
    applyResult(file, 'string', 'string | undefined'),
    'function f(\n  a?: string,\n  b?: number,\n) {}\n',
    'name outside edit applies cleanly',
  )
  eq(
    edit('function f(a: string | undefined, b: number) { return 1 }', 'return 1', 'return 2'),
    'return 2',
    'untouched preexisting',
  )
  eq(
    edit(
      'function f(a: string | undefined, b: number) { return 1 }',
      'a: string | undefined, b: number) { return 1',
      'a: string | undefined, b: number) { return 2',
    ),
    'a: string | undefined, b: number) { return 2',
    'preexisting retained in edit',
  )
  eq(
    applyResult('function f(a: string, b: number | undefined) {}', 'a: string', 'a: string | undefined'),
    'function f(a?: string, b?: number) {}',
    'rest of the parameter list is rewritten too',
  )
  eq(
    edit('function f(a: string, b: number) {}', 'a: string', 'a: string | undefined'),
    { denied: ['a: string | undefined'] },
    'new param before required',
  )
  eq(
    edit('function f(x) {}\nfunction g(x) {}', '(x)', '(x: string | undefined)', { replace_all: true }),
    '(x?: string)',
    'replace_all',
  )
  eq(
    edit('function f(x) {}\nfunction g(x, y: number) {}', 'x', 'x: string | undefined', { replace_all: true }),
    { denied: ['x: string | undefined'] },
    'replace_all with an occurrence that cannot be rewritten',
  )
  eq(edit(file, 'const nope', 'const a: string | undefined'), 'const a: string | undefined', 'old_string missing')

  const multi = rewriteAll(
    'function f(a: string) {}\nfunction g(b: string) {}',
    [
      { old_string: 'a: string', new_string: 'a: string | undefined' },
      { old_string: 'b: string', new_string: 'b: string | undefined' },
    ],
    '.ts',
  )
  eq(
    multi.edits.map((e) => e.new_string),
    ['a?: string', 'b?: string'],
    'multiedit',
  )
})
