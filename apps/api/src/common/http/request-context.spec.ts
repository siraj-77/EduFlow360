import { describe, expect, it } from 'vitest';
import { sourceAddressOf, toDeviceContext } from './request-context.js';

/**
 * `request-context` — the request facts a throttle and a session record are built from.
 *
 * ## Why a spec for two small functions
 *
 * Because one of them feeds a **throttle key**. A difference between `ip` and the
 * socket peer is the difference between a throttle that can be bypassed by forging a
 * header and one that cannot, and that difference is invisible in review: both lines
 * read `request.ip ?? request.socket?.remoteAddress`.
 */
describe('sourceAddressOf', () => {
  it('prefers Express-s resolved address', () => {
    expect(sourceAddressOf({ ip: '10.0.0.1', socket: { remoteAddress: '127.0.0.1' } })).toBe(
      '10.0.0.1',
    );
  });

  it('falls back to the socket peer when Express resolved nothing', () => {
    expect(sourceAddressOf({ socket: { remoteAddress: '127.0.0.1' } })).toBe('127.0.0.1');
  });

  it('buckets every caller with no resolvable address together, rather than not at all', () => {
    // The direction that matters. A per-request key would be no throttle at all, and
    // a blank-but-present key would be a bucket an attacker can name for themselves.
    expect(sourceAddressOf({})).toBe('unknown-source');
    expect(sourceAddressOf({ ip: '', socket: {} })).toBe('unknown-source');
    expect(new Set([sourceAddressOf({}), sourceAddressOf({ ip: '' })]).size).toBe(1);
  });

  it('treats a whitespace-only address as unresolvable, not as a key', () => {
    // A test that found this: `??` does not catch `''`, so the obvious one-liner
    // produced `''` as the throttle key — a bucket a caller can choose.
    expect(sourceAddressOf({ ip: '   ' })).toBe('unknown-source');
    expect(sourceAddressOf({ ip: '   ', socket: { remoteAddress: '  ' } })).toBe('unknown-source');
  });

  it('trims a real address rather than keying on it with padding', () => {
    expect(sourceAddressOf({ ip: '  10.0.0.7  ' })).toBe('10.0.0.7');
  });
});

describe('toDeviceContext', () => {
  it('returns nothing at all when the request carries neither field', () => {
    // `{}` rather than `{ device: {} }`: `PrismaSessionRepository` writes no columns
    // for an empty device, and an object with two absent keys is not the same value.
    expect(toDeviceContext({})).toEqual({});
  });

  it('records the address alone, without inventing an absent user agent', () => {
    expect(toDeviceContext({ ip: '10.0.0.7' })).toEqual({ device: { ipAddress: '10.0.0.7' } });
  });

  it('records the user agent alone', () => {
    expect(toDeviceContext({ headers: { 'user-agent': 'EduFlow/1.0' } })).toEqual({
      device: { userAgent: 'EduFlow/1.0' },
    });
  });

  it('records both when both are present', () => {
    expect(toDeviceContext({ ip: '10.0.0.7', headers: { 'user-agent': 'EduFlow/1.0' } })).toEqual({
      device: { ipAddress: '10.0.0.7', userAgent: 'EduFlow/1.0' },
    });
  });

  it('records NO user agent when the header appeared more than once', () => {
    // Node joins a duplicated header into one string and some proxies leave it as an
    // array. Picking one would record an attacker-chosen value on a session row;
    // recording none loses nothing a human reading a device list needs.
    expect(toDeviceContext({ ip: '10.0.0.7', headers: { 'user-agent': ['a', 'b'] } })).toEqual({
      device: { ipAddress: '10.0.0.7' },
    });
  });

  it('falls back to the socket peer for the recorded address', () => {
    expect(toDeviceContext({ socket: { remoteAddress: '127.0.0.1' } })).toEqual({
      device: { ipAddress: '127.0.0.1' },
    });
  });
});
