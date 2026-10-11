'use client';

import { Button } from '@eduflow/ui-kit';

/**
 * The four social buttons the approved template carries
 * (`docs/template/EduFlow360_Template_Landing_Auth.html`), wired honestly.
 *
 * ## Why three of them are not links
 *
 * `AGENTS.md` §13: no real OAuth without confirming which client credentials
 * and redirect URIs are configured for the current environment. Google IS —
 * `PLT-101` shipped the redirect and callback routes, and this button
 * navigates to them. Microsoft, Apple and Facebook are not configured, so a
 * link would be a button that fails in a way nobody chose. They answer with
 * the truth instead, through the UI's own i18n string. The template's grid is
 * kept (the approved markup), and its demo `onclick="social('...')"` handlers
 * are exactly what the template's header says to replace with real services.
 *
 * ## Why Google is a handler and not an `href`
 *
 * The route answers a 302 to Google's consent screen. A handler performs the
 * same navigation and keeps the destination a single expression the caller
 * owns, rather than an attribute spread across four places.
 */
export function SocialButtons({
  labels,
  googleHref,
  onGoogleClick,
  onUnconfigured,
}: {
  readonly labels: (key: string) => string;
  /** Where the configured provider's redirect route lives. */
  readonly googleHref: string;
  readonly onGoogleClick: () => void;
  /** Called with the provider name when a not-configured button is pressed. */
  readonly onUnconfigured?: (provider: string) => void;
}) {
  const providers = [
    { key: 'auth.socialGoogle', name: labels('auth.socialGoogle'), configured: true },
    { key: 'auth.socialMicrosoft', name: labels('auth.socialMicrosoft'), configured: false },
    { key: 'auth.socialApple', name: labels('auth.socialApple'), configured: false },
    { key: 'auth.socialFacebook', name: labels('auth.socialFacebook'), configured: false },
  ];

  return (
    <div className="grid grid-cols-2 gap-2" data-testid="social-grid">
      {providers.map((provider) => (
        <Button
          key={provider.key}
          type="button"
          variant="ghost"
          data-testid={`social-${provider.name.toLowerCase()}`}
          data-configured={provider.configured ? 'true' : 'false'}
          onClick={() => {
            if (provider.configured) {
              // A real navigation to the configured redirect route.
              window.location.assign(googleHref);
              onGoogleClick();
              return;
            }
            onUnconfigured?.(provider.name);
          }}
          // The configured one is not described as such to assistive tech;
          // the difference that matters is where it goes, and the message on
          // an unconfigured press says the rest.
          aria-label={provider.name}
        >
          {provider.name}
        </Button>
      ))}
    </div>
  );
}
