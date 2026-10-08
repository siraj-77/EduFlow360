import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Reads one exported `as const` array out of a TypeScript declaration file.
 *
 * ## Why this exists as a module rather than a helper inside `seed.mjs`
 *
 * Because `seed-source.spec.ts` needs to assert that what the seed resolves **equals** what
 * the application modules export — and a spec that carried its own copy of this reader would
 * be testing the copy. Sharing one implementation means the spec exercises the exact code
 * path the seed runs.
 *
 * ## Why it transpiles rather than importing
 *
 * There is no TypeScript loader at runtime and adding one to a seed script is a larger change
 * than the problem deserves. `typescript` is already in the workspace, so the real compiler
 * does the work it exists for.
 *
 * The first attempt extracted the array literal and evaluated it with `new Function`. **That
 * does not work**, and the reason is worth keeping: an `as const satisfies readonly X[]`
 * literal contains TypeScript syntax — `as const`, `as readonly PermissionKey[]` — so plain
 * JavaScript evaluation fails with `SyntaxError: Unexpected token ')'`. A regex that stripped
 * the type annotations would be a second parser to keep correct forever.
 *
 * `typescript` is a **devDependency**, which is correct here: this runs in development and CI
 * seeding, never in a production process.
 */

const require = createRequire(import.meta.url);
const ts = require('typescript');

const DECLARATION_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'modules',
  'rbac',
  'domain',
);

/**
 * Resolve `exportName` from `fileName`, which is read from the RBAC domain directory.
 *
 * Throws a message naming the file and the symbol when the declaration cannot be found, so a
 * refactor fails as a shape error rather than seeding `undefined`.
 */
export function readConstArray(fileName, exportName) {
  const source = readFileSync(join(DECLARATION_DIRECTORY, fileName), 'utf8');

  const declaration = new RegExp(
    `export const ${exportName}(?::[^=]+)? = (?:Object\\.freeze\\()?\\[`,
  ).exec(source);

  if (declaration === null) {
    throw new Error(
      `readConstArray: could not find 'export const ${exportName}' in ${fileName}. ` +
        "The declaration's shape changed — see this file's header.",
    );
  }

  const start = declaration.index + declaration[0].length;
  let depth = 1;
  let inString = null;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (inString !== null) {
      if (char === inString && source[index - 1] !== '\\') inString = null;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      inString = char;
      continue;
    }

    if (char === '[' || char === '{') depth += 1;

    if (char === ']' || char === '}') {
      depth -= 1;
      if (depth !== 0) continue;

      // Wrapped in `[...]`, NOT `(...)`. The brace match yields the array's *contents*, so a
      // parenthesised wrap makes it a comma expression — and with the trailing comma every
      // entry carries, `(a, b,)` is `SyntaxError: Unexpected token ')'`.
      const transpiled = ts.transpileModule(
        `export const VALUE = [${source.slice(start, index)}];`,
        {
          compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
          },
        },
      ).outputText;

      const module = { exports: {} };
      new Function('module', 'exports', transpiled)(module, module.exports);

      return module.exports.VALUE;
    }
  }

  throw new Error(`readConstArray: '${exportName}' in ${fileName} is not bracket-balanced.`);
}
