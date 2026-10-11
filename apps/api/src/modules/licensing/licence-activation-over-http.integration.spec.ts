import { randomUUID, generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startHttpHarness, type HttpHarness } from '../../testing/http-harness.js';
import { TEST_ENVIRONMENT, TEST_JWT_ACCESS_SECRET } from '../../testing/test-environment.js';
import { CSRF_HEADER_NAME } from '../../common/guards/csrf.guard.js';
import { DEFAULT_PASSWORD_HASH_PARAMETERS } from '../settings/domain/services/password-hash-parameters.js';
import type { PasswordHashParameters } from '../auth/domain/ports/password-hasher.js';

/**
 * `POST /licensing/activate` end to end, over a real socket (`PLT-304`).
 *
 * ## What this proves that the unit specs cannot
 *
 * That the WHOLE chain works as a deployment: the route is registered, the
 * envelope reaches the validator, the validator's verdict reaches the
 * repository, the row lands in PostgreSQL, and the audit row records it. The
 * offline path is the story's acceptance criterion ("activates the school
 * exactly as the online path would, with identical validation rigour"), and
 * identical rigour means the same ECDSA verifier, the same canonical form and
 * the same schema the boot refresh runs.
 *
 * ## The throwaway keypair, and the temp file
 *
 * `ADR-009`: the private signing key never enters this repository, tests
 * included. The fixture generates one, writes only the PUBLIC key to a temp
 * file, points `LICENSE_PUBLIC_KEY_PATH` at it, and signs with the private
 * key — which exists for the length of the suite and nowhere else.
 */

const TEST_PARAMETERS: PasswordHashParameters = DEFAULT_PASSWORD_HASH_PARAMETERS;

let prisma: PrismaClient;
let schoolId: string;
let harness: HttpHarness;
let keys: { privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'] };
let keyFile: string;

const post = (body: unknown) =>
  harness.request('/licensing/activate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', [CSRF_HEADER_NAME]: 'test' },
    body: JSON.stringify(body),
  });

/** Sign the canonical material for `payload`, exactly as the activation server will. */
const sign = (payload: unknown): string =>
  cryptoSign('sha256', Buffer.from(canonical(payload), 'utf8'), keys.privateKey).toString('base64');

/** The canonical form, the same one the verifier rebuilds. */
function canonical(payload: unknown): string {
  return JSON.stringify(payload, (_key, value) =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
      : value,
  );
}

const payloadFor = (id = 'sch_om_muscat_01'): Record<string, unknown> => ({
  product: 'EduFlow360',
  edition: 'Deluxe',
  school_id: id,
  school_name: 'Muscat International Academy',
  activation_date: '2026-09-01T00:00:00Z',
  expiry_date: '2027-08-31T23:59:59Z',
  allowed_modules: ['academics', 'finance', 'facilities'],
  limits: { maximum_students: 1500 },
  features: { ai_chatbot: true, hall_rental_pack: true },
});

/**
 * The envelope for THIS deployment. The school id must match the harness's
 * `SCHOOL_ID` — a certificate naming any other school is refused by the
 * activation use-case's binding check, which is its own test below.
 */
const envelopeFor = (id: string = schoolId): Record<string, unknown> => ({
  certificate: payloadFor(id),
  canonicalisationVersion: 1,
  keyId: 'primary-2026',
  signature: sign({ canonicalisationVersion: 1, payload: payloadFor(id) }),
});

beforeEach(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. This suite writes real rows.');
  }
  prisma ??= await (async () => {
    const client = new PrismaClient();
    await client.$connect();
    return client;
  })();

  schoolId = randomUUID();
  await prisma.schoolSettings.create({
    data: {
      schoolId,
      name: 'Activation school',
      timezone: 'Asia/Colombo',
      defaultLocale: 'en',
      currencyCode: 'LKR',
      minorUnitScale: 2,
      roundingMode: 'HALF_UP',
      academicYearStartMonth: 1,
      settings: {},
      passwordHashParameters: { ...TEST_PARAMETERS },
    },
  });

  // The throwaway keypair, and only the public half written to disk.
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  keys = pair;
  const dir = mkdtempSync(join(tmpdir(), 'eduflow-licence-'));
  keyFile = join(dir, 'licence.pub.pem');
  writeFileSync(keyFile, pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(), 'utf8');

  harness = await startHttpHarness({
    env: {
      ...TEST_ENVIRONMENT,
      DATABASE_URL: process.env.DATABASE_URL,
      SCHOOL_ID: schoolId,
      JWT_ACCESS_SECRET: TEST_JWT_ACCESS_SECRET,
      LICENSE_PUBLIC_KEY_PATH: keyFile,
      PASSWORD_RESET_TTL_MS: '3600000',
      PASSWORD_RESET_MAX_ATTEMPTS: '5',
      PASSWORD_RESET_WINDOW_MS: '900000',
      LOGIN_MAX_FAILED_ATTEMPTS: '5',
      LOGIN_LOCKOUT_MS: '600000',
    },
  });
});

afterEach(async () => {
  await harness?.close();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('POST /licensing/activate — a valid certificate for this school', () => {
  it('answers 200, stores the row, and leaves a validation stamp', async () => {
    const response = await post(envelopeFor());

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ activated: true });

    const row = await prisma.license.findUniqueOrThrow({
      where: { schoolId },
      select: { status: true, expiresAt: true, lastValidatedAt: true, keyId: true },
    });
    expect(row.status).toBe('ACTIVE');
    expect(row.keyId).toBe('primary-2026');
    expect(row.lastValidatedAt).not.toBeNull();
    expect(row.expiresAt.toISOString()).toBe('2027-08-31T23:59:59.000Z');
  });

  it('records the activation in the audit trail', async () => {
    await post(envelopeFor());

    const rows = await prisma.auditRecord.findMany({
      where: { schoolId, action: 'LICENCE_ACTIVATION' },
    });
    expect(rows).toHaveLength(1);
  });
});

describe('POST /licensing/activate — refusals', () => {
  it('refuses a certificate for a DIFFERENT school, and stores nothing', async () => {
    const response = await post(envelopeFor('sch_someone_else'));

    expect(response.status).toBe(400);
    expect(await prisma.license.findUnique({ where: { schoolId } })).toBeNull();
  });

  it('refuses a tampered certificate with the frozen body', async () => {
    // The signature was computed over the original; the payload was edited
    // afterwards — the exact attack the validator exists for.
    const blob = envelopeFor();
    (blob.certificate as Record<string, unknown>).edition = 'Enterprise';
    const response = await post(blob);

    expect(response.status).toBe(400);
    expect(JSON.parse(response.body).message).toMatch(/could not be activated/i);
    expect(await prisma.license.findUnique({ where: { schoolId } })).toBeNull();
  });

  it('refuses a forged signature with the same body, so nothing is distinguished', async () => {
    const blob = envelopeFor();
    blob.signature = 'not-a-signature';
    const response = await post(blob);

    expect(response.status).toBe(400);
    expect(await prisma.license.findUnique({ where: { schoolId } })).toBeNull();
  });

  it('refuses a body that is not an envelope at all', async () => {
    const response = await post({ hello: 'world' });

    expect(response.status).toBe(400);
  });

  it('records every ATTEMPT, because an attacker reads logs too', async () => {
    // The interceptor records failures as well as successes (`PLT-402`), so
    // a refused activation leaves a row: the fact, the source, the timestamp,
    // and no certificate content. A malformed body never reaches the
    // use-case, but the route's handler threw — and the record is what makes
    // a sequence of activation attempts visible after the fact.
    await post({ hello: 'world' });
    expect(
      await prisma.auditRecord.count({ where: { schoolId, action: 'LICENCE_ACTIVATION' } }),
    ).toBe(1);

    await post(envelopeFor('sch_someone_else'));
    expect(
      await prisma.auditRecord.count({ where: { schoolId, action: 'LICENCE_ACTIVATION' } }),
    ).toBe(2);

    // And the successful one is the third, with the row in the table.
    await post(envelopeFor());
    expect(
      await prisma.auditRecord.count({ where: { schoolId, action: 'LICENCE_ACTIVATION' } }),
    ).toBe(3);
  });
});
