import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const visualLoginUser = process.env.VISUAL_LOGIN_USER?.trim() ?? '';
const visualLoginPassword = process.env.VISUAL_LOGIN_PASSWORD ?? '';
const authStorageStatePath = path.join(__dirname, '..', 'visual', 'actual', '.auth.json');

if (!visualLoginUser) {
  console.log(
    'VISUAL_LOGIN_USER is not set; skipping local-only auth-session scaffold (no .auth.json generated).',
  );
}
test.skip(
  !visualLoginUser,
  'VISUAL_LOGIN_USER env var must be set to create the local visual auth session.',
);

test('creates a local visual auth session', async ({ request }) => {
  // Root-relative API bases (`/api`) are the same-origin production shape; this
  // scaffold runs locally, so fall back to the API's documented default origin.
  const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? '';
  const apiBaseUrl =
    configuredApiBaseUrl && !configuredApiBaseUrl.startsWith('/')
      ? configuredApiBaseUrl
      : /* eslint-disable-next-line no-restricted-syntax -- PLT-1001: documented web-side dev fallback origin for this local-only scaffold; see api-base-url.ts. */
        'http://localhost:3001';
  const loginUrl = `${apiBaseUrl.replace(/\/+$/, '')}/auth/login`;

  const response = await request.post(loginUrl, {
    // Matches the DTO accepted by POST /auth/login.
    data: { identifier: visualLoginUser, password: visualLoginPassword },
  });

  if (!response.ok()) {
    throw new Error(
      `auth-session setup failed: POST ${loginUrl} returned ${response.status()} ${response.statusText()}`,
    );
  }

  fs.mkdirSync(path.dirname(authStorageStatePath), { recursive: true });
  await request.storageState({ path: authStorageStatePath });

  console.log(`Local visual auth session saved to ${authStorageStatePath} (gitignored).`);
});
