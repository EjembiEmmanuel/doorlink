/**
 * The house style, written down so that running a global `prettier` on a
 * file cannot silently convert it to double quotes and semicolons.
 *
 * The tree is not fully normalised to this yet — it was hand-formatted
 * before this config existed, and reformatting ~56 files in one pass
 * would bury real changes under whitespace. Files are brought into line
 * as they are edited. `npx prettier --check "src/**\/*.{ts,tsx}"` shows
 * what is left.
 */
module.exports = {
  semi: false,
  singleQuote: true,
  printWidth: 112,
  trailingComma: 'es5',
  arrowParens: 'always',
}
