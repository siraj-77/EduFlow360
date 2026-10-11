import type { Transporter } from 'nodemailer';
import { createTransport } from 'nodemailer';
import type { AppConfig } from '../../../../config/env.js';
import {
  assertDeliverable,
  type IEmailDelivery,
  type OutboundEmail,
} from '../../domain/ports/email-delivery.js';

/**
 * `SmtpEmailAdapter` — production delivery (`ADR-014`).
 *
 * ## Where a vendor SDK is allowed, and this is it
 *
 * `AGENTS.md` 2.2: *"Never call a vendor SDK from a use-case or domain file"* —
 * and this file is the adapter the use-case talks to instead. nodemailer
 * appears here and nowhere else, so a change of provider is this file and the
 * environment group in `env.ts`, and nothing else in the repository moves.
 *
 * ## The transporter is injected
 *
 * The default factory builds one from validated configuration; a test passes
 * its own. That seam is what lets the send path be exercised for real through
 * nodemailer's JSON transport — see the spec — rather than mocked away,
 * because "the SMTP server said no" is the failure the adapter exists to
 * surface.
 */
export class SmtpEmailAdapter implements IEmailDelivery {
  /**
   * `transportFactory` defaults to a real transport built from the validated
   * SMTP group. A test passes its own — the seam the send-path spec uses.
   */
  constructor(
    private readonly config: AppConfig,
    private readonly transportFactory: () => Transporter = () =>
      createTransport(smtpTransportOptions(config)),
  ) {}

  async send(email: OutboundEmail): Promise<void> {
    // Before the transport is built: a blank recipient is a programming error
    // and must not open a connection to report it.
    assertDeliverable(email);

    // Built per send, not cached in a field. A long-secret-hunt here would be
    // premature: this process handles a password-reset request at most a
    // handful of times an hour, and nodemailer pools the connection itself.
    const transport = this.transportFactory();

    await transport.sendMail({
      from: this.config.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      text: email.textBody,
      // A `null` HTML body must reach nodemailer as undefined, not as the
      // string "null": the mapping is the adapter's job.
      ...(email.htmlBody !== null ? { html: email.htmlBody } : {}),
    });
  }
}

/**
 * Configuration to nodemailer options, as a PURE function.
 *
 * Exported so the mapping is testable without a transport, and so the
 * adapter's behaviour on a half-configured server is a decided thing rather
 * than whatever nodemailer happens to do with an undefined host.
 */
export function smtpTransportOptions(config: AppConfig): {
  host: string | undefined;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
} {
  const options: {
    host: string | undefined;
    port: number;
    secure: boolean;
    auth?: { user: string; pass: string };
  } = {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
  };

  if (config.SMTP_USER !== undefined && config.SMTP_PASSWORD !== undefined) {
    options.auth = { user: config.SMTP_USER, pass: config.SMTP_PASSWORD };
  }

  return options;
}
