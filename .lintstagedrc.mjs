export default {
  // eslint-plugin-only-warn in @eleva/eslint-config downgrades errors to
  // warnings; the boundaries rules explicitly re-escalate the ones that
  // must block a commit. So we do not pass --max-warnings here.
  '*.{ts,tsx,js,mjs,cjs}': ['prettier --write', 'eslint --fix'],
  '*.{json,md,yml,yaml,css}': ['prettier --write'],
};
