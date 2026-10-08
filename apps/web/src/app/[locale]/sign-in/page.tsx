import { setRequestLocale } from 'next-intl/server';
import { SUPPORTED_LOCALES } from '@eduflow/shared-types';
import { routing } from '@/i18n/routing';
import { SignInScreen } from '@/features/auth/pages/sign-in-screen';

/**
 * The sign-in route.
 *
 * ## What replaced what
 *
 * Until `PLT-101` this file was a 61-line stub with no form controls, no API call
 * and no session: it said so in the visitor's own language and offered a link
 * back, because a link to a route that does not exist is a 404 on the school's
 * front door. `POST /auth/login` exists now, so the stub's reason for existing is
 * gone and the screen is the real one.
 *
 * It stays thin. `AGENTS.md` 3.2.3 forbids a monolithic page, so this route only
 * resolves the locale and hands off; the screen composes the masthead, the form
 * and the footer, and the form's own state lives in
 * `features/auth/hooks/use-sign-in.ts`.
 *
 * The backend's contract is `apps/api/.../password-sign-in.controller.ts` and its
 * `dto/password-sign-in.dto.ts`. Two things from it shape this route and are
 * easy to get wrong:
 *
 *   - **`CsrfGuard` enforces globally.** A `POST` without `x-eduflow-csrf` is
 *     refused in the guard pipeline, before the credential is even read. The
 *     header is attached in `features/auth/csrf-header.ts`, which is the only
 *     place it is built.
 *   - **The body is `.strict()`.** Exactly `identifier` and `password`. A third
 *     field is a 400.
 */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as never)) {
    return null;
  }
  setRequestLocale(locale as never);

  return <SignInScreen locale={locale} />;
}
