import { defineConfig } from './src/config.ts'

export default defineConfig({
  rules: {
    'no-in-operator': true,
    'no-undefined-value': true,
    'no-underscore-identifier': true,
    'no-typeof': true,
    'no-new-comments': true,
    'optional-params': true,
    'no-optional-null-param': true,
  },
})
