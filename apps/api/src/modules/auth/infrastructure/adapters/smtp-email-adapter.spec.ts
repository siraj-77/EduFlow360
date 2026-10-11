import { createTransport } from 'nodemailer';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../../../config/env.js';
import { smtpTransportOptions, SmtpEmailAdapter } from './smtp-email-adapter.js';
import type { OutboundEmail } from '../ports/email-delivery.js';

/**
 * `SmtpEmailAdapter` — production delivery (`ADR-014`).
 *
 * ## Why every test here sends through nodemailer's JSON transport
 *
 * The adapter's whole failure mode is "the SMTP server said no", and a test
 * that mocks the transporter away proves nothing about that. nodemailer
 * ships a `jsonTransport` that runs the REAL mapping and the REAL send path
 * and hands back the message instead of a socket, so these tests exercise
 * exactly what runs in production with none of the network.
 *
 * The transporter is injected for that reason: the default factory builds one
 * from configuration, and a test passes its own. That is a port-shaped seam,
 * not a mock of behaviour — the object injected IS a nodemailer transport.
 */

const email: OutboundEmail = {
  to: 'teacher@school.lk',
  subject: 'Reset your EduFlow360 password',
  textBody: 'plain text body',
  htmlBody: '<p>html body</p>',
};

/** A config with the SMTP group present, mutated per case. */
const configured = (): AppConfig =>
  ({
    SMTP_HOST: 'mailpit',
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    SMTP_USER: undefined,
    SMTP_PASSWORD: undefined,
    EMAIL_FROM: 'EduFlow360 <no-reply@school.lk>',
  }) as unknown as AppConfig;

describe('smtpTransportOptions — configuration to nodemailer, one mapping', () => {
  it('maps host, port and STARTTLS', () => {
    expect(smtpTransportOptions(configured())).toEqual({
      host: 'mailpit',
      port: 1025,
      secure: false,
    });
  });

  it('omits auth when no credentials are configured, so an open relay is not asked for them', () => {
    expect(smtpTransportOptions(configured())).not.toHaveProperty('auth');
  });

  it('includes auth when a pair is configured', () => {
    const options = smtpTransportOptions({
      ...configured(),
      SMTP_USER: 'smtp-user',
      SMTP_PASSWORD: 'smtp-pass',
    } as unknown as AppConfig);

    expect(options).toMatchObject({ auth: { user: 'smtp-user', pass: 'smtp-pass' } });
  });

  it('maps implicit TLS when secure is set', () => {
    const options = smtpTransportOptions({
      ...configured(),
      SMTP_PORT: 465,
      SMTP_SECURE: true,
    } as unknown as AppConfig);

    expect(options).toMatchObject({ port: 465, secure: true });
  });
});

describe('SmtpEmailAdapter', () => {
  it('sends through the real nodemailer path, with the configured envelope', async () => {
    const captured: unknown[] = [];
    const transport = createTransport({ jsonTransport: true });
    const adapter = new SmtpEmailAdapter(configured(), () => {
      const sendMail = transport.sendMail.bind(transport);
      return {
        sendMail: async (message: unknown) => {
          captured.push(message);
          return sendMail(message as never);
        },
      } as never;
    });

    await adapter.send(email);

    expect(captured).toHaveLength(1);
    const [sent] = captured as Array<{ from: string; to: string; subject: string }>;
    expect(sent?.from).toBe('EduFlow360 <no-reply@school.lk>');
    expect(sent?.to).toBe('teacher@school.lk');
    expect(sent?.subject).toBe(email.subject);
  });

  it('sends the plain-text body always, and the HTML one only when there is one', async () => {
    // The message handed to nodemailer IS the adapter's mapping decision, so
    // that is what these assertions read. (The info a JSON transport returns
    // is the compiled MIME, which would test nodemailer rather than this
    // adapter.)
    const transport = createTransport({ jsonTransport: true });
    let passed: Record<string, unknown> | undefined;
    const adapter = new SmtpEmailAdapter(configured(), () => ({
      sendMail: async (message: unknown) => {
        passed = message as Record<string, unknown>;
        return transport.sendMail(message as never);
      },
    }));

    await adapter.send(email);

    expect(passed).toMatchObject({
      text: 'plain text body',
      html: '<p>html body</p>',
    });
  });

  it('omits the HTML part entirely when there is no HTML body', async () => {
    // A missing HTML body must not arrive as the string "null".
    const transport = createTransport({ jsonTransport: true });
    let passed: Record<string, unknown> | undefined;
    const adapter = new SmtpEmailAdapter(configured(), () => ({
      sendMail: async (message: unknown) => {
        passed = message as Record<string, unknown>;
        return transport.sendMail(message as never);
      },
    }));

    await adapter.send({ ...email, htmlBody: null });

    expect(passed).not.toHaveProperty('html');
  });

  it('propagates a transport failure, so the caller can record that no mail went out', async () => {
    // The use-case answers 200 regardless — but it must KNOW, because a
    // silent drop means the account holder never gets a reset link and the
    // support ticket says "the button did nothing".
    const adapter = new SmtpEmailAdapter(configured(), () => ({
      sendMail: async () => {
        throw new Error('smtp refused');
      },
    }));

    await expect(adapter.send(email)).rejects.toThrow('smtp refused');
  });

  it('refuses a blank recipient before any transport is built', async () => {
    let built = false;
    const adapter = new SmtpEmailAdapter(configured(), () => {
      built = true;
      return createTransport({ jsonTransport: true }) as never;
    });

    await expect(adapter.send({ ...email, to: ' ' })).rejects.toThrow(/recipient/i);
    // A blank recipient is a programming error, not a delivery attempt: it
    // must not even open the transport.
    expect(built).toBe(false);
  });
});
