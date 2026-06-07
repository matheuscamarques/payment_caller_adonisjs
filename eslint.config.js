import { configApp } from '@adonisjs/eslint-config'

export default [
  ...configApp(),
  {
    rules: {
      '@unicorn/filename-case': 'off',
      '@unicorn/no-await-expression-member': 'off',
    },
  },
]
