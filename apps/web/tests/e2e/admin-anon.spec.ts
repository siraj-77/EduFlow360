import { expect, test } from '@playwright/test';

test('anonymous GET /en/admin redirects to /en/sign-in carrying next=/en/admin', async ({
  page,
}) => {
  await page.goto('/en/admin');

  const url = new URL(page.url());
  expect(url.pathname).toBe('/en/sign-in');
  expect(url.searchParams.get('next')).toBe('/en/admin');
});
