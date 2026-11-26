// Whole-repo lint. The extension's files are classic scripts that share one global scope per frame (manifest order), so cross-file
// globals are expected: no-undef is off and unused top-level bindings are allowed.
const shared = {
  // A hand-picked core set (the recommended preset lives in a separate package, kept out to stay at one dev dependency).
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-unreachable': 'error',
  'no-fallthrough': 'error',
  'no-case-declarations': 'error',
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-redeclare': 'error',
  'no-self-assign': 'error',
  'no-unsafe-finally': 'error',
  'no-cond-assign': 'error',
  'no-constant-condition': 'error',
  'no-prototype-builtins': 'error',
  'no-useless-escape': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  'no-undef': 'off',
  'no-unused-vars': ['error', { vars: 'local', args: 'none', caughtErrors: 'none' }],
  eqeqeq: ['error', 'always'],
  'no-var': 'error',
  'prefer-const': 'error',
};

export default [
  { ignores: ['out/**', 'node_modules/**', '.claude/**'] },
  { files: ['Common/**/*.js', 'Chrome/**/*.js', 'Firefox/**/*.js'], languageOptions: { sourceType: 'script', ecmaVersion: 2022 }, rules: shared },
  { files: ['tests/**/*.mjs', 'eslint.config.mjs'], languageOptions: { sourceType: 'module', ecmaVersion: 2024 }, rules: shared },
];
