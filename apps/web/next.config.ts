import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * UI only (AGENTS.md 3.1). The API is a separate NestJS service, so
   * there is deliberately no rewrites proxy, no server actions, and no
   * data fetching from this app's server.
   */
  poweredByHeader: false,
  transpilePackages: ['@eduflow/ui-kit', '@eduflow/shared-types', '@eduflow/i18n-resources'],
};

export default withNextIntl(nextConfig);
