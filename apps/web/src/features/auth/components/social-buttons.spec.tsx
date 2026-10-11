import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SocialButtons } from './social-buttons';

/**
 * The four social buttons the approved template carries, wired honestly.
 *
 * ## Why three of them are not links
 *
 * `AGENTS.md` §13: no real OAuth without confirming which client credentials
 * and redirect URIs are configured for the current environment. Google IS
 * configured — `PLT-101` shipped the redirect and callback routes, and this
 * button points at them. Microsoft, Apple and Facebook are not configured, so
 * a link would be a button that fails in a way nobody chose. Instead they
 * answer with the truth, through the UI's own i18n string: "not configured
 * for this deployment". The template's grid is kept (the approved markup), and
 * its demo `onclick="social('...')"` handlers are exactly what the template's
 * header says to replace with real services.
 *
 * ## What the Google button is
 *
 * A plain navigation to the API's redirect route, not a `fetch`: the route
 * answers a 302 to Google's consent screen, and a browser navigation is the
 * only shape that can follow it.
 */

const t = (key: string) => {
  const strings: Record<string, string> = {
    'auth.socialGoogle': 'Google',
    'auth.socialMicrosoft': 'Microsoft',
    'auth.socialApple': 'Apple',
    'auth.socialFacebook': 'Facebook',
    'auth.socialDivider': 'or continue with',
    'auth.socialNotConfigured': 'not configured for this deployment',
    'auth.socialGoogleUnavailable': 'Google sign-in is unavailable for this deployment',
  };
  return strings[key] ?? key;
};

describe('SocialButtons', () => {
  it('renders the four buttons the template carries', () => {
    render(
      <SocialButtons
        labels={t}
        googleHref="http://localhost:3001/auth/oidc/redirect"
        onGoogleClick={vi.fn()}
      />,
    );

    for (const name of ['Google', 'Microsoft', 'Apple', 'Facebook']) {
      expect(screen.getByRole('button', { name })).toBeDefined();
    }
  });

  it('makes Google a real navigation to the redirect route', () => {
    const clicked = vi.fn();
    const assigned = vi.fn();
    // `window.location.assign` is what the button performs; observed through a
    // stub because jsdom refuses to navigate.
    const original = window.location.assign;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign: assigned },
      writable: true,
    });

    try {
      render(<SocialButtons labels={t} googleHref="/auth/oidc/redirect" onGoogleClick={clicked} />);

      fireEvent.click(screen.getByRole('button', { name: 'Google' }));

      expect(assigned).toHaveBeenCalledWith('/auth/oidc/redirect');
      expect(clicked).toHaveBeenCalledOnce();
    } finally {
      Object.defineProperty(window, 'location', {
        value: { ...window.location, assign: original },
        writable: true,
      });
    }
  });

  it('answers with the truth for a provider that is not configured', () => {
    const onUnconfigured = vi.fn();
    render(
      <SocialButtons
        labels={t}
        googleHref="/auth/oidc/redirect"
        onGoogleClick={vi.fn()}
        onUnconfigured={onUnconfigured}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Microsoft' }));

    // The name arrives, so the caller can put it in the message: "Microsoft
    // sign-in is not configured for this deployment."
    expect(onUnconfigured).toHaveBeenCalledWith('Microsoft');
  });

  it('marks the configured one apart, visually and to assistive tech', () => {
    render(<SocialButtons labels={t} googleHref="/auth/oidc/redirect" onGoogleClick={vi.fn()} />);

    // The unconfigured three carry the same structure as the template's grid
    // but answer truthfully; Google is the one that goes somewhere.
    expect(screen.getByRole('button', { name: 'Google' }).dataset.configured).toBe('true');
    expect(screen.getByRole('button', { name: 'Microsoft' }).dataset.configured).toBe('false');
  });
});
