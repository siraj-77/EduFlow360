import createNextIntlPlugin from 'next-intl/plugin';

/**
 * Locale negotiation for the request pipeline.
 *
 * UI only (AGENTS.md 3.1): this proxies nothing and performs no data
 * fetching. The API is a separate NestJS service.
 */
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl({});
