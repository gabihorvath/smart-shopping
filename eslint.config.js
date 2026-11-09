import js from '@eslint/js'
import ts from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

export default ts.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/recommended'],
  { files: ['**/*.vue'], languageOptions: { parserOptions: { parser: ts.parser } } },
  // vue-tsc already checks undefined identifiers (and knows the DOM globals)
  { rules: { 'no-undef': 'off' } },
  prettier,
)
