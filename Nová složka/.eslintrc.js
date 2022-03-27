module.exports = {
  env: {
    node: true,
    es6: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'script',
  },
  rules: {
    'object-curly-newline': 0,
    quotes: ['error', 'single', { allowTemplateLiterals: true }],
    'object-shorthand': ['error', 'always'],
    'newline-per-chained-call': 0,
    // "no-lonely-if": 0,
    // 'prefer-destructuring': ['error', { object: true, array: false }],
    'no-empty': ['error', { allowEmptyCatch: true }],
    // "no-console": 0,
    'max-len': 0,
    'func-names': 0,
    // "key-spacing": 0,
    'no-param-reassign': 0,
    // "no-prototype-builtins": 0,
    // "prefer-arrow-callback": 0,
    'new-cap': [2, {
      newIsCap: true,
      capIsNewExceptions: ['Match.OneOf', 'Match.Optional', 'Match.Where', 'Match.Maybe', 'HTML.Raw', 'CryptoJS.MD5', 'AlgoliaSearch', 'Clearbit', 'DateTimeFormat', 'Stripe'],
    }],
    // "no-nested-ternary": 0,
    'no-eval': 0,
    'arrow-parens': ['error', 'as-needed'],
    'no-mixed-operators': 0,
    'no-bitwise': 0,
    'no-plusplus': 0,
    'no-else-return': 0,
    'no-underscore-dangle': 0,
    'operator-linebreak': ['error', 'after'],
  },
  globals: {
  },
};
