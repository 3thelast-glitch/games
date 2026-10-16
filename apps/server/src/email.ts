import { RuleError } from '../../../packages/core/src/game.ts';

export type EmailSender = (to: string, subject: string, text: string) => Promise<void>;

/**
 * Transactional email is opt-in. There is no logging or test-mode token exposure
 * at public endpoints. Configure a verified sender domain on the delivery service.
 */
export function emailReady(env: NodeJS.ProcessEnv): boolean {
  if (!env.RESEND_API_KEY || !env.NAQLA_EMAIL_FROM || !env.APP_URL) return false;
  try {
    const app = new URL(env.APP_URL);
    return app.protocol === 'https:' && app.pathname === '/' &&
      !app.search && !app.hash && !app.username && !app.password;
  } catch {
    return false;
  }
}

export function emailActionURL(env: NodeJS.ProcessEnv, action: 'verifyEmail' | 'resetPassword', token: string): string {
  if (!emailReady(env)) throw new RuleError('email-not-configured');
  const url = new URL(env.APP_URL!);
  url.searchParams.set(action, token);
  return url.toString();
}

export async function sendAccountEmail(
  env: NodeJS.ProcessEnv,
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  if (!emailReady(env)) throw new RuleError('email-not-configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.NAQLA_EMAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(10000),
  });
  // Avoid logging provider error bodies: they may include recipient or request data.
  if (!response.ok) throw new RuleError('email-delivery-failed');
}
