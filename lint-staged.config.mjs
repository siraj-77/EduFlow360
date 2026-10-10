/**
 * lint-staged (OPS-106).
 *
 * Prettier checks every staged file. ESLint runs per package, because
 * each package owns its own `eslint.config.mjs` and there is no root
 * config — ESLint invoked from the repository root fails with
 * "couldn't find an eslint.config.(js|mjs|cjs) file". Staged files
 * are therefore grouped by their package and linted by that package's
 * own ESLint, with the package as the working directory and the paths
 * relative to it.
 *
 * `--max-warnings=0` is stricter than `pnpm lint` (which is
 * `eslint .`): a warning may not enter the history, because the
 * repository's lint gate treats warnings as noise to fix, not to
 * accumulate.
 */
import { existsSync } from 'node:fs';

export default {
  '*.{ts,tsx,js,mjs,cjs,json}': ['prettier --check'],
  '*.{ts,tsx}': (files) => {
    const byPackage = new Map();
    for (const file of files) {
      const pkg = file.split('/').slice(0, 2).join('/');
      if (!existsSync(`${pkg}/package.json`)) continue;
      if (!byPackage.has(pkg)) byPackage.set(pkg, []);
      byPackage.get(pkg).push(`"${file.slice(pkg.length + 1)}"`);
    }
    return [...byPackage.entries()].map(
      ([pkg, pkgFiles]) =>
        `pnpm --filter ./${pkg} exec eslint --max-warnings=0 ${pkgFiles.join(' ')}`,
    );
  },
};
