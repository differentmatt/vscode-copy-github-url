import globals from 'globals'

export default [{
  languageOptions: {
    globals: {
      ...Object.fromEntries(Object.entries(globals.browser).map(([key]) => [key, 'off'])),
      ...globals.commonjs,
      ...globals.node,
      ...globals.mocha
    },

    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-const-assign': 'warn',
    'no-this-before-super': 'warn',
    'no-undef': 'warn',
    'no-unreachable': 'warn',
    'no-unused-vars': 'warn',
    'constructor-super': 'warn',
    'valid-typeof': 'warn'
  },
  files: ['src/**/*.js', 'src/**/*.ts', 'test/**/*.js', 'test/**/*.ts'],
  ignores: [
    'node_modules/**',
    '.vscode-test/**',
    '*.vsix',
    '.vscode/**',
    'yarn.lock',
    'dist/**',
    'fallbacks/**'
  ]
}]
