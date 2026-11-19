import { noInOperator } from './no-in-operator.ts'
import { noNewComments } from './no-new-comments.ts'
import { noOptionalNullParam } from './no-optional-null-param.ts'
import { noTypeof } from './no-typeof.ts'
import { noUndefinedValue } from './no-undefined-value.ts'
import { noUnderscoreIdentifier } from './no-underscore-identifier.ts'
import { optionalParams } from './optional-params.ts'

export const RULES = [
  noInOperator,
  noUndefinedValue,
  noUnderscoreIdentifier,
  noTypeof,
  noNewComments,
  optionalParams,
  noOptionalNullParam,
] as const

export type RuleName = (typeof RULES)[number]['name']
