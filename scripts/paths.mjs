import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The API root, resolved from this script's own location.
 *
 * `scripts/` is one level above the workspace root, so two hops up is the root
 * and one more is the API package. Walking up to a marker would be more
 * robust, but this path is fixed by the repository layout and a marker walk in
 * a *gate* adds a failure mode that does not need to exist.
 */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const API_ROOT = resolve(REPO_ROOT, 'apps', 'api');
