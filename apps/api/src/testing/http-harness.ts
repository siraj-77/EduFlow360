import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { configureApp, createApp, type CreateAppOptions } from '../create-app.js';
import { loadConfig } from '../config/env.js';
import { TEST_ENVIRONMENT, TEST_WEB_ORIGIN, testConfig } from './test-environment.js';

/**
 * An HTTP harness for `apps/api`: the real application, on a real socket.
 *
 * ## Why this exists, and what it replaces
 *
 * Until now the only test of `GET /auth/oidc/redirect` handed the handler a
 * three-method object that recorded `cookie()` and `redirect()` calls
 * (`oidc-sign-in.controller.spec.ts`). That is a legitimate unit test and it is
 * kept. What it cannot do is observe what a browser would actually receive — and
 * for this route the browser-facing output *is* the security control:
 *
 *   - `Set-Cookie` is RFC 6265 text. Whether `HttpOnly`, `Secure` and `SameSite`
 *     reach the wire depends on how `res.cookie` serialised them, which is
 *     Express's job, not ours. A recorder asserts the options object we passed
 *     in; it cannot assert the header.
 *   - A `302` is only a redirect if a status code and a `Location` both arrive.
 *     `res.redirect(302, url)` on a fake response proves we called a method.
 *
 * So the only honest version of this test drives the actual application over an
 * actual TCP connection. There is no second bootstrap: `startHttpHarness` calls
 * `createApp()` — the same function `main.ts` calls — with configuration
 * validated by the same `loadConfig`. If the two ever diverge, this harness is
 * not what diverged.
 *
 * ## What it deliberately does NOT do
 *
 * **No database.** `GET /auth/oidc/redirect` reads and writes no row, and
 * `AppModule.forRoot` constructs no repository, so nothing here needs
 * PostgreSQL and `pnpm test` stays runnable on a machine that has never started
 * the container stack. `TEST_ENVIRONMENT` deliberately omits `DATABASE_URL` and
 * `http-harness.spec.ts` asserts the omission rather than trusting it.
 *
 * **No supertest, no second HTTP client.** Node's global `fetch` is already a
 * real HTTP client, so adding a dependency would buy nothing that the harness
 * could not already do — and one fewer package is one fewer thing that can be
 * wrong at 02:00.
 *
 * ## The one setting that is not the default and must never be
 *
 * **`redirect: 'manual'`.** `fetch` follows a 302 by default, so without this
 * the harness would silently request `https://accounts.google.com/o/oauth2/v2/auth`
 * from a test suite, in every run, on a machine that may be offline. The test
 * would then measure a network failure and report it as a route failure. It
 * would also mean no test ever saw the `302`, which is the whole point.
 */

/** A request the harness can make. Every field is optional and has a real default. */
export interface HttpRequestInit {
  /** Defaults to `GET`. Upper-cased, because Express is case-sensitive about it. */
  readonly method?: string;
  /** Sent verbatim. Header names are lower-cased on the wire, as HTTP requires. */
  readonly headers?: Readonly<Record<string, string>>;
  /**
   * Serialised into a single `Cookie` header.
   *
   * Mutually exclusive with a `cookie` key in `headers`, and supplying both
   * throws rather than picking one. An ambiguous request is a test that means
   * something different from what its author thought.
   */
  readonly cookies?: Readonly<Record<string, string>>;
  readonly body?: string;
}

/**
 * One cookie off a real `Set-Cookie` header.
 *
 * `raw` is kept verbatim and is the authoritative field: everything below is a
 * convenience reading of RFC 6265 attribute syntax, and a test that must not be
 * able to be fooled should assert on `raw` for presence and on these fields for
 * structure.
 */
export interface ReceivedCookie {
  readonly name: string;
  /** The value exactly as serialised. Never URL-decoded here. */
  readonly value: string;
  /** Attribute names lower-cased, so `HttpOnly` and `httponly` compare equal. */
  readonly attributes: Readonly<Record<string, string | true>>;
  /** The header this came from, untouched. */
  readonly raw: string;
}

/** What came back over the socket. */
export interface HttpResponse {
  readonly status: number;
  readonly headers: Headers;
  /** Every `Set-Cookie`, in order. `Headers.get('set-cookie')` would join them. */
  readonly setCookie: readonly string[];
  readonly body: string;
  /** `Location`, or `null`. Named because a missing `Location` is a real outcome. */
  readonly location: string | null;
  /** The parsed cookies. Empty when the response set none. */
  readonly cookies: readonly ReceivedCookie[];
  /** Look one cookie up by name, or `null`. First match wins, as browsers do. */
  cookie(name: string): ReceivedCookie | null;
}

export interface HttpHarness {
  /** `http://127.0.0.1:<ephemeral>`. No port is chosen by this repository. */
  readonly baseUrl: string;
  /** The live application, for `app.get(...)` assertions about wiring. */
  readonly app: INestApplication;
  /** Make one request. Never follows a redirect. */
  request(path: string, init?: HttpRequestInit): Promise<HttpResponse>;
  /** Shut the server down. Idempotent. */
  close(): Promise<void>;
}

export interface StartHttpHarnessOptions {
  /**
   * Overrides the synthetic environment. Whatever is passed goes through the real
   * `loadConfig`, so an invalid value fails here naming the variable rather than
   * surfacing as `undefined` inside a use-case.
   *
   * `process.env` is never consulted and is not a fallback. That is the property
   * which keeps a developer's real Google credentials out of a test run.
   */
  readonly env?: NodeJS.ProcessEnv;
  /** The single allowed browser origin. Defaults to the synthetic one. */
  readonly webOrigin?: string;
  /**
   * Replace the implementation behind ONE port, for the life of this harness.
   *
   * ## Why this exists, and why it is narrow
   *
   * `createApp` has deliberately no seam for substituting a module graph — see its own
   * header. This is not that. The module graph is still `AppModule.forRoot`'s, the
   * application is still a real Nest application built by the real `AppModule`, on a
   * real socket, with the real `CsrfGuard`, the real `SessionGuard`, the real
   * controllers, the real use-cases and the real Prisma repositories. **Only one vendor
   * boundary is replaced**, which is exactly what a port exists for: `AGENTS.md` 2.2
   * requires vendor and hardware integrations to sit behind interfaces, and a
   * requirement that cannot be exercised without a network is not a requirement.
   *
   * `IOIDC_PROVIDER` is the case that needs it. `GoogleOidcProvider` reaches Google's
   * token endpoint and JWKS over the network, and no Google credentials exist in this
   * repository (see `docs/work/TODO.md`), so a callback route could otherwise not be
   * driven over a socket at all — and the callback is the route where a stranger's
   * assertion becomes a local account.
   *
   * ## What it deliberately is NOT
   *
   * It is not a way to swap a repository for a fake. That would defeat the point of
   * these suites: the `ExternalIdentity` and `Session` claims below are about what the
   * SCHEMA will allow, and a fake database proves nothing about a schema. Use a real
   * PostgreSQL for those, as `login-over-http.integration.spec.ts` does.
   */
  readonly overrides?: readonly ProviderOverride[];
}

/**
 * One port's implementation, replaced.
 *
 * `token` is the DI symbol — the same one the production module registered — so a typo
 * is a resolution failure at boot rather than a silently-unused override.
 */
export interface ProviderOverride {
  readonly token: symbol;
  readonly useValue: unknown;
}

/**
 * Parse one `Set-Cookie` header.
 *
 * Deliberately small and deliberately literal. It splits on `;`, treats the
 * first segment as `name=value`, and lower-cases attribute names. It does not
 * unquote, does not decode, does not validate, and does not reorder — a parser
 * that "normalises" a header is a parser that can disagree with the browser
 * about what was sent, which is the one thing this harness exists to rule out.
 */
export function parseSetCookie(header: string): ReceivedCookie {
  const segments = header.split(';');
  const first = segments[0] ?? '';
  const separator = first.indexOf('=');

  const attributes: Record<string, string | true> = {};
  for (const segment of segments.slice(1)) {
    const trimmed = segment.trim();
    if (trimmed.length === 0) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      attributes[trimmed.toLowerCase()] = true;
    } else {
      attributes[trimmed.slice(0, eq).trim().toLowerCase()] = trimmed.slice(eq + 1).trim();
    }
  }

  return {
    name: (separator === -1 ? first : first.slice(0, separator)).trim(),
    value: separator === -1 ? '' : first.slice(separator + 1).trim(),
    attributes,
    raw: header,
  };
}

/** `name=value; name2=value2`, the form the `Cookie` request header takes. */
function serializeCookies(cookies: Readonly<Record<string, string>>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/**
 * Boot the real application on an ephemeral port and return a client for it.
 *
 * **Port 0, always.** Not `config.PORT`: a fixed port collides with a developer's
 * running `pnpm dev`, and a collision here produces a test failure that reads as
 * a route defect. The kernel assigns a free port and the harness reports it, so
 * parallel test files cannot collide either.
 */
export async function startHttpHarness(
  options: StartHttpHarnessOptions = {},
): Promise<HttpHarness> {
  const config = loadConfig(options.env ?? TEST_ENVIRONMENT).config;
  const webOrigin = options.webOrigin ?? TEST_WEB_ORIGIN;
  const createOptions: CreateAppOptions = { config, webOrigin };

  const overrides = options.overrides ?? [];

  /**
   * Two builders, one graph, one configuration step.
   *
   * With no overrides the harness calls `createApp` — the same function `main.ts`
   * calls — so the default path has no test-only code in it at all. With overrides it
   * builds the SAME `AppModule.forRoot` graph through `@nestjs/testing`, which is the
   * only supported way to replace a provider Nest has already registered, and then
   * applies `configureApp` so CORS and shutdown hooks are the product's.
   */
  const app =
    overrides.length === 0
      ? await createApp(createOptions)
      : await buildWithOverrides(createOptions, overrides);

  await app.listen(0, '127.0.0.1');

  // `getUrl()` reflects the address actually bound, which is the only correct
  // source for the port: it is the kernel's answer, not an assumption.
  const baseUrl = await app.getUrl();

  let closed = false;

  const harness: HttpHarness = {
    baseUrl,
    app,

    async request(path: string, init: HttpRequestInit = {}): Promise<HttpResponse> {
      const headers: Record<string, string> = { ...(init.headers ?? {}) };
      const lowered = Object.keys(headers).map((name) => name.toLowerCase());

      if (init.cookies !== undefined) {
        if (lowered.includes('cookie')) {
          throw new Error(
            'startHttpHarness: both a `cookie` header and a `cookies` record were given. ' +
              'Pick one. Merging them would make the request mean something other than what ' +
              'the caller wrote.',
          );
        }
        headers['cookie'] = serializeCookies(init.cookies);
      }

      const response = await fetch(new URL(path, baseUrl), {
        method: (init.method ?? 'GET').toUpperCase(),
        headers,
        ...(init.body !== undefined ? { body: init.body } : {}),
        // See the file header. Without this the harness follows the 302 to
        // Google and every run becomes a network test.
        redirect: 'manual',
      });

      const setCookie = response.headers.getSetCookie();
      const cookies = setCookie.map(parseSetCookie);

      return {
        status: response.status,
        headers: response.headers,
        setCookie,
        body: await response.text(),
        location: response.headers.get('location'),
        cookies,
        cookie(name: string): ReceivedCookie | null {
          return cookies.find((candidate) => candidate.name === name) ?? null;
        },
      };
    },

    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await app.close();
    },
  };

  return harness;
}

/**
 * Build the same graph with one or more providers replaced.
 *
 * `@nestjs/testing` is a devDependency and is used ONLY here. `overrideProvider`
 * replaces a provider **wherever it is registered in the graph**, so a token provided
 * by the dynamically-built `AuthModule` is replaced without this file describing that
 * module — which is the whole point: a test that re-declared the providers would be a
 * second description of the application, and every route test would then be evidence
 * about a graph the product does not use.
 */
async function buildWithOverrides(
  options: CreateAppOptions,
  overrides: readonly ProviderOverride[],
): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule.forRoot(options.config)] });

  for (const override of overrides) {
    builder.overrideProvider(override.token).useValue(override.useValue);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();

  // The product's own post-construction configuration — see `configureApp`.
  configureApp(app, options);

  return app;
}

/** Re-exported so a spec can boot the same configuration without a second path. */
export { testConfig };
