// .prettierrc.js

module.exports = {
  semi: true,
  trailingComma: 'all',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  tailwindFunctions: ['cva', 'clsx'],
  jsxSingleQuote: false,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: [
    '@trivago/prettier-plugin-sort-imports',
    'prettier-plugin-tailwindcss', // MUST come last
  ],
  importOrder: ['^@core/(.*)$', '^@server/(.*)$', '^@ui/(.*)$', '^[./]'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderGroupNamespaceSpecifiers: true,
  importOrderCaseInsensitive: true,
};
