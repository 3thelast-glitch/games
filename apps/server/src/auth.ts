import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { RuleError } from '../../../packages/core/src/game.ts';
import { Store, digest, type User } from './store.ts';
const scrypt = promisify(scryptCallback);
export const pkce = (value: string) => createHash('sha256').update(value).digest('base64url');
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}
export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer,
    target = Buffer.from(expected, 'hex');
  return actual.length === target.length && timingSafeEqual(actual, target);
}
interface Provider {
  id: string;
  secret: string;
  authorize: string;
  token: string;
  jwks: string;
  issuer: string | string[];
}
interface Flow {
  provider: 'google' | 'apple';
  nonce: string;
  verifier: string;
  challenge: string;
  native: boolean;
}
export class AuthService {
  constructor(
    readonly store: Store,
    readonly env: NodeJS.ProcessEnv = process.env,
  ) {}
  private provider(name: string): Provider {
    const config =
      name === 'google'
        ? {
            id: this.env.GOOGLE_CLIENT_ID,
            secret: this.env.GOOGLE_CLIENT_SECRET,
            authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
            token: 'https://oauth2.googleapis.com/token',
            jwks: 'https://www.googleapis.com/oauth2/v3/certs',
            issuer: ['https://accounts.google.com', 'accounts.google.com'],
          }
        : name === 'apple'
          ? {
              id: this.env.APPLE_CLIENT_ID,
              secret: this.env.APPLE_CLIENT_SECRET,
              authorize: 'https://appleid.apple.com/auth/authorize',
              token: 'https://appleid.apple.com/auth/token',
              jwks: 'https://appleid.apple.com/auth/keys',
              issuer: 'https://appleid.apple.com',
            }
          : null;
    if (!config?.id || !config.secret || !this.env.PUBLIC_SERVER_URL || !this.env.APP_URL)
      throw new RuleError('provider-not-configured');
    return config as Provider;
  }
  capabilities() {
    return {
      google: !!(
        this.env.GOOGLE_CLIENT_ID &&
        this.env.GOOGLE_CLIENT_SECRET &&
        this.env.PUBLIC_SERVER_URL &&
        this.env.APP_URL
      ),
      apple: !!(
        this.env.APPLE_CLIENT_ID &&
        this.env.APPLE_CLIENT_SECRET &&
        this.env.PUBLIC_SERVER_URL &&
        this.env.APP_URL
      ),
    };
  }
  async register(email: string, password: string, name: string, guestId?: string): Promise<User> {
    if (this.store.identity('email', email)) throw new RuleError('email-unavailable');
    const hash = await hashPassword(password);
    if (guestId && this.store.user(guestId).guest) {
      this.store.db
        .prepare(
          "UPDATE users SET name=?,guest=0,provider='email',subject=?,email=?,password=? WHERE id=?",
        )
        .run(name, email, email, hash, guestId);
      return this.store.user(guestId);
    }
    return this.store.createUser(name, 'email', email, email, hash);
  }
  async login(email: string, password: string): Promise<User> {
    const user = this.store.identity('email', email);
    const valid = await checkPassword(
      password,
      user?.password ?? '00000000000000000000000000000000:' + '0'.repeat(128),
    );
    if (!valid || !user) throw new RuleError('invalid-credentials');
    return user;
  }
  start(provider: 'google' | 'apple', challenge: string, native: boolean): string {
    const config = this.provider(provider),
      state = randomBytes(32).toString('base64url'),
      nonce = randomBytes(32).toString('base64url'),
      verifier = randomBytes(32).toString('base64url');
    if (!/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw new RuleError('invalid-auth-challenge');
    const flow: Flow = { provider, nonce, verifier, challenge, native };
    this.store.db
      .prepare('INSERT INTO oauth_flows VALUES(?,?,?)')
      .run(digest(state), JSON.stringify(flow), Date.now() + 600000);
    const url = new URL(config.authorize);
    url.search = new URLSearchParams({
      client_id: config.id,
      redirect_uri: `${this.env.PUBLIC_SERVER_URL}/api/auth/oauth/${provider}/callback`,
      response_type: 'code',
      scope: provider === 'google' ? 'openid email profile' : 'name email',
      state,
      nonce,
      ...(provider === 'google'
        ? {
            code_challenge: pkce(verifier),
            code_challenge_method: 'S256',
            prompt: 'select_account',
          }
        : { response_mode: 'form_post' }),
    }).toString();
    return url.toString();
  }
  async callback(provider: 'google' | 'apple', state: string, code: string): Promise<string> {
    const row = this.store.db
      .prepare('SELECT body FROM oauth_flows WHERE state=? AND expires_at>?')
      .get(digest(state), Date.now()) as { body: string } | undefined;
    if (!row) throw new RuleError('invalid-oauth-state');
    const flow = JSON.parse(row.body) as Flow;
    if (flow.provider !== provider) throw new RuleError('invalid-oauth-state');
    this.store.db.prepare('DELETE FROM oauth_flows WHERE state=?').run(digest(state));
    const config = this.provider(provider);
    const response = await fetch(config.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.id,
        client_secret: config.secret,
        redirect_uri: `${this.env.PUBLIC_SERVER_URL}/api/auth/oauth/${provider}/callback`,
        ...(provider === 'google' ? { code_verifier: flow.verifier } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new RuleError('provider-sign-in-failed');
    const tokens = (await response.json()) as { id_token?: string };
    if (!tokens.id_token) throw new RuleError('provider-sign-in-failed');
    const { payload } = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(config.jwks)), {
      issuer: config.issuer,
      audience: config.id,
      algorithms: provider === 'google' ? ['RS256'] : ['RS256'],
    });
    if (payload.nonce !== flow.nonce || !payload.sub)
      throw new RuleError('provider-sign-in-failed');
    // Match the signed provider subject. Never auto-link accounts by an untrusted email.
    const user =
      this.store.identity(provider, payload.sub) ??
      this.store.createUser(
        typeof payload.name === 'string' ? payload.name.slice(0, 24) : 'Player',
        provider,
        payload.sub,
        typeof payload.email === 'string' ? payload.email : null,
      );
    const exchange = randomBytes(32).toString('base64url');
    this.store.db
      .prepare('INSERT INTO auth_codes VALUES(?,?,?,?)')
      .run(digest(exchange), user.id, flow.challenge, Date.now() + 60000);
    const target = new URL(flow.native ? 'com.boardarena.app://auth' : this.env.APP_URL!);
    if (flow.native) target.searchParams.set('code', exchange);
    else target.hash = new URLSearchParams({ auth: exchange }).toString();
    return target.toString();
  }
  exchange(code: string, verifier: string): User {
    const row = this.store.db
      .prepare('SELECT user_id,challenge FROM auth_codes WHERE hash=? AND expires_at>?')
      .get(digest(code), Date.now()) as { user_id: string; challenge: string } | undefined;
    if (!row || row.challenge !== pkce(verifier)) throw new RuleError('invalid-auth-code');
    this.store.db.prepare('DELETE FROM auth_codes WHERE hash=?').run(digest(code));
    return this.store.user(row.user_id);
  }
}
