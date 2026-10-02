import { describe, expect, it } from 'vitest';
import {
  AUDIT_KEY,
  Audited,
  ENTITLEMENT_KEY,
  RequireEntitlement,
  RequirePermission,
} from './route-guards.decorator.js';
import { PUBLIC_ROUTE_KEY, Public } from './public.decorator.js';

/**
 * The guards are vocabulary, not enforcement, and these tests are careful not
 * to imply otherwise.
 *
 * The one thing provable today is that a blank key is refused at the call site.
 * That matters more than it sounds: an empty key satisfies the syntax
 * `check-route-guards.mjs` greps for while instructing nothing, so a route
 * could look protected and protect nothing. Refusing it at the decorator means
 * that failure is impossible to write.
 */

describe('@Public', () => {
  it('records the reason it was given', () => {
    const descriptor = { value: () => undefined } as never;
    Public('google oidc callback')(
      descriptor as never,
      'callback',
      Object.getOwnPropertyDescriptor(() => undefined, 'callback') as never,
    );

    const metadata = Reflect.getMetadata(PUBLIC_ROUTE_KEY, descriptor as never);
    expect(metadata.reason).toBe('google oidc callback');
  });

  it('refuses a blank reason at the call site', () => {
    const apply = (reason: string) =>
      Public(reason)(
        {} as never,
        'x',
        Object.getOwnPropertyDescriptor(() => undefined, 'x') as never,
      );

    // An exemption nobody can justify is not an exemption, it is a hole with a
    // comment on it (AGENTS.md 2.3).
    expect(() => apply('')).toThrow(/non-empty reason/);
    expect(() => apply('   ')).toThrow(/non-empty reason/);
  });

  it('trims the reason so a stray space cannot defeat the allowlist match', () => {
    const descriptor = {} as never;
    Public('  spaced  ')(
      descriptor,
      'x',
      Object.getOwnPropertyDescriptor(() => undefined, 'x') as never,
    );
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, descriptor).reason).toBe('spaced');
  });
});

describe('the other three guards', () => {
  it('record their keys', () => {
    const target = {} as never;
    const meta = () => Object.getOwnPropertyDescriptor(() => undefined, 'x') as never;
    RequirePermission('USER_READ')(target, 'x', meta());
    RequireEntitlement('FINANCE_INVOICE_REVERSE')(target, 'x', meta());
    Audited('FINANCE_JOURNAL_POST')(target, 'x', meta());

    expect(Reflect.getMetadata('eduflow:permission', target)).toBe('USER_READ');
    expect(Reflect.getMetadata('eduflow:entitlement', target)).toBe('FINANCE_INVOICE_REVERSE');
    expect(Reflect.getMetadata('eduflow:audit', target)).toBe('FINANCE_JOURNAL_POST');
  });

  it('refuse a blank key, because a blank key looks identical to a real one', () => {
    // This is the whole test. A decorator carrying an empty string would satisfy
    // the static check that greps for `@RequirePermission` while instructing
    // nothing at all.
    expect(() =>
      RequirePermission('')(
        {} as never,
        'x',
        Object.getOwnPropertyDescriptor(() => undefined, 'x') as never,
      ),
    ).toThrow(/non-empty key/);

    expect(() =>
      RequireEntitlement('  ')(
        {} as never,
        'x',
        Object.getOwnPropertyDescriptor(() => undefined, 'x') as never,
      ),
    ).toThrow(/non-empty key/);

    expect(() =>
      Audited('')({} as never, 'x', Object.getOwnPropertyDescriptor(() => undefined, 'x') as never),
    ).toThrow(/non-empty key/);
  });

  it('use distinct metadata keys, so the three never collide', () => {
    const keys = new Set([PERMISSION_KEY_SYM, ENTITLEMENT_KEY_SYM, AUDIT_KEY_SYM]);
    expect(keys.size).toBe(3);
  });
});

const PERMISSION_KEY_SYM = 'eduflow:permission';
const ENTITLEMENT_KEY_SYM = ENTITLEMENT_KEY;
const AUDIT_KEY_SYM = AUDIT_KEY;
